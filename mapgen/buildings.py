from __future__ import annotations

import re
from dataclasses import dataclass, field

import numpy as np
from shapely import make_valid
from shapely.geometry import LineString, MultiLineString, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import polygonize, unary_union

from .config import BUILDING_FOUNDATION_M, GenerationOptions
from .elevation import TerrainGrid
from .errors import ValidationError
from .geo import LocalProjection
from .mesh import MeshData, clamp_height, multipolygon_parts, triangulate_polygon
from .osm import OsmData

DEFAULT_HEIGHTS = {
    "house": 7.0,
    "detached": 7.0,
    "residential": 15.0,
    "apartments": 24.0,
    "commercial": 12.0,
    "retail": 8.0,
    "industrial": 10.0,
    "warehouse": 9.0,
    "garage": 3.0,
    "garages": 3.0,
    "shed": 3.0,
    "school": 10.0,
    "hospital": 18.0,
    "church": 15.0,
    "cathedral": 25.0,
    "hotel": 20.0,
    "office": 20.0,
    "service": 5.0,
    "yes": 8.0,
}


@dataclass
class Building:
    osm_id: str
    polygon: Polygon
    height: float
    tags: dict[str, str] = field(default_factory=dict)


def parse_number(value: str | None) -> float | None:
    if not value:
        return None
    match = re.search(r"-?\d+(?:[.,]\d+)?", value)
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", "."))
    except ValueError:
        return None


def building_height(tags: dict[str, str]) -> float:
    height = parse_number(tags.get("height") or tags.get("building:height"))
    if height is not None:
        if "ft" in (tags.get("height") or "").lower() or "'" in (tags.get("height") or ""):
            height *= 0.3048
        return clamp_height(height)
    levels = parse_number(tags.get("building:levels") or tags.get("levels"))
    if levels is not None and levels > 0:
        roof = parse_number(tags.get("roof:height")) or 0.0
        return clamp_height(levels * 3.1 + 0.7 + roof)
    kind = (tags.get("building") or tags.get("building:part") or "yes").lower()
    return clamp_height(DEFAULT_HEIGHTS.get(kind, 8.0))


def _local_polygon(
    projection: LocalProjection,
    exterior: list[tuple[float, float]],
    interiors: list[list[tuple[float, float]]],
    simplify_m: float,
) -> list[Polygon]:
    if len(exterior) < 4:
        return []
    lons = [p[0] for p in exterior]
    lats = [p[1] for p in exterior]
    xs, ys = projection.to_local_many(lons, lats)
    ext = list(zip(xs.tolist(), ys.tolist()))
    holes = []
    for ring in interiors:
        if len(ring) < 4:
            continue
        hx, hy = projection.to_local_many([p[0] for p in ring], [p[1] for p in ring])
        holes.append(list(zip(hx.tolist(), hy.tolist())))
    try:
        polygon = Polygon(ext, holes)
        if not polygon.is_valid:
            polygon = make_valid(polygon)
        if simplify_m > 0:
            polygon = polygon.simplify(simplify_m, preserve_topology=True)
        result = []
        for part in multipolygon_parts(polygon):
            if part.is_empty:
                continue
            part = make_valid(part)
            for cleaned in multipolygon_parts(part):
                if cleaned.area >= 4.0:
                    result.append(orient(cleaned, sign=1.0))
        return result
    except Exception:
        return []


def extract_buildings(
    data: OsmData,
    projection: LocalProjection,
    options: GenerationOptions,
) -> list[Building]:
    result: list[Building] = []
    relation_way_ids: set[int] = set()
    for way in data.ways.values():
        if "building" not in way.tags and "building:part" not in way.tags:
            continue
        if way.tags.get("building") == "no":
            continue
        coords = data.way_coords(way)
        if len(coords) < 4:
            continue
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        parts = _local_polygon(projection, coords, [], options.simplify_m)
        for polygon in parts:
            result.append(
                Building(f"way/{way.id}", polygon, building_height(way.tags), way.tags)
            )

    for relation in data.relations.values():
        tags = relation.tags
        if not (tags.get("building") or tags.get("building:part")):
            continue
        if tags.get("building") == "no":
            continue
        outer: list[list[tuple[float, float]]] = []
        inner: list[list[tuple[float, float]]] = []
        used_refs: set[int] = set()
        for kind, ref, role in relation.members:
            if kind != "way":
                continue
            way = data.ways.get(ref)
            if way is None:
                continue
            coords = data.way_coords(way)
            if len(coords) < 4:
                continue
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            if role == "inner":
                inner.append(coords)
            else:
                outer.append(coords)
            used_refs.add(ref)
        if not outer:
            continue
        try:
            outer_lines = MultiLineString([LineString(ring) for ring in outer])
            outer_polys = list(polygonize(unary_union(outer_lines)))
            if not outer_polys:
                continue
            geometry = unary_union(outer_polys)
            if inner:
                inner_lines = MultiLineString([LineString(ring) for ring in inner])
                inner_polys = list(polygonize(unary_union(inner_lines)))
                if inner_polys:
                    geometry = geometry.difference(unary_union(inner_polys))
            if not geometry.is_valid:
                geometry = make_valid(geometry)
            for polygon in multipolygon_parts(geometry):
                if polygon.is_empty:
                    continue
                ext = list(polygon.exterior.coords)
                holes = [list(ring.coords) for ring in polygon.interiors]
                for part in _local_polygon(projection, ext, holes, options.simplify_m):
                    result.append(
                        Building(
                            f"relation/{relation.id}",
                            part,
                            building_height(tags),
                            tags,
                        )
                    )
                    relation_way_ids.update(used_refs)
        except Exception:
            continue

    if relation_way_ids:
        relation_ids = {f"way/{way_id}" for way_id in relation_way_ids}
        result = [building for building in result if building.osm_id not in relation_ids]

    if len(result) > options.max_buildings:
        raise ValidationError(
            f"Слишком много зданий: {len(result)}; уменьши зону или увеличь max_buildings"
        )
    return result


def build_building_mesh(
    buildings: list[Building],
    terrain: TerrainGrid,
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
    mesh = MeshData("buildings", "building")
    for building in buildings:
        try:
            clipped = building.polygon.intersection(clip)
        except Exception:
            continue
        for polygon in multipolygon_parts(clipped):
            if polygon.is_empty or polygon.area < 4.0:
                continue
            polygon = orient(polygon, sign=1.0)
            triangulated = triangulate_polygon(polygon)
            if triangulated is None:
                continue
            flat, triangles = triangulated
            exterior_ring = list(polygon.exterior.coords)
            sample_x = [p[0] for p in exterior_ring]
            sample_y = [p[1] for p in exterior_ring]
            elevations = terrain.sample(np.asarray(sample_x), np.asarray(sample_y))
            ground_z = float(np.min(elevations)) - terrain.base_elevation
            base_z = ground_z - BUILDING_FOUNDATION_M
            top_z = ground_z + building.height

            top_vertices = [(p[0], p[1], top_z) for p in flat]
            top_faces = [tuple(t) for t in triangles]
            mesh.add_triangles(top_vertices, top_faces)

            for ring in [polygon.exterior, *polygon.interiors]:
                coords = list(ring.coords)
                if len(coords) < 4:
                    continue
                for a, b in zip(coords[:-1], coords[1:]):
                    if a == b:
                        continue
                    mesh.add_quad(
                        (a[0], a[1], base_z),
                        (b[0], b[1], base_z),
                        (b[0], b[1], top_z),
                        (a[0], a[1], top_z),
                    )
    mesh.finalize_normals()
    return mesh
