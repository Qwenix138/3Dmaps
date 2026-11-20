from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import requests
from PIL import Image

from .config import BBox
from .errors import DataSourceError
from .geo import Grid, LocalProjection, make_grid, tile_zoom_for_spacing, web_mercator_meters, web_mercator_xyz

TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
TERRARIUM_ATTRIBUTION = "Terrain tiles: Mapzen/Tilezen Terrarium, SRTM/Copernicus DEM"


@dataclass
class TerrainGrid:
    elevations: np.ndarray
    grid: Grid
    projection: LocalProjection
    zoom: int
    tiles: list[tuple[int, int, int]]
    base_elevation: float
    attribution: str
    bbox: BBox | None = None

    @property
    def min_elevation(self) -> float:
        return float(np.min(self.elevations))

    @property
    def max_elevation(self) -> float:
        return float(np.max(self.elevations))

    @property
    def z(self) -> np.ndarray:
        return self.elevations - self.base_elevation

    def sample(self, x: np.ndarray | float, y: np.ndarray | float) -> np.ndarray:
        xs = np.atleast_1d(np.asarray(x, dtype=np.float64))
        ys = np.atleast_1d(np.asarray(y, dtype=np.float64))
        grid = self.grid
        ix = (xs - grid.x_min) / (grid.x_max - grid.x_min) * (grid.nx - 1)
        iy = (ys - grid.y_min) / (grid.y_max - grid.y_min) * (grid.ny - 1)
        ix = np.clip(ix, 0.0, grid.nx - 1.0)
        iy = np.clip(iy, 0.0, grid.ny - 1.0)
        x0 = np.floor(ix).astype(int)
        y0 = np.floor(iy).astype(int)
        x1 = np.minimum(x0 + 1, grid.nx - 1)
        y1 = np.minimum(y0 + 1, grid.ny - 1)
        fx = ix - x0
        fy = iy - y0
        z = self.elevations
        return (
            z[y0, x0] * (1 - fx) * (1 - fy)
            + z[y0, x1] * fx * (1 - fy)
            + z[y1, x0] * (1 - fx) * fy
            + z[y1, x1] * fx * fy
        )


def decode_terrarium(image: Image.Image) -> np.ndarray:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    return rgb[:, :, 0] * 256.0 + rgb[:, :, 1] + rgb[:, :, 2] / 256.0 - 32768.0


def _tile_range(bbox: BBox, zoom: int) -> tuple[int, int, int, int]:
    x0, y0 = web_mercator_xyz(bbox.west, bbox.north, zoom)
    x1, y1 = web_mercator_xyz(bbox.east, bbox.south, zoom)
    tx0 = int(math.floor(x0 / 256))
    tx1 = int(math.floor(x1 / 256))
    ty0 = int(math.floor(y0 / 256))
    ty1 = int(math.floor(y1 / 256))
    limit = 2**zoom
    return max(0, tx0), max(0, ty0), min(limit - 1, tx1), min(limit - 1, ty1)


def _fetch_tile(session: requests.Session, cache_dir: Path, z: int, x: int, y: int) -> Image.Image:
    path = cache_dir / "terrarium" / str(z) / str(x) / f"{y}.png"
    if path.exists():
        try:
            return Image.open(path).convert("RGB")
        except Exception:
            path.unlink(missing_ok=True)
    url = TERRARIUM_URL.format(z=z, x=x, y=y)
    last_error: Exception | None = None
    for _ in range(3):
        try:
            response = session.get(url, timeout=60)
            response.raise_for_status()
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            tmp.write_bytes(response.content)
            img = Image.open(tmp).convert("RGB")
            tmp.replace(path)
            return img
        except Exception as exc:
            last_error = exc
    raise DataSourceError(f"Не удалось загрузить DEM-тайл {z}/{x}/{y}: {last_error}")


def smooth_elevations(elevations: np.ndarray, passes: int = 0) -> np.ndarray:
    result = np.array(elevations, dtype=np.float64, copy=True)
    for _ in range(max(0, int(passes))):
        padded = np.pad(result, 1, mode="constant")
        total = np.zeros_like(result)
        count = np.zeros_like(result)
        for dy in range(3):
            for dx in range(3):
                total += padded[dy : dy + result.shape[0], dx : dx + result.shape[1]]
        valid = np.pad(np.ones_like(result), 1, mode="constant")
        for dy in range(3):
            for dx in range(3):
                count += valid[dy : dy + result.shape[0], dx : dx + result.shape[1]]
        result = total / count
    return result


def load_terrain(
    bbox: BBox,
    spacing_m: float = 30.0,
    cache_dir: Path = Path("cache"),
    height_scale: float = 1.0,
    smoothing: int = 0,
    progress=None,
) -> TerrainGrid:
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    projection, grid = make_grid(bbox, spacing_m)
    zoom = tile_zoom_for_spacing(bbox.center[0], spacing_m)
    tx0, ty0, tx1, ty1 = _tile_range(bbox, zoom)
    session = requests.Session()
    session.headers["User-Agent"] = "3Dmaps/0.1 (+https://github.com/)"
    cols = tx1 - tx0 + 1
    rows = ty1 - ty0 + 1
    mosaic = np.zeros((rows * 256, cols * 256), dtype=np.float32)
    tiles: list[tuple[int, int, int]] = []
    total = rows * cols
    done = 0
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            image = _fetch_tile(session, cache_dir, zoom, tx, ty)
            arr = decode_terrarium(image)
            ox = (tx - tx0) * 256
            oy = (ty - ty0) * 256
            mosaic[oy : oy + 256, ox : ox + 256] = arr
            tiles.append((zoom, tx, ty))
            done += 1
            if progress:
                progress(0.04 + 0.28 * done / max(1, total), f"DEM-тайлы {done}/{total}")

    lon_grid, lat_grid = projection.to_geo_many(*np.meshgrid(grid.xs, grid.ys))
    lat_clipped = np.clip(lat_grid, -85.05112878, 85.05112878)
    world_px = 256.0 * (2**zoom)
    px = (lon_grid + 180.0) / 360.0 * world_px - tx0 * 256
    py = (1.0 - np.arcsinh(np.tan(np.radians(lat_clipped))) / math.pi) / 2.0 * world_px - ty0 * 256
    px = np.clip(px, 0.0, mosaic.shape[1] - 1.001)
    py = np.clip(py, 0.0, mosaic.shape[0] - 1.001)
    x0 = np.floor(px).astype(int)
    y0 = np.floor(py).astype(int)
    x1 = np.minimum(x0 + 1, mosaic.shape[1] - 1)
    y1 = np.minimum(y0 + 1, mosaic.shape[0] - 1)
    fx = px - x0
    fy = py - y0
    elevations = (
        mosaic[y0, x0] * (1 - fx) * (1 - fy)
        + mosaic[y0, x1] * fx * (1 - fy)
        + mosaic[y1, x0] * (1 - fx) * fy
        + mosaic[y1, x1] * fx * fy
    )
    if not np.isfinite(elevations).all():
        raise DataSourceError("DEM содержит некорректные высоты")
    if smoothing:
        elevations = smooth_elevations(elevations, smoothing)
    if height_scale != 1.0:
        mean = float(np.mean(elevations))
        elevations = mean + (elevations - mean) * float(height_scale)
    base = float(np.min(elevations))
    if progress:
        progress(0.34, "Рельеф загружен")
    return TerrainGrid(
        elevations=elevations.astype(np.float64),
        grid=grid,
        projection=projection,
        zoom=zoom,
        tiles=tiles,
        base_elevation=base,
        attribution=TERRARIUM_ATTRIBUTION,
        bbox=bbox,
    )


def save_heightmap(terrain: TerrainGrid, path: Path) -> tuple[float, float]:
    path.parent.mkdir(parents=True, exist_ok=True)
    z = terrain.elevations
    lo = float(np.min(z))
    hi = float(np.max(z))
    if hi - lo < 1e-9:
        normalized = np.zeros_like(z, dtype=np.uint16)
    else:
        normalized = np.clip((z - lo) / (hi - lo) * 65535.0, 0, 65535).astype(np.uint16)
    north_up = np.flipud(normalized)
    Image.fromarray(north_up).save(path, optimize=True)
    np.save(path.with_suffix(".npy"), np.flipud(z).astype(np.float32))
    return lo, hi
