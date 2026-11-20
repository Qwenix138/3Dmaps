import numpy as np
import pytest
from PIL import Image
from shapely.geometry import Polygon

from mapgen.buildings import Building, build_building_mesh
from mapgen.config import BBox
from mapgen.elevation import TerrainGrid, save_heightmap
from mapgen.geo import Grid, LocalProjection, make_grid
from mapgen.mesh import build_terrain_mesh, triangulate_polygon
from mapgen.textures import render_relief


def make_terrain(base=100.0, z=0.0):
    bbox = BBox(47.220, 39.690, 47.222, 39.692)
    projection, grid = make_grid(bbox, 10)
    elevations = np.full((grid.ny, grid.nx), base + z, dtype=np.float64)
    return TerrainGrid(
        elevations=elevations,
        grid=grid,
        projection=projection,
        zoom=14,
        tiles=[],
        base_elevation=base,
        attribution="test",
    )


def test_triangulate_polygon_with_hole():
    polygon = Polygon(
        [(0, 0), (20, 0), (20, 20), (0, 20)],
        [[(7, 7), (13, 7), (13, 13), (7, 13)]],
    )
    flat, triangles = triangulate_polygon(polygon)
    assert len(flat) == 8
    assert len(triangles) > 0
    assert all(len(set(triangle)) == 3 for triangle in triangles)


def test_building_mesh_uses_relative_elevation():
    terrain = make_terrain(base=100.0, z=5.0)
    building = Building("test", Polygon([(-10, -10), (10, -10), (10, 10), (-10, 10)]), 12.0)
    mesh = build_building_mesh([building], terrain)
    z_values = [vertex[2] for vertex in mesh.vertices]
    assert len(mesh.faces) > 0
    assert min(z_values) == pytest.approx(4.65)
    assert max(z_values) == pytest.approx(16.65)


def test_terrain_mesh_orientation():
    terrain = make_terrain()
    mesh = build_terrain_mesh(terrain)
    assert len(mesh.vertices) == terrain.grid.nx * terrain.grid.ny
    north = terrain.grid.ny - 1
    index = north * terrain.grid.nx
    assert mesh.uvs[index][1] == pytest.approx(1.0)


def test_relief_image_is_north_up():
    terrain = make_terrain()
    terrain.elevations = np.linspace(
        100.0, 200.0, terrain.grid.ny
    )[:, None] * np.ones((1, terrain.grid.nx))
    image = np.asarray(render_relief(terrain, 64))
    assert image[:32, :, 0].mean() > image[32:, :, 0].mean()


def test_heightmap_is_north_up(tmp_path):
    grid = Grid(
        xs=np.array([0.0, 1.0]),
        ys=np.array([0.0, 1.0]),
        x_min=0.0,
        x_max=1.0,
        y_min=0.0,
        y_max=1.0,
    )
    terrain = TerrainGrid(
        elevations=np.array([[100.0, 100.0], [200.0, 200.0]]),
        grid=grid,
        projection=LocalProjection(0.0, 0.0),
        zoom=1,
        tiles=[],
        base_elevation=100.0,
        attribution="test",
    )
    path = tmp_path / "heightmap.png"
    save_heightmap(terrain, path)
    image = np.asarray(Image.open(path))
    assert image[0, 0] > image[-1, 0]
    saved = np.load(tmp_path / "heightmap.npy")
    assert saved[0, 0] == pytest.approx(200.0)
