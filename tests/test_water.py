import numpy as np
import pytest
from shapely.geometry import Polygon

from mapgen.buildings import Building, build_building_mesh
from mapgen.config import BBox, GenerationOptions
from mapgen.elevation import TerrainGrid
from mapgen.geo import make_grid
from mapgen.osm import OsmData, OsmNode, OsmRelation, OsmWay
from mapgen.roads import RoadWay, build_road_mesh
from mapgen.water import build_water_mesh, extract_water


def make_terrain(base=100.0, bbox=None):
    bbox = bbox or BBox(47.220, 39.690, 47.223, 39.693)
    projection, grid = make_grid(bbox, 10)
    return TerrainGrid(
        elevations=np.full((grid.ny, grid.nx), base, dtype=np.float64),
        grid=grid,
        projection=projection,
        zoom=14,
        tiles=[],
        base_elevation=base,
        attribution="test",
        bbox=bbox,
    )


def test_extract_water_multipolygon_keeps_inner_hole(tmp_path):
    bbox = BBox(47.220, 39.690, 47.223, 39.693)
    projection, _ = make_grid(bbox, 10)
    nodes = {
        1: OsmNode(1, 47.2205, 39.6905),
        2: OsmNode(2, 47.2205, 39.6925),
        3: OsmNode(3, 47.2225, 39.6925),
        4: OsmNode(4, 47.2225, 39.6905),
        5: OsmNode(5, 47.2210, 39.6910),
        6: OsmNode(6, 47.2210, 39.6920),
        7: OsmNode(7, 47.2220, 39.6920),
        8: OsmNode(8, 47.2220, 39.6910),
    }
    ways = {
        10: OsmWay(10, [1, 2, 3], {"natural": "water"}),
        11: OsmWay(11, [5, 6, 7, 8, 5]),
        14: OsmWay(14, [3, 4, 1]),
    }
    relations = {
        20: OsmRelation(
            20,
            [("way", 10, "outer"), ("way", 14, "outer"), ("way", 11, "inner")],
            {"type": "multipolygon", "natural": "water"},
        )
    }
    data = OsmData(nodes, ways, relations, "test")
    options = GenerationOptions(bbox=bbox, out_dir=tmp_path)
    water = extract_water(data, projection, options)
    assert len(water) == 1
    assert water[0].osm_id == "relation/20"
    assert len(water[0].polygon.interiors) == 1
    mesh = build_water_mesh(water, make_terrain())
    assert mesh.faces
    assert min(vertex[2] for vertex in mesh.vertices) == pytest.approx(0.2)


def test_extract_water_river_line_gets_width(tmp_path):
    bbox = BBox(47.220, 39.690, 47.223, 39.693)
    projection, _ = make_grid(bbox, 10)
    nodes = {
        1: OsmNode(1, 47.2215, 39.6905),
        2: OsmNode(2, 47.2215, 39.6925),
    }
    ways = {30: OsmWay(30, [1, 2], {"waterway": "river", "width": "10"})}
    data = OsmData(nodes, ways, {}, "test")
    options = GenerationOptions(bbox=bbox, out_dir=tmp_path)
    water = extract_water(data, projection, options)
    assert len(water) == 1
    assert water[0].polygon.area > 100
    assert water[0].polygon.bounds[2] - water[0].polygon.bounds[0] > 100


def test_road_and_rail_offsets_and_tessellation():
    terrain = make_terrain()
    road = RoadWay("way/1", [(0.0, 0.0), (0.0, 1000.0)], 6.0, "road", {})
    rail = RoadWay("way/2", [(20.0, 0.0), (20.0, 1000.0)], 3.0, "rail", {})
    road_mesh = build_road_mesh([road], terrain, "road", 0.4)
    rail_mesh = build_road_mesh([rail], terrain, "rail", 0.6)
    assert len(road_mesh.vertices) > 4
    assert len(rail_mesh.vertices) > 4
    assert min(v[2] for v in road_mesh.vertices) == pytest.approx(0.4)
    assert min(v[2] for v in rail_mesh.vertices) == pytest.approx(0.6)


def test_building_foundation_keeps_roof_height():
    terrain = make_terrain(base=100.0)
    building = Building("test", Polygon([(-10, -10), (10, -10), (10, 10), (-10, 10)]), 12.0)
    mesh = build_building_mesh([building], terrain)
    z_values = [vertex[2] for vertex in mesh.vertices]
    assert min(z_values) == pytest.approx(-4.0)
    assert max(z_values) == pytest.approx(12.0)
