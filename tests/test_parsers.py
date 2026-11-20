import json

from shapely.geometry import Point

from mapgen.osm import parse_osm_xml, parse_overpass_json
from mapgen.pbf import parse_poly


OSM_XML = """<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <node id="1" lat="47.220" lon="39.690">
    <tag k="place" v="town"/>
    <tag k="name" v="Тест"/>
  </node>
  <node id="2" lat="47.221" lon="39.691"/>
  <node id="3" lat="47.222" lon="39.692"/>
  <node id="4" lat="47.221" lon="39.692"/>
  <way id="10">
    <nd ref="1"/>
    <nd ref="2"/>
    <nd ref="3"/>
    <nd ref="4"/>
    <nd ref="1"/>
    <tag k="building" v="yes"/>
  </way>
  <relation id="20">
    <member type="way" ref="10" role="outer"/>
    <tag k="building" v="yes"/>
  </relation>
</osm>
"""


OVERPASS_JSON = {
    "elements": [
        {"type": "node", "id": 1, "lat": 47.22, "lon": 39.69, "tags": {"place": "village"}},
        {"type": "node", "id": 2, "lat": 47.221, "lon": 39.691},
        {"type": "way", "id": 10, "nodes": [1, 2], "tags": {"highway": "residential"}},
        {
            "type": "relation",
            "id": 20,
            "members": [{"type": "way", "ref": 10, "role": "outer"}],
            "tags": {"building": "yes"},
        },
    ]
}


def test_parse_osm_xml(tmp_path):
    path = tmp_path / "map.osm"
    path.write_text(OSM_XML, encoding="utf-8")
    data = parse_osm_xml(path)
    assert data.source == "osm-api"
    assert len(data.nodes) == 4
    assert len(data.ways) == 1
    assert len(data.relations) == 1
    assert len(data.places()) == 1
    assert data.places()[0].tags["name"] == "Тест"
    assert data.way_coords(data.ways[10])[0] == (39.690, 47.220)


def test_parse_overpass_json(tmp_path):
    path = tmp_path / "map.json"
    path.write_text(json.dumps(OVERPASS_JSON), encoding="utf-8")
    data = parse_overpass_json(path)
    assert data.source == "overpass"
    assert data.ways[10].refs == [1, 2]
    assert data.relations[20].members == [("way", 10, "outer")]


def test_parse_poly():
    text = """test
1
  39.60 47.10
  39.80 47.10
  39.80 47.30
  39.60 47.30
END
END
"""
    polygon = parse_poly(text)
    assert polygon is not None
    assert polygon.covers(Point(39.7, 47.2))
    assert not polygon.covers(Point(40.0, 48.0))
