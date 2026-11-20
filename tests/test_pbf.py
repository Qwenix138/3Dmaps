import osmium
import pytest

from mapgen.config import BBox
from mapgen.errors import DataSourceError
from mapgen.pbf import parse_pbf


def write_sample(path):
    writer = osmium.SimpleWriter(str(path))
    points = [
        (39.6900, 47.2200),
        (39.6910, 47.2200),
        (39.6910, 47.2210),
        (39.6900, 47.2210),
    ]
    for index, (lon, lat) in enumerate(points, 1):
        writer.add_node(
            osmium.osm.mutable.Node(
                id=index,
                location=osmium.osm.Location(lon, lat),
                tags={"place": "town", "name": "Тест"} if index == 1 else {},
            )
        )
    writer.add_way(
        osmium.osm.mutable.Way(
            id=10,
            nodes=[1, 2, 3, 4, 1],
            tags={"building": "yes", "height": "12"},
        )
    )
    writer.add_way(
        osmium.osm.mutable.Way(
            id=11,
            nodes=[1, 3],
            tags={"highway": "residential", "name": "Тестовая"},
        )
    )
    writer.close()


def test_parse_pbf_way_refs(tmp_path):
    path = tmp_path / "sample.osm.pbf"
    write_sample(path)
    bbox = BBox(47.2195, 39.6895, 47.2215, 39.6915)
    data = parse_pbf(path, bbox)
    assert data.source == "geofabrik-pbf"
    assert len(data.nodes) == 4
    assert len(data.ways) == 2
    assert data.ways[10].refs == [1, 2, 3, 4, 1]
    assert data.ways[10].tags["building"] == "yes"
    assert data.ways[11].tags["highway"] == "residential"
    assert data.way_coords(data.ways[10])[0] == (39.69, 47.22)


def test_parse_pbf_outside_bbox(tmp_path):
    path = tmp_path / "sample.osm.pbf"
    write_sample(path)
    bbox = BBox(47.30, 39.80, 47.31, 39.81)
    with pytest.raises(DataSourceError):
        parse_pbf(path, bbox)


def write_relation_sample(path, way_tags=None, way_id=30, relation_id=40, relation_tags=None):
    writer = osmium.SimpleWriter(str(path))
    points = [
        (39.6900, 47.2200),
        (39.6910, 47.2200),
        (39.6910, 47.2210),
        (39.6900, 47.2210),
    ]
    for index, (lon, lat) in enumerate(points, way_id * 10):
        writer.add_node(
            osmium.osm.mutable.Node(
                id=index, location=osmium.osm.Location(lon, lat)
            )
        )
    writer.add_way(
        osmium.osm.mutable.Way(
            id=way_id,
            nodes=[way_id * 10, way_id * 10 + 1, way_id * 10 + 2, way_id * 10 + 3, way_id * 10],
            tags=way_tags or {},
        )
    )
    writer.add_relation(
        osmium.osm.mutable.Relation(
            id=relation_id,
            members=[osmium.osm.RelationMember(mtype="w", ref=way_id, role="outer")],
            tags=relation_tags or {"building": "yes", "height": "15"},
        )
    )
    writer.close()


def test_parse_pbf_multipolygon_relation(tmp_path):
    from mapgen.buildings import extract_buildings
    from mapgen.config import GenerationOptions
    from mapgen.geo import LocalProjection

    path = tmp_path / "relation.osm.pbf"
    write_relation_sample(path)
    bbox = BBox(47.2195, 39.6895, 47.2215, 39.6915)
    data = parse_pbf(path, bbox)
    assert data.ways[30].tags == {}
    assert data.relations[40].members == [("way", 30, "outer")]
    options = GenerationOptions(bbox=bbox, out_dir=tmp_path)
    buildings = extract_buildings(
        data, LocalProjection(*bbox.center), options
    )
    assert [building.osm_id for building in buildings] == ["relation/40"]


def test_parse_pbf_water_relation(tmp_path):
    from mapgen.config import GenerationOptions
    from mapgen.geo import LocalProjection
    from mapgen.water import extract_water

    path = tmp_path / "water-relation.osm.pbf"
    write_relation_sample(
        path,
        way_id=32,
        relation_id=42,
        relation_tags={"type": "multipolygon", "natural": "water"},
    )
    bbox = BBox(47.2195, 39.6895, 47.2215, 39.6915)
    data = parse_pbf(path, bbox)
    assert 42 in data.relations
    assert data.ways[32].tags == {}
    options = GenerationOptions(bbox=bbox, out_dir=tmp_path)
    water = extract_water(data, LocalProjection(*bbox.center), options)
    assert [body.osm_id for body in water] == ["relation/42"]


def test_relation_supersedes_tagged_outer_way(tmp_path):
    from mapgen.buildings import extract_buildings
    from mapgen.config import GenerationOptions
    from mapgen.geo import LocalProjection

    path = tmp_path / "tagged-relation.osm.pbf"
    write_relation_sample(path, way_tags={"building": "yes"}, way_id=31, relation_id=41)
    bbox = BBox(47.2195, 39.6895, 47.2215, 39.6915)
    data = parse_pbf(path, bbox)
    assert data.ways[31].tags["building"] == "yes"
    options = GenerationOptions(bbox=bbox, out_dir=tmp_path)
    buildings = extract_buildings(
        data, LocalProjection(*bbox.center), options
    )
    assert [building.osm_id for building in buildings] == ["relation/41"]
