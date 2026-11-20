import numpy as np
from PIL import Image, ImageChops, ImageDraw
from shapely.geometry import Polygon

from mapgen.buildings import Building
from mapgen.config import BBox
from mapgen.elevation import TerrainGrid
from mapgen.geo import make_grid
from mapgen.osm import OsmData, OsmNode
from mapgen.roads import RoadWay
from mapgen.textures import _draw_labels, build_textures, render_label_textures


def make_scene_data():
    bbox = BBox(47.220, 39.690, 47.223, 39.693)
    projection, grid = make_grid(bbox, 20)
    terrain = TerrainGrid(
        elevations=np.full((grid.ny, grid.nx), 50.0),
        grid=grid,
        projection=projection,
        zoom=14,
        tiles=[],
        base_elevation=50.0,
        attribution="test",
    )
    building = Building(
        "way/1",
        Polygon([(-40, -30), (40, -30), (40, 30), (-40, 30)]),
        10.0,
    )
    road = RoadWay(
        "way/2",
        [(-120, 60), (0, 60), (120, 60)],
        7.0,
        "road",
        {"highway": "primary", "name": "Тестовая улица"},
    )
    data = OsmData(
        nodes={1: OsmNode(1, 47.2215, 39.6915, {"place": "town", "name": "Тест"})},
        ways={},
        relations={},
        source="test",
    )
    return bbox, projection, grid, terrain, building, road, data


def test_labels_can_be_disabled():
    bbox, projection, grid, terrain, building, road, data = make_scene_data()
    with_labels, _ = render_label_textures(
        bbox, [building], [road], data, projection, grid, 512, include_labels=True
    )
    without_labels, _ = render_label_textures(
        bbox, [building], [road], data, projection, grid, 512, include_labels=False
    )
    assert ImageChops.difference(with_labels.convert("RGB"), without_labels.convert("RGB")).getbbox()


def test_duplicate_place_labels_are_not_repeated():
    bbox, projection, grid, terrain, building, road, data = make_scene_data()
    places = [
        {"name": "Тест", "kind": "town", "x": 200, "y": 180, "population": 1000},
        {"name": "Тест", "kind": "town", "x": 300, "y": 320, "population": 1000},
    ]

    def draw(items):
        image = Image.new("RGBA", (512, 512), (255, 255, 255, 255))
        _draw_labels(
            ImageDraw.Draw(image),
            items,
            [],
            [],
            grid,
            512,
            (0, 0, 0, 255),
            (255, 255, 255, 255),
        )
        return image.convert("RGB")

    assert ImageChops.difference(draw(places[:1]), draw(places)).getbbox() is None


def test_duplicate_road_labels_are_not_repeated():
    bbox, projection, grid, terrain, building, road, data = make_scene_data()
    second = RoadWay(
        "way/3",
        [(-120, -120), (0, -120), (120, -120)],
        7.0,
        "road",
        {"highway": "primary", "name": "Тестовая улица"},
    )

    def draw(roads):
        image = Image.new("RGBA", (512, 512), (255, 255, 255, 255))
        _draw_labels(
            ImageDraw.Draw(image),
            [],
            roads,
            [],
            grid,
            512,
            (0, 0, 0, 255),
            (255, 255, 255, 255),
        )
        return image.convert("RGB")

    assert ImageChops.difference(draw([road]), draw([road, second])).getbbox() is None


def test_build_textures_labels_option(tmp_path):
    bbox, projection, grid, terrain, building, road, data = make_scene_data()
    textures = build_textures(
        bbox,
        256,
        [building],
        [road],
        data,
        terrain,
        tmp_path,
        use_satellite=False,
        use_labels=False,
    )
    assert textures.labels.exists()
    assert textures.overlay.exists()
    assert textures.relief is not None and textures.relief.exists()
    assert textures.satellite is None
    image = Image.open(textures.labels)
    assert image.size == (256, 256)
