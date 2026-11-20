from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import DEFAULT_TERRAIN_SPACING, DEFAULT_TEXTURE_SIZE, BBox, GenerationOptions
from .errors import MapgenError
from .geo import meters_to_bbox
from .pipeline import generate


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="3dmapgen",
        description="Генератор 3D-участков карты из OpenStreetMap и открытых DEM",
    )
    parser.add_argument("--bbox", help="south,west,north,east")
    parser.add_argument("--center", help="lat,lon центра участка")
    parser.add_argument("--size-km", help="ширина,высота в километрах или одно число")
    parser.add_argument("--name", default="zone")
    parser.add_argument("--out", default=None)
    parser.add_argument("--cache", default="cache")
    parser.add_argument("--terrain-spacing", type=float, default=DEFAULT_TERRAIN_SPACING)
    parser.add_argument("--texture-size", type=int, default=DEFAULT_TEXTURE_SIZE)
    parser.add_argument("--satellite-layer", default="s2cloudless-2025_3857")
    parser.add_argument("--satellite-source", default="eox")
    parser.add_argument("--custom-satellite", default=None)
    parser.add_argument("--osm-source", default="auto", choices=["auto", "api", "overpass", "pbf"])
    parser.add_argument("--pbf", default=None)
    parser.add_argument("--no-satellite", action="store_true")
    parser.add_argument("--no-labels", action="store_true")
    parser.add_argument("--no-buildings", action="store_true")
    parser.add_argument("--no-roads", action="store_true")
    parser.add_argument("--no-railways", action="store_true")
    parser.add_argument("--no-water", action="store_true")
    parser.add_argument("--simplify", type=float, default=0.35)
    parser.add_argument("--height-scale", type=float, default=1.0)
    parser.add_argument("--smoothing", type=int, choices=[0, 1, 2], default=0, help="сглаживание DEM: 0/1/2")
    parser.add_argument("--json", action="store_true")
    return parser


def _bbox_from_args(args: argparse.Namespace) -> BBox:
    if args.bbox:
        return BBox.parse(args.bbox)
    if not args.center:
        raise MapgenError("Укажи --bbox или --center + --size-km")
    parts = args.center.replace(";", ",").split(",")
    if len(parts) != 2:
        raise MapgenError("--center задаётся как lat,lon")
    lat, lon = float(parts[0]), float(parts[1])
    size_parts = (args.size_km or "2").replace(";", ",").split(",")
    if len(size_parts) == 1:
        width_km = height_km = float(size_parts[0])
    elif len(size_parts) == 2:
        width_km, height_km = float(size_parts[0]), float(size_parts[1])
    else:
        raise MapgenError("--size-km задаётся как ширина,высота")
    return meters_to_bbox(lat, lon, width_km * 1000.0, height_km * 1000.0)


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        bbox = _bbox_from_args(args)
        name = args.name
        out_dir = Path(args.out) if args.out else Path("output") / name
        options = GenerationOptions(
            bbox=bbox,
            out_dir=out_dir,
            name=name,
            terrain_spacing=args.terrain_spacing,
            texture_size=args.texture_size,
            buildings=not args.no_buildings,
            roads=not args.no_roads,
            railways=not args.no_railways,
            water=not args.no_water,
            labels=not args.no_labels,
            satellite=not args.no_satellite,
            satellite_source=args.satellite_source,
            satellite_layer=args.satellite_layer,
            custom_satellite=Path(args.custom_satellite) if args.custom_satellite else None,
            terrain_height_scale=args.height_scale,
            terrain_smoothing=args.smoothing,
            simplify_m=args.simplify,
            osm_source=args.osm_source,
            pbf_path=Path(args.pbf) if args.pbf else None,
            cache_dir=Path(args.cache),
        )
        options.validate()
        if not args.json:
            print(f"Зона: {bbox.as_string} ({bbox.area_km2:.2f} км²)")
            print(f"Выход: {out_dir}")
        result = generate(
            options,
            progress=None
            if args.json
            else (lambda percent, message: print(f"[{percent * 100:5.1f}%] {message}")),
        )
        if args.json:
            print(json.dumps(result["meta"], ensure_ascii=False, indent=2))
        else:
            print(f"OBJ: {result['obj']}")
            print(f"GLB: {result['glb']}")
            print(f"Метаданные: {out_dir / 'meta.json'}")
            for warning in result["meta"].get("warnings", []):
                print(f"Предупреждение: {warning}")
        return 0
    except (MapgenError, ValueError, OSError) as exc:
        print(f"Ошибка: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
