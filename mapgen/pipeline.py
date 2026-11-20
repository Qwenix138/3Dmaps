from __future__ import annotations

import json
import re
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from . import __version__
from .buildings import build_building_mesh, extract_buildings
from .config import GenerationOptions
from .elevation import load_terrain, save_heightmap
from .errors import MapgenError
from .export import export_glb, export_obj
from .mesh import Scene, build_terrain_mesh
from .osm import fetch_osm
from .roads import build_road_mesh, extract_roads
from .textures import build_textures


def _slug(value: str) -> str:
    value = re.sub(r"[^\w.-]+", "-", value.strip(), flags=re.UNICODE)
    return value.strip("-._") or "zone"


def _progress(callback: Callable[[float, str], None] | None, value: float, message: str) -> None:
    if callback:
        callback(max(0.0, min(1.0, value)), message)


def generate(
    options: GenerationOptions,
    progress: Callable[[float, str], None] | None = None,
) -> dict:
    started = time.monotonic()
    options.validate()
    out_dir = Path(options.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    name = _slug(options.name)
    warnings: list[str] = []
    _progress(progress, 0.01, "Проверка параметров")

    terrain = load_terrain(
        options.bbox,
        spacing_m=options.terrain_spacing,
        cache_dir=options.cache_dir,
        height_scale=options.terrain_height_scale,
        smoothing=options.terrain_smoothing,
        progress=progress,
    )
    heightmap_min, heightmap_max = save_heightmap(terrain, out_dir / "heightmap.png")
    _progress(progress, 0.35, "Рельеф готов")

    data = fetch_osm(
        options.bbox,
        source=options.osm_source,
        cache_dir=options.cache_dir,
        pbf_path=options.pbf_path,
        progress=progress,
    )
    _progress(progress, 0.46, "Данные OSM загружены")

    building_list = extract_buildings(data, terrain.projection, options) if options.buildings else []
    road_list = extract_roads(data, terrain.projection, options)
    _progress(progress, 0.54, f"Здания: {len(building_list)}, дороги: {len(road_list)}")

    meshes = [build_terrain_mesh(terrain)]
    if building_list:
        meshes.append(build_building_mesh(building_list, terrain))
    if options.roads:
        meshes.append(build_road_mesh(road_list, terrain, "road"))
    if options.railways:
        meshes.append(build_road_mesh(road_list, terrain, "rail"))
    meshes = [mesh for mesh in meshes if mesh.vertices and mesh.faces]
    if not meshes:
        raise MapgenError("Не удалось построить геометрию")
    attribution = [terrain.attribution, data.attribution]
    scene = Scene(meshes, terrain.base_elevation, options.bbox.as_tuple, attribution)
    _progress(progress, 0.61, "Геометрия собрана")

    textures = build_textures(
        options.bbox,
        options.texture_size,
        building_list,
        road_list,
        data,
        terrain,
        out_dir,
        use_satellite=options.satellite,
        use_labels=options.labels,
        satellite_source=options.satellite_source,
        satellite_layer=options.satellite_layer,
        custom_satellite=options.custom_satellite,
        progress=progress,
    )
    if textures.satellite is None:
        warnings.append("Спутниковая текстура недоступна, используется relief")
    _progress(progress, 0.74, "Экспорт OBJ и GLB")

    main_variant = "satellite" if textures.satellite else ("relief" if textures.relief else "labels")
    obj_path, mtl_path = export_obj(scene, out_dir, textures, name, main_variant)
    glb_path = export_glb(scene, out_dir, textures, name, main_variant)
    files = [obj_path, mtl_path, glb_path, textures.labels, textures.overlay]
    if textures.satellite:
        files.append(textures.satellite)
    if textures.hybrid:
        files.append(textures.hybrid)
    if textures.relief:
        files.append(textures.relief)

    variants = []
    if options.bbox.area_km2 <= 25.0 and scene.triangle_count <= 900_000:
        labels_obj, _ = export_obj(
            scene, out_dir, textures, f"{name}_labels", "labels"
        )
        files.append(labels_obj)
        variants.append(labels_obj.name)
        if textures.hybrid:
            hybrid_obj, _ = export_obj(
                scene, out_dir, textures, f"{name}_hybrid", "hybrid"
            )
            files.append(hybrid_obj)
            variants.append(hybrid_obj.name)
    _progress(progress, 0.88, "Запись метаданных")

    meta = {
        "generator": f"3Dmaps {__version__}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "name": name,
        "bbox": {
            "south": options.bbox.south,
            "west": options.bbox.west,
            "north": options.bbox.north,
            "east": options.bbox.east,
        },
        "bbox_tuple_order": ["south", "west", "north", "east"],
        "area_km2": round(options.bbox.area_km2, 4),
        "size_m": [round(options.bbox.width_m, 2), round(options.bbox.height_m, 2)],
        "projection": "azimuthal equidistant, center "
        f"{options.bbox.center[0]:.8f},{options.bbox.center[1]:.8f}",
        "terrain_spacing_m": options.terrain_spacing,
        "terrain_height_scale": options.terrain_height_scale,
        "terrain_smoothing": options.terrain_smoothing,
        "terrain_shape": [terrain.grid.ny, terrain.grid.nx],
        "terrain_zoom": terrain.zoom,
        "elevation_min_m": round(terrain.min_elevation, 3),
        "elevation_max_m": round(terrain.max_elevation, 3),
        "heightmap_min": round(heightmap_min, 3),
        "heightmap_max": round(heightmap_max, 3),
        "base_elevation_m": round(terrain.base_elevation, 3),
        "texture_size": options.texture_size,
        "labels": options.labels,
        "heightmap_orientation": "north-up (row 0 = north)",
        "counts": {
            "buildings": len(building_list),
            "roads": sum(1 for road in road_list if road.material == "road"),
            "railways": sum(1 for road in road_list if road.material == "rail"),
            "triangles": scene.triangle_count,
            "osm_nodes": len(data.nodes),
            "osm_ways": len(data.ways),
            "osm_relations": len(data.relations),
        },
        "sources": {
            "osm": data.source,
            "terrain": terrain.attribution,
            "satellite": textures.satellite_attribution,
        },
        "licenses": {
            "osm": "ODbL 1.0",
            "terrain": "см. атрибуцию источника",
            "satellite": textures.satellite_license,
            "code": "MIT",
        },
        "attribution": attribution
        + ([textures.satellite_attribution] if textures.satellite_attribution else []),
        "attributions": {
            "osm": "© OpenStreetMap contributors",
            "terrain": terrain.attribution,
            "satellite": textures.satellite_attribution,
        },
        "texture_variants": {
            "satellite": textures.satellite.name if textures.satellite else None,
            "labels": textures.labels.name,
            "hybrid": textures.hybrid.name if textures.hybrid else None,
            "relief": textures.relief.name if textures.relief else None,
        },
        "object_variants": variants,
        "files": sorted({path.name for path in files if path}),
        "warnings": warnings,
        "axes": {
            "obj": "X=east, Y=north, Z=up (Blender)",
            "glb": "X=east, Y=up, Z=south (glTF)",
        },
        "elapsed_sec": None,
    }
    meta["elapsed_sec"] = round(time.monotonic() - started, 2)
    meta_path = out_dir / "meta.json"
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    files.append(meta_path)
    _progress(progress, 1.0, "Готово")
    return {
        "out_dir": str(out_dir),
        "meta": meta,
        "files": [str(path) for path in files if path and Path(path).exists()],
        "obj": str(obj_path),
        "glb": str(glb_path),
    }


def cleanup_cache(options: GenerationOptions) -> None:
    if options.keep_cache:
        return
    cache = Path(options.cache_dir)
    if cache.exists():
        shutil.rmtree(cache, ignore_errors=True)
