import json
import struct

import numpy as np
from PIL import Image

from mapgen.export import export_glb, export_obj
from mapgen.mesh import MeshData, Scene
from mapgen.textures import TextureSet


def make_scene():
    terrain = MeshData("terrain", "terrain")
    terrain.add_triangles(
        [(0.0, 0.0, 0.0), (10.0, 0.0, 0.0), (10.0, 10.0, 2.0), (0.0, 10.0, 2.0)],
        [(0, 1, 2), (0, 2, 3)],
        [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)],
    )
    terrain.normals = [(0.0, 0.0, 1.0)] * 4
    building = MeshData("buildings", "building")
    building.add_triangles(
        [(2.0, 2.0, 1.0), (4.0, 2.0, 1.0), (4.0, 4.0, 6.0)],
        [(0, 1, 2)],
    )
    return Scene([terrain, building], 0.0, (47.0, 39.0, 48.0, 40.0), ["test"])


def make_texture_set(tmp_path):
    texture_dir = tmp_path / "textures"
    texture_dir.mkdir()
    texture = texture_dir / "labels.png"
    Image.new("RGB", (16, 16), (120, 140, 110)).save(texture)
    overlay = texture_dir / "overlay.png"
    Image.new("RGBA", (16, 16), (0, 0, 0, 0)).save(overlay)
    return TextureSet(
        satellite=None,
        labels=texture,
        hybrid=None,
        overlay=overlay,
        relief=None,
        satellite_attribution=None,
        satellite_license=None,
    )


def test_export_obj(tmp_path):
    textures = make_texture_set(tmp_path)
    obj_path, mtl_path = export_obj(make_scene(), tmp_path, textures, "zone", "labels")
    obj = obj_path.read_text(encoding="utf-8")
    mtl = mtl_path.read_text(encoding="utf-8")
    assert "o terrain" in obj
    assert "vt 1.000000 1.000000" in obj
    assert "usemtl terrain_labels" in obj
    assert "map_Kd textures/labels.png" in mtl


def test_export_glb(tmp_path):
    textures = make_texture_set(tmp_path)
    path = export_glb(make_scene(), tmp_path, textures, "zone", "labels")
    data = path.read_bytes()
    magic, version, total = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF"
    assert version == 2
    assert total == len(data)
    json_length, json_type = struct.unpack_from("<II", data, 12)
    assert json_type == 0x4E4F534A
    document = json.loads(data[20 : 20 + json_length].rstrip(b" \t\r\n"))
    assert document["asset"]["version"] == "2.0"
    assert len(document["meshes"]) == 2
    assert document["images"][0]["mimeType"] == "image/png"
    assert document["materials"][0]["pbrMetallicRoughness"]["baseColorTexture"]["index"] == 0
    positions = document["accessors"][0]
    assert positions["count"] == 4
    uv_accessors = [
        accessor for accessor in document["accessors"] if accessor["type"] == "VEC2"
    ]
    assert len(uv_accessors) == 1
    assert uv_accessors[0]["count"] == 4
    bin_length, bin_type = struct.unpack_from("<II", data, 12 + 8 + json_length)
    assert bin_type == 0x004E4942
    assert 12 + 8 + json_length + 8 + bin_length == len(data)
