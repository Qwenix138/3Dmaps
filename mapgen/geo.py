from __future__ import annotations

import math
from dataclasses import dataclass
from typing import TYPE_CHECKING, Iterable

import numpy as np
from pyproj import CRS, Geod, Transformer

from .errors import ValidationError

if TYPE_CHECKING:
    from .config import BBox

WGS84 = CRS.from_epsg(4326)
WEB_MERCATOR = CRS.from_epsg(3857)
GEOD = Geod(ellps="WGS84")


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return float(GEOD.inv(lon1, lat1, lon2, lat2)[2])


def web_mercator_xyz(lon: float, lat: float, zoom: int, tile_size: int = 256) -> tuple[float, float]:
    lat = max(-85.05112878, min(85.05112878, lat))
    n = tile_size * (2**zoom)
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def web_mercator_meters(lon: float, lat: float) -> tuple[float, float]:
    lat = max(-85.05112878, min(85.05112878, lat))
    x = 6378137.0 * math.radians(lon)
    y = 6378137.0 * math.log(math.tan(math.pi / 4.0 + math.radians(lat) / 2.0))
    return x, y


def tile_zoom_for_spacing(lat: float, spacing_m: float, min_zoom: int = 8, max_zoom: int = 14) -> int:
    target = max(1.0, spacing_m)
    best = min_zoom
    for zoom in range(min_zoom, max_zoom + 1):
        resolution = 156543.03392 * math.cos(math.radians(lat)) / (2**zoom)
        best = zoom
        if resolution <= target:
            return zoom
    return best


@dataclass
class LocalProjection:
    center_lat: float
    center_lon: float

    def __post_init__(self) -> None:
        proj4 = (
            f"+proj=aeqd +lat_0={self.center_lat:.12f} +lon_0={self.center_lon:.12f} "
            "+datum=WGS84 +units=m +no_defs"
        )
        self._crs = CRS.from_proj4(proj4)
        self._to_local = Transformer.from_crs(WGS84, self._crs, always_xy=True)
        self._to_wgs = Transformer.from_crs(self._crs, WGS84, always_xy=True)

    def to_local(self, lon: float, lat: float) -> tuple[float, float]:
        return self._to_local.transform(lon, lat)

    def to_geo(self, x: float, y: float) -> tuple[float, float]:
        return self._to_wgs.transform(x, y)

    def to_local_many(self, lons: Iterable[float], lats: Iterable[float]) -> tuple[np.ndarray, np.ndarray]:
        return self._to_local.transform(np.asarray(lons), np.asarray(lats))

    def to_geo_many(self, xs: Iterable[float], ys: Iterable[float]) -> tuple[np.ndarray, np.ndarray]:
        return self._to_wgs.transform(np.asarray(xs), np.asarray(ys))


@dataclass
class Grid:
    xs: np.ndarray
    ys: np.ndarray
    x_min: float
    x_max: float
    y_min: float
    y_max: float

    @property
    def nx(self) -> int:
        return int(self.xs.size)

    @property
    def ny(self) -> int:
        return int(self.ys.size)

    def pixel_uv(self, x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        u = (np.asarray(x) - self.x_min) / (self.x_max - self.x_min)
        v = (np.asarray(y) - self.y_min) / (self.y_max - self.y_min)
        return u, v


def make_grid(bbox: "BBox", spacing_m: float, margin_m: float = 0.0) -> tuple[LocalProjection, Grid]:
    projection = LocalProjection(*bbox.center)
    corners_lon = [bbox.west, bbox.east, bbox.east, bbox.west]
    corners_lat = [bbox.south, bbox.south, bbox.north, bbox.north]
    xs, ys = projection.to_local_many(corners_lon, corners_lat)
    x_min = float(np.min(xs)) - margin_m
    x_max = float(np.max(xs)) + margin_m
    y_min = float(np.min(ys)) - margin_m
    y_max = float(np.max(ys)) + margin_m
    nx = max(2, int(math.ceil((x_max - x_min) / spacing_m)) + 1)
    ny = max(2, int(math.ceil((y_max - y_min) / spacing_m)) + 1)
    return projection, Grid(
        np.linspace(x_min, x_max, nx, dtype=np.float64),
        np.linspace(y_min, y_max, ny, dtype=np.float64),
        x_min,
        x_max,
        y_min,
        y_max,
    )


def bbox_polygon(bbox: "BBox"):
    from shapely.geometry import Polygon

    poly = Polygon(
        [
            (bbox.west, bbox.south),
            (bbox.east, bbox.south),
            (bbox.east, bbox.north),
            (bbox.west, bbox.north),
        ]
    )
    return poly


def meters_to_bbox(center_lat: float, center_lon: float, width_m: float, height_m: float) -> "BBox":
    from .config import BBox

    if width_m <= 0 or height_m <= 0:
        raise ValidationError("Размеры зоны должны быть положительными")
    lat_pad = height_m / 2.0 / 111_320.0
    lon_pad = width_m / 2.0 / max(1.0, 111_320.0 * math.cos(math.radians(center_lat)))
    return BBox(
        center_lat - lat_pad,
        center_lon - lon_pad,
        center_lat + lat_pad,
        center_lon + lon_pad,
    )
