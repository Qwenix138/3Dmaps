from __future__ import annotations

import re
from dataclasses import dataclass, field

import numpy as np
from shapely import make_valid
from shapely.geometry import LineString, MultiLineString, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import polygonize, unary_union

from .config import LAYER_OFFSETS, GenerationOptions
from .elevation import TerrainGrid
from .geo import LocalProjection
from .mesh import MeshData, densify_polygon, multipolygon_parts, triangulate_polygon
from .osm import OsmData

WATERWAY_WIDTHS = {
    "river": 12.0,
    "stream": 4.0,
    "canal": 8.0,
    "drain": 2.5,
    "ditch": 2.0,
    "brook": 3.0,
}

WATER_AREA_VALUES = {"water", "riverbank", "dock", "boatyard"}
WATER_LANDUSE_VALUES = {"reservoir", "basin"}


@dataclass
class WaterBody:
    osm_id: str
    polygon: Polygon
    tags: dict[str, str] = field(default_factory=dict)


def _parse_width(value: str | None) -> float | None:
    if not value:
        return None
    match = re.search(r"\d+(?:[.,]\d+)?", value)
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", "."))
    except ValueError:
        return None


def _is_water_area(tags: dict[str, str]) -> bool:
    return (
        tags.get("natural") in WATER_AREA_VALUES
        or tags.get("landuse") in WATER_LANDUSE_VALUES
        or tags.get("waterway") in WATER_AREA_VALUES
    )


def _is_waterway_line(tags: dict[str, str]) -> bool:
    return tags.get("waterway") in WATERWAY_WIDTHS and not _is_water_area(tags)


def _waterway_width(tags: dict[str, str]) -> float:
    value = _parse_width(tags.get("width"))
    if value is not None and 0.5 <= value <= 500.0:
        return value
    return WATERWAY_WIDTHS.get(tags.get("waterway", ""), 4.0)


def _same_point(a: tuple[float, float], b: tuple[float, float]) -> bool:
    return abs(a[0] - b[0]) < 1e-9 and abs(a[1] - b[1]) < 1e-9


def _assemble_rings(segments: list[list[tuple[float, float]]]) -> list[list[tuple[float, float]]]:
    remaining = [list(segment) for segment in segments if len(segment) >= 2]
    rings: list[list[tuple[float, float]]] = []
    while remaining:
        ring = remaining.pop(0)
        guard = 0
        while not _same_point(ring[0], ring[-1]) and guard < len(segments) + 2:
            guard += 1
            start, end = ring[0], ring[-1]
            found = False
            for index, segment in enumerate(remaining):
                if _same_point(segment[0], segment[-1]):
                    continue
                if _same_point(segment[0], end):
                    ring.extend(segment[1:])
                elif _same_point(segment[-1], end):
                    ring.extend(reversed(segment[:-1]))
                elif _same_point(segment[0], start):
                    ring = list(reversed(segment)) + ring[1:]
                elif _same_point(segment[-1], start):
                    ring = segment + ring[1:]
                else:
                    continue
                remaining.pop(index)
                found = True
                break
            if not found:
                break
        if len(ring) >= 4 and _same_point(ring[0], ring[-1]):
            rings.append(ring)
    return rings


def _local_polygon(
    projection: LocalProjection,
    exterior: list[tuple[float, float]],
    interiors: list[list[tuple[float, float]]],
    simplify_m: float,
) -> list[Polygon]:
    if len(exterior) < 4:
        return []
    ex, ey = projection.to_local_many([p[0] for p in exterior], [p[1] for p in exterior])
    ext = list(zip(ex.tolist(), ey.tolist()))
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
        result: list[Polygon] = []
        for part in multipolygon_parts(polygon):
            if part.is_empty:
                continue
            part = make_valid(part)
            for cleaned in multipolygon_parts(part):
                if cleaned.area >= 1.0:
                    result.append(orient(cleaned, sign=1.0))
        return result
    except Exception:
        return []


def _relation_polygons(
    data: OsmData,
    relation,
    projection: LocalProjection,
    simplify_m: float,
) -> tuple[list[Polygon], set[int]]:
    outer_segments: list[list[tuple[float, float]]] = []
    inner_segments: list[list[tuple[float, float]]] = []
    used: set[int] = set()
    for kind, ref, role in relation.members:
        if kind != "way":
            continue
        way = data.ways.get(ref)
        if way is None:
            continue
        coords = data.way_coords(way)
        if len(coords) < 2:
            continue
        (inner_segments if role == "inner" else outer_segments).append(coords)
        used.add(ref)
    outer = _assemble_rings(outer_segments)
    inner = _assemble_rings(inner_segments)
    if not outer:
        return [], used
    try:
        outer_lines = MultiLineString([LineString(ring) for ring in outer])
        outer_polys = list(polygonize(unary_union(outer_lines)))
        if not outer_polys:
            return [], used
        geometry = unary_union(outer_polys)
        if inner:
            inner_lines = MultiLineString([LineString(ring) for ring in inner])
            inner_polys = list(polygonize(unary_union(inner_lines)))
            if inner_polys:
                geometry = geometry.difference(unary_union(inner_polys))
        if not geometry.is_valid:
            geometry = make_valid(geometry)
        result: list[Polygon] = []
        for part in multipolygon_parts(geometry):
            if part.is_empty:
                continue
            ext = list(part.exterior.coords)
            holes = [list(ring.coords) for ring in part.interiors]
            result.extend(_local_polygon(projection, ext, holes, simplify_m))
        return result, used
    except Exception:
        return [], used


def extract_water(
    data: OsmData,
    projection: LocalProjection,
    options: GenerationOptions,
) -> list[WaterBody]:
    result: list[WaterBody] = []
    relation_way_ids: set[int] = set()

    for way in data.ways.values():
        tags = way.tags
        if not (_is_water_area(tags) or _is_waterway_line(tags)):
            continue
        if tags.get("tunnel") in ("yes", "culvert"):
            continue
        coords_geo = data.way_coords(way)
        if len(coords_geo) < 2:
            continue
        if _is_water_area(tags):
            if len(coords_geo) < 4:
                continue
            coords = coords_geo + ([] if coords_geo[0] == coords_geo[-1] else [coords_geo[0]])
            for polygon in _local_polygon(
                projection, coords, [], max(0.1, options.simplify_m)
            ):
                result.append(WaterBody(f"way/{way.id}", polygon, tags))
            continue
        xs, ys = projection.to_local_many(
            [p[0] for p in coords_geo], [p[1] for p in coords_geo]
        )
        local = list(zip(xs.tolist(), ys.tolist()))
        if len(local) < 2:
            continue
        try:
            polygon = LineString(local).buffer(
                _waterway_width(tags) / 2.0,
                cap_style=2,
                join_style=2,
                quad_segs=2,
            )
            if not polygon.is_empty:
                result.append(
                    WaterBody(f"way/{way.id}", orient(polygon, sign=1.0), tags)
                )
        except Exception:
            continue

    for relation in data.relations.values():
        tags = relation.tags
        if not _is_water_area(tags):
            continue
        polygons, used = _relation_polygons(
            data, relation, projection, max(0.1, options.simplify_m)
        )
        for polygon in polygons:
            result.append(WaterBody(f"relation/{relation.id}", polygon, tags))
        relation_way_ids.update(used)

    if relation_way_ids:
        relation_ids = {f"way/{way_id}" for way_id in relation_way_ids}
        result = [body for body in result if body.osm_id not in relation_ids]
    return result


def build_water_mesh(
    water: list[WaterBody],
    terrain: TerrainGrid,
    offset_m: float = LAYER_OFFSETS["water"],
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
    spacing = (grid.x_max - grid.x_min) / max(1, grid.nx - 1)
    max_step = max(4.0, min(20.0, spacing * 0.75))
    mesh = MeshData("water", "water")
    for body in water:
        try:
            clipped = body.polygon.intersection(clip)
        except Exception:
            continue
        for polygon in multipolygon_parts(clipped):
            if polygon.is_empty or polygon.area < 1.0:
                continue
            polygon = densify_polygon(orient(polygon, sign=1.0), max_step)
            triangulated = triangulate_polygon(polygon)
            if triangulated is None:
                continue
            flat, triangles = triangulated
            xs = np.asarray([p[0] for p in flat])
            ys = np.asarray([p[1] for p in flat])
            zs = terrain.sample(xs, ys) - terrain.base_elevation + offset_m
            vertices = [(x, y, z) for (x, y), z in zip(flat, zs.tolist())]
            mesh.add_triangles(vertices, [tuple(t) for t in triangles])
    mesh.finalize_normals()
    return mesh
