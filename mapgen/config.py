from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path

from .errors import ValidationError
from .geo import haversine_m

MAX_AREA_KM2 = 500.0
DEFAULT_TERRAIN_SPACING = 30.0
DEFAULT_TEXTURE_SIZE = 4096
MAX_TERRAIN_CELLS = 1_600_000


@dataclass(frozen=True)
class BBox:
    south: float
    west: float
    north: float
    east: float

    def validate(self) -> None:
        if not (-90 <= self.south < self.north <= 90):
            raise ValidationError("Широта должна быть в пределах -90..90, south < north")
        if not (-180 <= self.west < self.east <= 180):
            raise ValidationError("Долгота должна быть в пределах -180..180, west < east")
        if self.area_km2 > MAX_AREA_KM2:
            raise ValidationError(
                f"Площадь {self.area_km2:.1f} км² больше лимита {MAX_AREA_KM2:.0f} км²"
            )

    @property
    def center(self) -> tuple[float, float]:
        return ((self.south + self.north) / 2, (self.west + self.east) / 2)

    @property
    def lat_span(self) -> float:
        return self.north - self.south

    @property
    def lon_span(self) -> float:
        return self.east - self.west

    @property
    def width_m(self) -> float:
        return haversine_m(self.center[0], self.west, self.center[0], self.east)

    @property
    def height_m(self) -> float:
        return haversine_m(self.south, self.center[1], self.north, self.center[1])

    @property
    def area_km2(self) -> float:
        return self.width_m * self.height_m / 1_000_000.0

    @property
    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.south, self.west, self.north, self.east)

    @property
    def as_string(self) -> str:
        return ",".join(f"{v:.8f}" for v in self.as_tuple)

    @classmethod
    def parse(cls, value: str) -> "BBox":
        parts = [p.strip() for p in value.replace(";", ",").split(",")]
        if len(parts) != 4:
            raise ValidationError("bbox задаётся как south,west,north,east")
        try:
            bbox = cls(*(float(p) for p in parts))
        except ValueError as exc:
            raise ValidationError("bbox содержит нечисловые значения") from exc
        bbox.validate()
        return bbox

    def contains(self, lat: float, lon: float) -> bool:
        return self.south <= lat <= self.north and self.west <= lon <= self.east

    def expanded(self, meters: float) -> "BBox":
        lat_pad = meters / 111_320.0
        lon_pad = meters / max(1.0, 111_320.0 * math.cos(math.radians(self.center[0])))
        return BBox(
            max(-90.0, self.south - lat_pad),
            max(-180.0, self.west - lon_pad),
            min(90.0, self.north + lat_pad),
            min(180.0, self.east + lon_pad),
        )


@dataclass
class GenerationOptions:
    bbox: BBox
    out_dir: Path
    name: str = "zone"
    terrain_spacing: float = DEFAULT_TERRAIN_SPACING
    texture_size: int = DEFAULT_TEXTURE_SIZE
    buildings: bool = True
    roads: bool = True
    railways: bool = True
    labels: bool = True
    satellite: bool = True
    satellite_source: str = "eox"
    satellite_layer: str = "s2cloudless-2025_3857"
    custom_satellite: Path | None = None
    terrain_height_scale: float = 1.0
    terrain_smoothing: int = 0
    simplify_m: float = 0.35
    max_buildings: int = 250_000
    osm_source: str = "auto"
    pbf_path: Path | None = None
    cache_dir: Path = field(default_factory=lambda: Path("cache"))
    keep_cache: bool = True

    def validate(self) -> None:
        self.bbox.validate()
        if not (5.0 <= self.terrain_spacing <= 120.0):
            raise ValidationError("terrain_spacing должен быть 5..120 м")
        if not (0.5 <= self.terrain_height_scale <= 5.0):
            raise ValidationError("terrain_height_scale должен быть 0.5..5.0")
        if self.terrain_smoothing not in (0, 1, 2):
            raise ValidationError("terrain_smoothing должен быть 0, 1 или 2")
        if self.texture_size < 256 or self.texture_size > 8192:
            raise ValidationError("texture_size должен быть 256..8192")
        if not (0.0 <= self.simplify_m <= 5.0):
            raise ValidationError("simplify_m должен быть 0..5 м")
        nx = max(2, int(math.ceil(self.bbox.width_m / self.terrain_spacing)) + 1)
        ny = max(2, int(math.ceil(self.bbox.height_m / self.terrain_spacing)) + 1)
        if nx * ny > MAX_TERRAIN_CELLS:
            raise ValidationError(
                f"Сетка {nx}x{ny} слишком большая; увеличь terrain_spacing"
            )

    @property
    def terrain_shape(self) -> tuple[int, int]:
        nx = max(2, int(math.ceil(self.bbox.width_m / self.terrain_spacing)) + 1)
        ny = max(2, int(math.ceil(self.bbox.height_m / self.terrain_spacing)) + 1)
        return ny, nx
