from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFont, ImageStat
from pyproj import Transformer

from .buildings import Building
from .config import BBox
from .elevation import TerrainGrid
from .geo import Grid, LocalProjection
from .osm import OsmData
from .roads import RoadWay

EOX_WMS = "https://tiles.maps.eox.at/wms"
EOX_ATTRIBUTION = "Sentinel-2 cloudless by EOX IT Services GmbH, CC BY-NC-SA 4.0"
EOX_LICENSE = "CC BY-NC-SA 4.0"
FONT_DIR = Path(__file__).with_name("assets") / "fonts"

ROAD_COLORS = {
    "motorway": (245, 208, 130),
    "trunk": (247, 216, 151),
    "primary": (255, 235, 180),
    "secondary": (255, 244, 210),
    "tertiary": (255, 255, 255),
    "residential": (255, 255, 255),
    "unclassified": (255, 255, 255),
    "service": (246, 246, 246),
    "living_street": (255, 255, 255),
}

ROAD_LABEL_TYPES = {
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "residential",
    "unclassified",
    "living_street",
    "pedestrian",
}


@dataclass
class TextureSet:
    satellite: Path | None
    labels: Path
    hybrid: Path | None
    overlay: Path
    relief: Path | None
    satellite_attribution: str | None
    satellite_license: str | None


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    path = FONT_DIR / name
    try:
        return ImageFont.truetype(str(path), size=size)
    except Exception:
        try:
            return ImageFont.load_default(size=size)
        except Exception:
            return ImageFont.load_default()


def _to_pixel(
    x: float,
    y: float,
    grid: Grid,
    size: int,
) -> tuple[float, float]:
    px = (x - grid.x_min) / max(1e-9, grid.x_max - grid.x_min) * size
    py = (grid.y_max - y) / max(1e-9, grid.y_max - grid.y_min) * size
    return px, py


def _ring_pixels(ring: Iterable[tuple[float, float]], grid: Grid, size: int) -> list[tuple[float, float]]:
    return [_to_pixel(x, y, grid, size) for x, y in ring]


def _overlaps(box: tuple[float, float, float, float], boxes: list[tuple[float, float, float, float]]) -> bool:
    left, top, right, bottom = box
    for a, b, c, d in boxes:
        if left < c and right > a and top < d and bottom > b:
            return True
    return False


def _load_places(data: OsmData, projection: LocalProjection, grid: Grid, size: int) -> list[dict]:
    result = []
    for node in data.places():
        kind = node.tags.get("place", "")
        name = node.tags.get("name", "").strip()
        if not name:
            continue
        x, y = projection.to_local(node.lon, node.lat)
        px, py = _to_pixel(x, y, grid, size)
        if not (0 <= px <= size and 0 <= py <= size):
            continue
        result.append(
            {
                "name": name,
                "kind": kind,
                "x": px,
                "y": py,
                "population": int(node.tags.get("population", "0") or 0),
            }
        )
    order = {"city": 0, "town": 1, "village": 2, "hamlet": 3, "suburb": 4, "neighbourhood": 5}
    result.sort(key=lambda p: (order.get(p["kind"], 9), -p["population"]))
    return result


def _draw_roads(
    draw: ImageDraw.ImageDraw,
    roads: list[RoadWay],
    grid: Grid,
    size: int,
    width_scale: float = 1.0,
    alpha: int = 255,
) -> None:
    meters_per_pixel = (grid.x_max - grid.x_min) / max(1, size)
    for road in roads:
        points = [_to_pixel(x, y, grid, size) for x, y in road.coords]
        if len(points) < 2:
            continue
        width_px = max(1, int(round(road.width / max(0.01, meters_per_pixel) * width_scale)))
        if road.material == "rail":
            color = (113, 92, 76, alpha)
            draw.line(points, fill=color, width=max(1, width_px), joint="curve")
            continue
        kind = road.tags.get("highway", "tertiary")
        casing = (184, 177, 166, alpha)
        fill = ROAD_COLORS.get(kind, (255, 255, 255))
        draw.line(points, fill=casing, width=width_px + 2, joint="curve")
        draw.line(points, fill=(*fill, alpha), width=width_px, joint="curve")


def _draw_buildings(
    draw: ImageDraw.ImageDraw,
    buildings: list[Building],
    grid: Grid,
    size: int,
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int] | None = None,
) -> None:
    for building in buildings:
        exterior = _ring_pixels(building.polygon.exterior.coords, grid, size)
        if len(exterior) < 3:
            continue
        draw.polygon(exterior, fill=fill)
        if outline is not None:
            draw.line(exterior, fill=outline, width=1, joint="curve")


def _draw_labels(
    draw: ImageDraw.ImageDraw,
    places: list[dict],
    roads: list[RoadWay],
    buildings: list[Building],
    grid: Grid,
    size: int,
    color: tuple[int, int, int, int],
    halo: tuple[int, int, int, int],
) -> None:
    boxes: list[tuple[float, float, float, float]] = []
    seen_names: set[str] = set()
    for place in places:
        kind = place["kind"]
        font_size = {"city": 42, "town": 30, "village": 21, "hamlet": 17, "suburb": 18, "neighbourhood": 15}.get(
            kind, 16
        )
        font = _font(max(10, int(font_size * size / 2048)), bold=kind in ("city", "town"))
        text = place["name"]
        if text in seen_names:
            continue
        bbox = draw.textbbox((0, 0), text, font=font, stroke_width=2)
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        x = place["x"] - width / 2
        y = place["y"] - height / 2
        box = (x - 4, y - 3, x + width + 4, y + height + 3)
        if _overlaps(box, boxes):
            continue
        boxes.append(box)
        draw.text(
            (x, y),
            text,
            font=font,
            fill=color,
            stroke_width=2,
            stroke_fill=halo,
        )
        seen_names.add(text)

    meters_per_pixel = (grid.x_max - grid.x_min) / max(1, size)
    for road in roads:
        name = road.tags.get("name") or road.tags.get("ref")
        if not name or len(name) > 42 or len(road.coords) < 2:
            continue
        if name in seen_names:
            continue
        if road.tags.get("highway") not in ROAD_LABEL_TYPES and not road.tags.get("ref"):
            continue
        mid = len(road.coords) // 2
        x, y = road.coords[mid]
        px, py = _to_pixel(x, y, grid, size)
        if not (0 <= px <= size and 0 <= py <= size):
            continue
        font = _font(max(9, int(13 * size / 2048)), bold=False)
        bbox = draw.textbbox((0, 0), name, font=font, stroke_width=1)
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        box = (px - width / 2 - 3, py - height / 2 - 2, px + width / 2 + 3, py + height / 2 + 2)
        if _overlaps(box, boxes):
            continue
        boxes.append(box)
        draw.text(
            (px - width / 2, py - height / 2),
            name,
            font=font,
            fill=color,
            stroke_width=1,
            stroke_fill=halo,
        )
        seen_names.add(name)


def render_label_textures(
    bbox: BBox,
    buildings: list[Building],
    roads: list[RoadWay],
    data: OsmData,
    projection: LocalProjection,
    grid: Grid,
    size: int,
    include_labels: bool = True,
) -> tuple[Image.Image, Image.Image]:
    base = Image.new("RGBA", (size, size), (239, 236, 230, 255))
    draw = ImageDraw.Draw(base)
    _draw_buildings(draw, buildings, grid, size, (215, 211, 204, 255), (181, 174, 164, 255))
    _draw_roads(draw, roads, grid, size, alpha=255)
    places = _load_places(data, projection, grid, size)
    if include_labels:
        _draw_labels(draw, places, roads, buildings, grid, size, (45, 42, 38, 255), (255, 255, 255, 245))

    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    _draw_buildings(odraw, buildings, grid, size, (70, 70, 70, 35), (50, 50, 50, 110))
    _draw_roads(odraw, roads, grid, size, alpha=210)
    if include_labels:
        _draw_labels(odraw, places, roads, buildings, grid, size, (255, 255, 255, 255), (30, 30, 30, 220))
    return base, overlay


def download_eox_satellite(
    bbox: BBox,
    size: int = 4096,
    layer: str = "s2cloudless-2025_3857",
    timeout: int = 120,
) -> tuple[Image.Image, str, str]:
    transformer = Transformer.from_crs(4326, 3857, always_xy=True)
    x1, y1 = transformer.transform(bbox.west, bbox.south)
    x2, y2 = transformer.transform(bbox.east, bbox.north)
    params = {
        "SERVICE": "WMS",
        "REQUEST": "GetMap",
        "VERSION": "1.3.0",
        "LAYERS": layer,
        "STYLES": "",
        "CRS": "EPSG:3857",
        "BBOX": f"{x1:.3f},{y1:.3f},{x2:.3f},{y2:.3f}",
        "WIDTH": str(size),
        "HEIGHT": str(size),
        "FORMAT": "image/jpeg",
    }
    response = requests.get(
        EOX_WMS,
        params=params,
        timeout=timeout,
        headers={"User-Agent": "3Dmaps/0.1 (+https://github.com/)"},
    )
    if response.status_code != 200:
        raise RuntimeError(f"EOX WMS HTTP {response.status_code}: {response.text[:200]}")
    content_type = response.headers.get("content-type", "")
    if "image" not in content_type:
        raise RuntimeError(f"EOX WMS вернул не изображение: {content_type}")
    from io import BytesIO

    image = Image.open(BytesIO(response.content)).convert("RGB")
    if image.size != (size, size):
        image = image.resize((size, size), Image.Resampling.LANCZOS)
    stat = ImageStat.Stat(image)
    if max(stat.stddev) < 2.0 or max(stat.mean) < 3.0:
        raise RuntimeError("EOX WMS вернул пустое изображение")
    return image, EOX_ATTRIBUTION, EOX_LICENSE


def render_relief(terrain: TerrainGrid, size: int) -> Image.Image:
    z = terrain.z.astype(np.float64)
    gy, gx = np.gradient(z)
    shade = np.clip(0.55 + (-gx * 0.8 - gy * 0.8) * 0.05, 0.2, 1.0)
    lo, hi = float(np.min(z)), float(np.max(z))
    norm = (z - lo) / max(1e-9, hi - lo)
    low = np.array([78, 104, 68], dtype=np.float64)
    high = np.array([181, 164, 132], dtype=np.float64)
    rgb = low[None, None, :] + (high - low)[None, None, :] * norm[:, :, None]
    rgb *= shade[:, :, None]
    array = np.flipud(np.clip(rgb, 0, 255).astype(np.uint8))
    return Image.fromarray(array, mode="RGB").resize((size, size), Image.Resampling.BILINEAR)


def build_textures(
    bbox: BBox,
    size: int,
    buildings: list[Building],
    roads: list[RoadWay],
    data: OsmData,
    terrain: TerrainGrid,
    out_dir: Path,
    use_satellite: bool = True,
    use_labels: bool = True,
    satellite_source: str = "eox",
    satellite_layer: str = "s2cloudless-2025_3857",
    custom_satellite: Path | None = None,
    progress=None,
) -> TextureSet:
    texture_dir = Path(out_dir) / "textures"
    texture_dir.mkdir(parents=True, exist_ok=True)
    labels_img, overlay_img = render_label_textures(
        bbox,
        buildings,
        roads,
        data,
        terrain.projection,
        terrain.grid,
        size,
        include_labels=use_labels,
    )
    labels_path = texture_dir / "labels.png"
    labels_img.convert("RGB").save(labels_path, optimize=True)
    overlay_path = texture_dir / "labels_overlay.png"
    overlay_img.save(overlay_path, optimize=True)

    satellite_path: Path | None = None
    satellite_attribution: str | None = None
    satellite_license: str | None = None
    satellite_img: Image.Image | None = None
    if use_satellite:
        if progress:
            progress(0.64, "Загрузка спутниковой текстуры")
        try:
            if custom_satellite:
                satellite_img = Image.open(custom_satellite).convert("RGB")
                satellite_img = satellite_img.resize((size, size), Image.Resampling.LANCZOS)
                satellite_attribution = "Пользовательский спутниковый снимок"
                satellite_license = "по условиям пользователя"
            elif satellite_source == "eox":
                satellite_img, satellite_attribution, satellite_license = download_eox_satellite(
                    bbox, size, satellite_layer
                )
            else:
                raise RuntimeError(f"Неизвестный источник спутника: {satellite_source}")
            if satellite_img is not None:
                satellite_path = texture_dir / "satellite.jpg"
                satellite_img.save(satellite_path, quality=92, optimize=True)
        except Exception as exc:
            if progress:
                progress(0.66, f"Спутник недоступен: {exc}")
            satellite_img = None

    relief: Image.Image | None = None
    relief_path: Path | None = None
    if satellite_img is None:
        relief = render_relief(terrain, size)
        relief_path = texture_dir / "relief.jpg"
        relief.save(relief_path, quality=90, optimize=True)

    base_img = satellite_img if satellite_img is not None else relief
    hybrid_path: Path | None = None
    if base_img is not None:
        hybrid = base_img.convert("RGBA")
        hybrid.alpha_composite(overlay_img)
        hybrid_path = texture_dir / "hybrid.jpg"
        hybrid.convert("RGB").save(hybrid_path, quality=92, optimize=True)
    if progress:
        progress(0.70, "Текстуры готовы")
    return TextureSet(
        satellite=satellite_path,
        labels=labels_path,
        hybrid=hybrid_path,
        overlay=overlay_path,
        relief=relief_path,
        satellite_attribution=satellite_attribution,
        satellite_license=satellite_license,
    )
