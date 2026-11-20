from __future__ import annotations

import math
import re
import time
from pathlib import Path
from typing import Callable

import osmium
import requests
from shapely.geometry import Point, Polygon

from .config import BBox
from .errors import DataSourceError
from .osm import OSM_ATTRIBUTION, OsmData, OsmNode, OsmRelation, OsmWay, USER_AGENT

GEOFABRIK_RUSSIA = "https://download.geofabrik.de/russia"
RUSSIA_DISTRICTS = (
    "central-fed-district",
    "crimean-fed-district",
    "far-eastern-fed-district",
    "north-caucasus-fed-district",
    "northwestern-fed-district",
    "siberian-fed-district",
    "south-fed-district",
    "ural-fed-district",
    "volga-fed-district",
)


def _download_file(url: str, path: Path, progress=None, label: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.stat().st_size > 0:
        return
    tmp = path.with_suffix(path.suffix + ".part")
    with requests.get(
        url,
        stream=True,
        timeout=(30, 300),
        headers={"User-Agent": USER_AGENT},
    ) as response:
        if response.status_code != 200:
            raise DataSourceError(f"HTTP {response.status_code} для {url}")
        total = int(response.headers.get("content-length") or 0)
        done = 0
        with tmp.open("wb") as handle:
            for chunk in response.iter_content(1024 * 1024):
                if not chunk:
                    continue
                handle.write(chunk)
                done += len(chunk)
                if progress and total:
                    progress(
                        0.36 + 0.04 * done / total,
                        f"{label} {done / 1024 / 1024:.0f}/{total / 1024 / 1024:.0f} МБ",
                    )
    tmp.replace(path)


def parse_poly(data: str) -> Polygon | None:
    lines = [line.strip() for line in data.splitlines() if line.strip()]
    if len(lines) < 3:
        return None
    sections: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] | None = None
    for line in lines[2:]:
        if line.upper() == "END":
            if current:
                sections.append(current)
                current = None
            continue
        parts = line.split()
        if len(parts) >= 2 and not line[0].isalpha():
            try:
                lon, lat = float(parts[0]), float(parts[1])
            except ValueError:
                continue
            if current is None:
                current = []
            current.append((lon, lat))
    if not sections:
        return None
    polygons = []
    for coords in sections:
        if len(coords) >= 4:
            try:
                polygons.append(Polygon(coords).buffer(0))
            except Exception:
                continue
    return polygons[0] if polygons else None


def resolve_russia_district(bbox: BBox, cache_dir: Path, progress=None) -> str | None:
    point = Point(bbox.center[1], bbox.center[0])
    for district in RUSSIA_DISTRICTS:
        poly_path = cache_dir / "pbf" / f"{district}.poly"
        if not poly_path.exists():
            try:
                response = requests.get(
                    f"{GEOFABRIK_RUSSIA}/{district}.poly",
                    timeout=60,
                    headers={"User-Agent": USER_AGENT},
                )
                if response.status_code != 200:
                    continue
                poly_path.parent.mkdir(parents=True, exist_ok=True)
                poly_path.write_text(response.text, encoding="utf-8")
            except Exception:
                continue
        poly = parse_poly(poly_path.read_text(encoding="utf-8"))
        if poly is not None and poly.covers(point):
            return district
    return None


def _tags(obj) -> dict[str, str]:
    return {tag.k: tag.v for tag in obj.tags}


def _relevant(tags: dict[str, str]) -> bool:
    return bool(
        tags.get("building")
        or tags.get("building:part")
        or tags.get("highway")
        or tags.get("railway")
        or tags.get("place")
    )


_MEMBER_TYPES = {
    "n": "node",
    "node": "node",
    "w": "way",
    "way": "way",
    "r": "relation",
    "relation": "relation",
}


def _relation_members(relation) -> list[tuple[str, int, str]]:
    members = []
    for member in relation.members:
        kind = _MEMBER_TYPES.get(member.type)
        if kind is None:
            continue
        try:
            members.append((kind, int(member.ref), member.role))
        except (TypeError, ValueError):
            continue
    return members


class _NodePass(osmium.SimpleHandler):
    def __init__(self, bbox: BBox):
        super().__init__()
        self.bbox = bbox
        self.nodes: dict[int, OsmNode] = {}
        self.relations: dict[int, OsmRelation] = {}

    def node(self, node) -> None:
        if not node.location.valid():
            return
        lat = node.location.lat
        lon = node.location.lon
        if self.bbox.contains(lat, lon):
            self.nodes[node.id] = OsmNode(node.id, lat, lon, _tags(node))

    def relation(self, relation) -> None:
        tags = _tags(relation)
        if not (tags.get("building") or tags.get("building:part")):
            return
        members = _relation_members(relation)
        if not members:
            return
        self.relations[relation.id] = OsmRelation(relation.id, members, tags)


class _ObjectPass(osmium.SimpleHandler):
    def __init__(
        self,
        bbox: BBox,
        nodes: dict[int, OsmNode],
        relation_way_ids: set[int],
    ):
        super().__init__()
        self.bbox = bbox
        self.node_ids = set(nodes)
        self.relation_way_ids = relation_way_ids
        self.ways: dict[int, OsmWay] = {}
        self.relations: dict[int, OsmRelation] = {}

    def way(self, way) -> None:
        tags = _tags(way)
        if way.id not in self.relation_way_ids and not _relevant(tags):
            return
        refs = [int(ref.ref) for ref in way.nodes]
        if not any(ref in self.node_ids for ref in refs):
            return
        self.ways[way.id] = OsmWay(way.id, refs, tags)

    def add_relations(self, relations: dict[int, OsmRelation]) -> None:
        for relation in relations.values():
            way_ids = {ref for kind, ref, _ in relation.members if kind == "way"}
            if not way_ids.intersection(self.ways):
                continue
            self.relations[relation.id] = relation


def parse_pbf(path: Path, bbox: BBox, progress=None) -> OsmData:
    if progress:
        progress(0.41, "Чтение PBF: узлы и связи")
    expanded = bbox.expanded(1000)
    node_pass = _NodePass(expanded)
    node_pass.apply_file(str(path))
    relation_way_ids = {
        ref
        for relation in node_pass.relations.values()
        for kind, ref, _ in relation.members
        if kind == "way"
    }
    if progress:
        progress(0.44, f"Чтение PBF: объекты ({len(node_pass.nodes)} узлов)")
    object_pass = _ObjectPass(expanded, node_pass.nodes, relation_way_ids)
    object_pass.apply_file(str(path))
    object_pass.add_relations(node_pass.relations)
    if not object_pass.ways and not object_pass.relations:
        raise DataSourceError("В PBF не найдено зданий или дорог")
    return OsmData(
        node_pass.nodes,
        object_pass.ways,
        object_pass.relations,
        "geofabrik-pbf",
        OSM_ATTRIBUTION,
    )


def fetch_pbf_data(
    bbox: BBox,
    cache_dir: Path = Path("cache"),
    pbf_path: Path | None = None,
    progress: Callable[[float, str], None] | None = None,
) -> OsmData:
    cache_dir = Path(cache_dir)
    if pbf_path is None:
        district = resolve_russia_district(bbox, cache_dir, progress)
        if district is None:
            raise DataSourceError(
                "Не удалось автоматически выбрать PBF. Укажи --pbf путь или используй Overpass"
            )
        pbf_path = cache_dir / "pbf" / f"{district}-latest.osm.pbf"
        if not pbf_path.exists():
            if progress:
                progress(0.35, f"Скачивание PBF {district}")
            _download_file(
                f"{GEOFABRIK_RUSSIA}/{district}-latest.osm.pbf",
                pbf_path,
                progress,
                "PBF",
            )
    pbf_path = Path(pbf_path)
    if not pbf_path.exists():
        raise DataSourceError(f"PBF не найден: {pbf_path}")
    return parse_pbf(pbf_path, bbox, progress)
