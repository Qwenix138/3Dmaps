from __future__ import annotations

import json
import shutil
import struct
from pathlib import Path

import numpy as np

from . import __version__
from .errors import MapgenError
from .mesh import MeshData, Scene
from .textures import TextureSet


MATERIAL_COLORS = {
    "building": (0.56, 0.56, 0.56, 1.0),
    "road": (0.15, 0.15, 0.16, 1.0),
    "rail": (0.23, 0.17, 0.13, 1.0),
    "water": (0.20, 0.46, 0.65, 1.0),
    "terrain": (1.0, 1.0, 1.0, 1.0),
}
MATERIAL_NAMES = {
    "building": "building",
    "road": "road",
    "rail": "rail",
    "water": "water",
    "terrain": "terrain",
}


def _terrain_texture(textures: TextureSet) -> Path:
    for path in (textures.satellite, textures.hybrid, textures.relief, textures.labels):
        if path and Path(path).exists():
            return Path(path)
    raise MapgenError("Нет ни одной текстуры для рельефа")


def _obj_uv(mesh: MeshData, index: int) -> str:
    if mesh.uvs is None or index >= len(mesh.uvs):
        return ""
    return f"{index + 1}"


def export_obj(
    scene: Scene,
    out_dir: Path,
    textures: TextureSet,
    name: str = "zone",
    terrain_variant: str = "satellite",
) -> tuple[Path, Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    texture_path = {
        "satellite": textures.satellite,
        "labels": textures.labels,
        "hybrid": textures.hybrid,
        "relief": textures.relief,
    }.get(terrain_variant)
    if terrain_variant == "satellite" and not texture_path:
        texture_path = _terrain_texture(textures)
    if terrain_variant == "hybrid" and not texture_path:
        texture_path = _terrain_texture(textures)
    if terrain_variant == "relief" and not texture_path:
        texture_path = _terrain_texture(textures)
    if not texture_path or not Path(texture_path).exists():
        raise MapgenError(f"Текстура {terrain_variant} не найдена")
    texture_path = Path(texture_path)
    material = f"terrain_{terrain_variant}"
    obj_path = out_dir / f"{name}.obj"
    mtl_path = out_dir / f"{name}.mtl"

    texture_name = f"{name}_{terrain_variant}{texture_path.suffix or '.png'}"
    texture_out = out_dir / texture_name
    try:
        if texture_out.resolve() != texture_path.resolve():
            shutil.copy2(texture_path, texture_out)
        texture_ref = texture_out.name
    except OSError as exc:
        raise MapgenError(f"Не удалось скопировать текстуру рядом с OBJ: {exc}") from exc
    try:
        fonts = []
        with mtl_path.open("w", encoding="utf-8", newline="\n") as mtl:
            mtl.write(f"newmtl {material}\n")
            mtl.write("Ka 1.000 1.000 1.000\n")
            mtl.write("Kd 1.000 1.000 1.000\n")
            mtl.write("Ks 0.000 0.000 0.000\n")
            mtl.write("d 1.0\n")
            mtl.write("illum 1\n")
            mtl.write(f"map_Kd {texture_ref}\n\n")
            for key, color in MATERIAL_COLORS.items():
                if key == "terrain":
                    continue
                mtl.write(f"newmtl {MATERIAL_NAMES[key]}\n")
                mtl.write(f"Ka {color[0]:.3f} {color[1]:.3f} {color[2]:.3f}\n")
                mtl.write(f"Kd {color[0]:.3f} {color[1]:.3f} {color[2]:.3f}\n")
                mtl.write("Ks 0.000 0.000 0.000\n")
                mtl.write("d 1.0\n")
                mtl.write("illum 1\n\n")
    except OSError as exc:
        raise MapgenError(f"Не удалось записать MTL: {exc}") from exc

    try:
        with obj_path.open("w", encoding="utf-8", newline="\n") as obj:
            obj.write(f"mtllib {mtl_path.name}\n")
            vertex_offset = 1
            uv_offset = 1
            normal_offset = 1
            for mesh in scene.meshes:
                if not mesh.vertices or not mesh.faces:
                    continue
                mesh_material = material if mesh.material == "terrain" else mesh.material
                obj.write(f"o {mesh.name}\n")
                obj.write(f"usemtl {mesh_material}\n")
                for x, y, z in mesh.vertices:
                    obj.write(f"v {x:.4f} {y:.4f} {z:.4f}\n")
                if mesh.uvs is not None:
                    for u, v in mesh.uvs:
                        obj.write(f"vt {u:.6f} {v:.6f}\n")
                if mesh.normals is not None:
                    for nx, ny, nz in mesh.normals:
                        obj.write(f"vn {nx:.6f} {ny:.6f} {nz:.6f}\n")
                for face in mesh.faces:
                    parts = []
                    for idx in face:
                        v_idx = vertex_offset + idx
                        has_uv = mesh.uvs is not None and idx < len(mesh.uvs)
                        has_n = mesh.normals is not None and idx < len(mesh.normals)
                        if has_uv and has_n:
                            parts.append(
                                f"{v_idx}/{uv_offset + idx}/{normal_offset + idx}"
                            )
                        elif has_n:
                            parts.append(f"{v_idx}//{normal_offset + idx}")
                        elif has_uv:
                            parts.append(f"{v_idx}/{uv_offset + idx}")
                        else:
                            parts.append(str(v_idx))
                    obj.write("f " + " ".join(parts) + "\n")
                vertex_offset += len(mesh.vertices)
                if mesh.uvs is not None:
                    uv_offset += len(mesh.uvs)
                if mesh.normals is not None:
                    normal_offset += len(mesh.normals)
    except OSError as exc:
        raise MapgenError(f"Не удалось записать OBJ: {exc}") from exc
    return obj_path, mtl_path


def _align4(data: bytes) -> bytes:
    return data + b"\x00" * ((4 - len(data) % 4) % 4)


def _glb_bytes(document: dict, binary: bytes) -> bytes:
    json_bytes = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    binary = _align4(binary)
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    header = struct.pack("<4sII", b"glTF", 2, total)
    json_chunk = struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes
    bin_chunk = struct.pack("<II", len(binary), 0x004E4942) + binary
    return header + json_chunk + bin_chunk


def export_glb(
    scene: Scene,
    out_dir: Path,
    textures: TextureSet,
    name: str = "zone",
    terrain_variant: str = "satellite",
) -> Path:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    texture_path = {
        "satellite": textures.satellite,
        "labels": textures.labels,
        "hybrid": textures.hybrid,
        "relief": textures.relief,
    }.get(terrain_variant)
    if texture_path is None:
        texture_path = _terrain_texture(textures)
    texture_path = Path(texture_path)
    if not texture_path.exists():
        raise MapgenError(f"Текстура не найдена: {texture_path}")

    binary = bytearray()
    buffer_views: list[dict] = []
    accessors: list[dict] = []
    meshes_json: list[dict] = []
    nodes_json: list[dict] = []
    images: list[dict] = []
    textures_json: list[dict] = []
    materials_json: list[dict] = []

    def add_view(data: bytes, target: int | None = None) -> int:
        while len(binary) % 4:
            binary.append(0)
        offset = len(binary)
        binary.extend(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target:
            view["target"] = target
        buffer_views.append(view)
        return len(buffer_views) - 1

    def add_accessor(
        array: np.ndarray,
        component_type: int,
        type_name: str,
        minmax: bool = False,
    ) -> int:
        view = add_view(array.tobytes(), 34962 if type_name != "SCALAR" else 34963)
        accessor = {
            "bufferView": view,
            "componentType": component_type,
            "count": int(array.shape[0]),
            "type": type_name,
        }
        if minmax:
            if array.ndim == 1:
                accessor["min"] = [float(array.min())]
                accessor["max"] = [float(array.max())]
            else:
                accessor["min"] = [float(v) for v in array.min(axis=0)]
                accessor["max"] = [float(v) for v in array.max(axis=0)]
        accessors.append(accessor)
        return len(accessors) - 1

    material_indices: dict[str, int] = {}
    for key in ("terrain", "building", "road", "rail", "water"):
        color = MATERIAL_COLORS[key]
        material = {
            "name": MATERIAL_NAMES[key],
            "doubleSided": True,
            "pbrMetallicRoughness": {
                "baseColorFactor": list(color),
                "metallicFactor": 0.0,
                "roughnessFactor": 0.9,
            },
        }
        material_indices[key] = len(materials_json)
        materials_json.append(material)

    texture_bytes = texture_path.read_bytes()
    mime = "image/png" if texture_path.suffix.lower() == ".png" else "image/jpeg"
    image_view = add_view(texture_bytes)
    images.append({"bufferView": image_view, "mimeType": mime})
    textures_json.append({"sampler": 0, "source": 0})
    materials_json[material_indices["terrain"]]["pbrMetallicRoughness"]["baseColorTexture"] = {
        "index": 0
    }
    samplers = [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}]

    for mesh in scene.meshes:
        if not mesh.vertices or not mesh.faces:
            continue
        if any(len(face) != 3 for face in mesh.faces):
            raise MapgenError(f"GLB поддерживает только треугольники: {mesh.name}")
        mesh.finalize_normals()
        verts = np.asarray(mesh.vertices, dtype=np.float64)
        positions = np.column_stack((verts[:, 0], verts[:, 2], -verts[:, 1])).astype(np.float32)
        normals = np.asarray(mesh.normals or [], dtype=np.float64)
        if len(normals) != len(verts):
            normals = np.zeros_like(verts)
            normals[:, 2] = 1.0
        normals = np.column_stack((normals[:, 0], normals[:, 2], -normals[:, 1])).astype(np.float32)
        indices = np.asarray([idx for face in mesh.faces for idx in face], dtype=np.uint32)
        pos_accessor = add_accessor(positions, 5126, "VEC3", minmax=True)
        norm_accessor = add_accessor(normals, 5126, "VEC3")
        attributes = {"POSITION": pos_accessor, "NORMAL": norm_accessor}
        if mesh.uvs is not None:
            uv = np.asarray(mesh.uvs, dtype=np.float32)
            uv[:, 1] = 1.0 - uv[:, 1]
            attributes["TEXCOORD_0"] = add_accessor(uv, 5126, "VEC2")
        idx_accessor = add_accessor(indices, 5125, "SCALAR")
        primitive = {
            "attributes": attributes,
            "indices": idx_accessor,
            "mode": 4,
            "material": material_indices.get(mesh.material, material_indices["building"]),
        }
        meshes_json.append({"name": mesh.name, "primitives": [primitive]})
        nodes_json.append({"name": mesh.name, "mesh": len(meshes_json) - 1})

    document = {
        "asset": {
            "version": "2.0",
            "generator": f"3Dmaps {__version__}",
            "copyright": " ".join(scene.attribution),
        },
        "scene": 0,
        "scenes": [{"name": "zone", "nodes": list(range(len(nodes_json)))}],
        "nodes": nodes_json,
        "meshes": meshes_json,
        "materials": materials_json,
        "textures": textures_json,
        "images": images,
        "samplers": samplers,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(binary)}],
        "extras": {
            "bbox": list(scene.bbox),
            "baseElevation": scene.base_elevation,
            "attribution": scene.attribution,
        },
    }
    path = out_dir / f"{name}.glb"
    path.write_bytes(_glb_bytes(document, bytes(binary)))
    return path
