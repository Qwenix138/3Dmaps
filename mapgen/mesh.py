from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

import numpy as np
import mapbox_earcut as earcut
from shapely.geometry import MultiPolygon, Polygon

from .elevation import TerrainGrid
from .geo import web_mercator_meters
from .errors import ValidationError


@dataclass
class MeshData:
    name: str
    material: str
    vertices: list[tuple[float, float, float]] = field(default_factory=list)
    faces: list[tuple[int, ...]] = field(default_factory=list)
    uvs: list[tuple[float, float]] | None = None
    normals: list[tuple[float, float, float]] | None = None

    def add_triangles(
        self,
        vertices: Iterable[tuple[float, float, float]],
        triangles: Iterable[tuple[int, ...]],
        uvs: Iterable[tuple[float, float]] | None = None,
    ) -> None:
        verts = list(vertices)
        offset = len(self.vertices)
        self.vertices.extend(verts)
        self.faces.extend(tuple(i + offset for i in tri) for tri in triangles)
        if uvs is not None:
            if self.uvs is None:
                self.uvs = []
            self.uvs.extend(uvs)

    def add_quad(
        self,
        a: tuple[float, float, float],
        b: tuple[float, float, float],
        c: tuple[float, float, float],
        d: tuple[float, float, float],
    ) -> None:
        offset = len(self.vertices)
        self.vertices.extend([a, b, c, d])
        self.faces.append((offset, offset + 1, offset + 2))
        self.faces.append((offset, offset + 2, offset + 3))

    def finalize_normals(self) -> None:
        if not self.vertices or not self.faces:
            self.normals = []
            return
        verts = np.asarray(self.vertices, dtype=np.float64)
        normals = np.zeros_like(verts)
        for face in self.faces:
            if len(face) < 3:
                continue
            p0 = verts[face[0]]
            for i in range(1, len(face) - 1):
                p1 = verts[face[i]]
                p2 = verts[face[i + 1]]
                n = np.cross(p1 - p0, p2 - p0)
                length = np.linalg.norm(n)
                if length > 1e-12:
                    normals[face[0]] += n / length
                    normals[face[i]] += n / length
                    normals[face[i + 1]] += n / length
        lengths = np.linalg.norm(normals, axis=1)
        lengths[lengths < 1e-12] = 1.0
        normals /= lengths[:, None]
        self.normals = [tuple(v) for v in normals.tolist()]


@dataclass
class Scene:
    meshes: list[MeshData]
    base_elevation: float
    bbox: tuple[float, float, float, float]
    attribution: list[str]

    def mesh(self, name: str) -> MeshData | None:
        for item in self.meshes:
            if item.name == name:
                return item
        return None

    @property
    def triangle_count(self) -> int:
        return sum(len(mesh.faces) for mesh in self.meshes)


def densify_coords(
    coords: list[tuple[float, float]],
    max_step: float,
) -> list[tuple[float, float]]:
    if len(coords) < 2 or max_step <= 0:
        return list(coords)
    result = [coords[0]]
    step = max(0.5, float(max_step))
    for start, end in zip(coords[:-1], coords[1:]):
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        length = float(np.hypot(dx, dy))
        count = max(1, int(np.ceil(length / step)))
        for index in range(1, count + 1):
            t = index / count
            point = (start[0] + dx * t, start[1] + dy * t)
            if point != result[-1]:
                result.append(point)
    return result


def densify_ring(
    coords: list[tuple[float, float]],
    max_step: float,
) -> list[tuple[float, float]]:
    ring = _clean_ring(list(coords))
    if len(ring) < 3:
        return ring
    return _clean_ring(densify_coords(ring + [ring[0]], max_step))


def densify_polygon(polygon: Polygon, max_step: float) -> Polygon:
    exterior = densify_ring(list(polygon.exterior.coords), max_step)
    if len(exterior) < 3:
        return polygon
    holes = []
    for interior in polygon.interiors:
        ring = densify_ring(list(interior.coords), max_step)
        if len(ring) >= 3:
            holes.append(ring)
    try:
        result = Polygon(exterior, holes)
        return result if result.is_valid else polygon
    except Exception:
        return polygon


def _clean_ring(coords: list[tuple[float, float]]) -> list[tuple[float, float]]:
    result: list[tuple[float, float]] = []
    for point in coords:
        if not result or point != result[-1]:
            result.append(point)
    if len(result) > 2 and result[0] == result[-1]:
        result.pop()
    return result


def triangulate_polygon(polygon: Polygon) -> tuple[list[tuple[float, float]], list[tuple[int, int, int]]] | None:
    rings: list[list[tuple[float, float]]] = []
    exterior = _clean_ring(list(polygon.exterior.coords))
    if len(exterior) < 3:
        return None
    rings.append(exterior)
    for interior in polygon.interiors:
        ring = _clean_ring(list(interior.coords))
        if len(ring) >= 3:
            rings.append(ring)
    flat: list[tuple[float, float]] = []
    ends: list[int] = []
    for ring in rings:
        flat.extend(ring)
        ends.append(len(flat))
    try:
        indices = earcut.triangulate_float64(
            np.asarray(flat, dtype=np.float64),
            np.asarray(ends, dtype=np.uint32),
        )
    except Exception:
        return None
    if indices.size < 3:
        return None
    triangles = [
        (int(indices[i]), int(indices[i + 1]), int(indices[i + 2]))
        for i in range(0, len(indices), 3)
        if len({int(indices[i]), int(indices[i + 1]), int(indices[i + 2])}) == 3
    ]
    return flat, triangles


def build_terrain_mesh(terrain: TerrainGrid) -> MeshData:
    grid = terrain.grid
    xx, yy = np.meshgrid(grid.xs, grid.ys)
    z = terrain.z.astype(np.float64)
    vertices = np.column_stack((xx.ravel(), yy.ravel(), z.ravel()))
    faces: list[tuple[int, int, int]] = []
    for j in range(grid.ny - 1):
        for i in range(grid.nx - 1):
            a = j * grid.nx + i
            b = a + 1
            c = a + grid.nx + 1
            d = a + grid.nx
            faces.append((a, b, c))
            faces.append((a, c, d))
    if terrain.bbox is not None:
        lons, lats = terrain.projection.to_geo_many(xx.ravel(), yy.ravel())
        west, south = web_mercator_meters(terrain.bbox.west, terrain.bbox.south)
        east, north = web_mercator_meters(terrain.bbox.east, terrain.bbox.north)
        mx = 6378137.0 * np.radians(lons)
        my = 6378137.0 * np.log(np.tan(np.pi / 4.0 + np.radians(lats) / 2.0))
        u = (mx - west) / max(1e-9, east - west)
        v = (my - south) / max(1e-9, north - south)
    else:
        u = (xx - grid.x_min) / max(1e-9, grid.x_max - grid.x_min)
        v = (yy - grid.y_min) / max(1e-9, grid.y_max - grid.y_min)
    uvs = np.column_stack((u.ravel(), v.ravel()))
    dz_dy, dz_dx = np.gradient(z, grid.ys, grid.xs, edge_order=1)
    normals = np.dstack((-dz_dx, -dz_dy, np.ones_like(z)))
    lengths = np.linalg.norm(normals, axis=2)
    lengths[lengths < 1e-12] = 1.0
    normals = normals / lengths[:, :, None]
    mesh = MeshData("terrain", "terrain")
    mesh.add_triangles(
        [tuple(v) for v in vertices.tolist()],
        faces,
        [tuple(v) for v in uvs.tolist()],
    )
    mesh.normals = [tuple(v) for v in normals.reshape(-1, 3).tolist()]
    return mesh


def polygon_area(polygon: Polygon) -> float:
    return float(abs(polygon.area))


def multipolygon_parts(geometry) -> list[Polygon]:
    if isinstance(geometry, Polygon):
        return [geometry]
    if isinstance(geometry, MultiPolygon):
        return list(geometry.geoms)
    return []


def clamp_height(value: float) -> float:
    if not np.isfinite(value):
        return 8.0
    return float(max(2.0, min(300.0, value)))


def require_mesh(mesh: MeshData, label: str) -> MeshData:
    if not mesh.vertices or not mesh.faces:
        raise ValidationError(f"Пустой меш: {label}")
    return mesh
