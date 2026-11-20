from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from shapely.geometry import LineString, Polygon
from shapely.geometry.polygon import orient

from .config import LAYER_OFFSETS, GenerationOptions
from .elevation import TerrainGrid
from .geo import LocalProjection
from .mesh import MeshData, densify_coords, densify_polygon, multipolygon_parts, triangulate_polygon
from .osm import OsmData

ROAD_WIDTHS = {
    "motorway": 15.0,
    "motorway_link": 8.0,
    "trunk": 14.0,
    "trunk_link": 8.0,
    "primary": 11.0,
    "primary_link": 7.0,
    "secondary": 9.0,
    "secondary_link": 6.0,
    "tertiary": 7.0,
    "tertiary_link": 5.0,
    "residential": 5.5,
    "unclassified": 5.0,
    "living_street": 5.0,
    "service": 3.5,
    "pedestrian": 4.0,
    "track": 3.0,
    "footway": 2.0,
    "path": 1.8,
    "cycleway": 2.0,
}

RAIL_WIDTHS = {
    "rail": 3.0,
    "light_rail": 2.8,
    "subway": 2.8,
    "tram": 2.6,
    "narrow_gauge": 2.4,
    "preserved": 2.6,
}


@dataclass
class RoadWay:
    osm_id: str
    coords: list[tuple[float, float]]
    width: float
    material: str
    tags: dict[str, str]


def extract_roads(
    data: OsmData,
    projection: LocalProjection,
    options: GenerationOptions,
) -> list[RoadWay]:
    result: list[RoadWay] = []
    for way in data.ways.values():
        tags = way.tags
        material = ""
        width = 0.0
        if tags.get("highway"):
            kind = tags["highway"]
            if kind in ("construction", "proposed", "raceway"):
                continue
            width = ROAD_WIDTHS.get(kind, 4.0)
            material = "road"
        elif tags.get("railway"):
            kind = tags["railway"]
            if kind in ("proposed", "construction", "platform"):
                continue
            width = RAIL_WIDTHS.get(kind, 2.8)
            material = "rail"
        else:
            continue
        if material == "road" and not options.roads:
            continue
        if material == "rail" and not options.railways:
            continue
        if tags.get("tunnel") in ("yes", "building_passage"):
            continue
        coords_geo = data.way_coords(way)
        if len(coords_geo) < 2:
            continue
        xs, ys = projection.to_local_many(
            [p[0] for p in coords_geo], [p[1] for p in coords_geo]
        )
        coords = list(zip(xs.tolist(), ys.tolist()))
        if len(coords) >= 2:
            result.append(RoadWay(f"way/{way.id}", coords, width, material, tags))
    return result


def build_road_mesh(
    roads: list[RoadWay],
    terrain: TerrainGrid,
    material: str,
    offset_m: float | None = None,
) -> MeshData:
    grid = terrain.grid
    clip = Polygon(
        [
            (grid.x_min, grid.y_min),
            (grid.x_max, grid.y_min),
            (grid.x_max, grid.y_max),
            (grid.x_min, grid.y_max),
        ]
    )
    if offset_m is None:
        offset_m = LAYER_OFFSETS["rail"] if material == "rail" else LAYER_OFFSETS["road"]
    spacing = (grid.x_max - grid.x_min) / max(1, grid.nx - 1)
    max_step = max(4.0, min(20.0, spacing * 0.75))
    mesh = MeshData("roads" if material == "road" else "railways", material)
    for road in roads:
        if road.material != material:
            continue
        try:
            line = LineString(densify_coords(road.coords, max_step))
            if line.length <= 0.1:
                continue
            polygon = line.buffer(
                road.width / 2.0,
                cap_style=2,
                join_style=2,
                quad_segs=1,
            )
            if polygon.is_empty:
                continue
            try:
                polygon = polygon.intersection(clip)
            except Exception:
                continue
            for part in multipolygon_parts(polygon):
                if part.area < 0.5:
                    continue
                part = densify_polygon(orient(part, sign=1.0), max_step)
                triangulated = triangulate_polygon(part)
                if triangulated is None:
                    continue
                flat, triangles = triangulated
                xs = np.asarray([p[0] for p in flat])
                ys = np.asarray([p[1] for p in flat])
                elevations = terrain.sample(xs, ys) - terrain.base_elevation
                zs = elevations + offset_m
                vertices = [(x, y, z) for (x, y), z in zip(flat, zs.tolist())]
                mesh.add_triangles(vertices, [tuple(t) for t in triangles])
        except Exception:
            continue
    mesh.finalize_normals()
    return mesh
