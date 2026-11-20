from __future__ import annotations

import hashlib
import json
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import requests

from .config import BBox
from .errors import DataSourceError, ValidationError

OSM_API_URL = "https://api.openstreetmap.org/api/0.6/map"
OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
OSM_ATTRIBUTION = "© OpenStreetMap contributors, ODbL 1.0"
OSM_API_MAX_AREA_KM2 = 6.0
USER_AGENT = "3Dmaps/0.1 (+https://github.com/; map generator)"


@dataclass
class OsmNode:
    id: int
    lat: float
    lon: float
    tags: dict[str, str] = field(default_factory=dict)


@dataclass
class OsmWay:
    id: int
    refs: list[int]
    tags: dict[str, str] = field(default_factory=dict)


@dataclass
class OsmRelation:
    id: int
    members: list[tuple[str, int, str]]
    tags: dict[str, str] = field(default_factory=dict)


@dataclass
class OsmData:
    nodes: dict[int, OsmNode]
    ways: dict[int, OsmWay]
    relations: dict[int, OsmRelation]
    source: str
    attribution: str = OSM_ATTRIBUTION

    def way_coords(self, way: OsmWay) -> list[tuple[float, float]]:
        result = []
        for ref in way.refs:
            node = self.nodes.get(ref)
            if node is not None:
                result.append((node.lon, node.lat))
        return result

    def coords_for_refs(self, refs: list[int]) -> list[tuple[float, float]]:
        result = []
        for ref in refs:
            node = self.nodes.get(ref)
            if node is not None:
                result.append((node.lon, node.lat))
        return result

    def places(self) -> list[OsmNode]:
        return [n for n in self.nodes.values() if n.tags.get("place") and n.tags.get("name")]


def _tags(elem: ET.Element) -> dict[str, str]:
    return {
        tag.attrib["k"]: tag.attrib.get("v", "")
        for tag in elem.findall("tag")
        if "k" in tag.attrib
    }


def parse_osm_xml(path: Path) -> OsmData:
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as exc:
        raise DataSourceError(f"OSM XML повреждён: {exc}") from exc
    if root.tag == "osm":
        for child in root:
            if child.tag == "note":
                raise DataSourceError(f"OSM API: {child.text}")
    nodes: dict[int, OsmNode] = {}
    ways: dict[int, OsmWay] = {}
    relations: dict[int, OsmRelation] = {}
    for elem in root:
        if elem.tag == "node":
            try:
                node = OsmNode(
                    int(elem.attrib["id"]),
                    float(elem.attrib["lat"]),
                    float(elem.attrib["lon"]),
                    _tags(elem),
                )
            except (KeyError, ValueError):
                continue
            nodes[node.id] = node
        elif elem.tag == "way":
            try:
                way = OsmWay(
                    int(elem.attrib["id"]),
                    [int(nd.attrib["ref"]) for nd in elem.findall("nd") if "ref" in nd.attrib],
                    _tags(elem),
                )
            except (KeyError, ValueError):
                continue
            ways[way.id] = way
        elif elem.tag == "relation":
            try:
                members = [
                    (
                        member.attrib.get("type", ""),
                        int(member.attrib["ref"]),
                        member.attrib.get("role", ""),
                    )
                    for member in elem.findall("member")
                    if "ref" in member.attrib
                ]
                relation = OsmRelation(int(elem.attrib["id"]), members, _tags(elem))
            except (KeyError, ValueError):
                continue
            relations[relation.id] = relation
    return OsmData(nodes, ways, relations, "osm-api")


def parse_overpass_json(path: Path) -> OsmData:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise DataSourceError(f"Overpass JSON повреждён: {exc}") from exc
    nodes: dict[int, OsmNode] = {}
    ways: dict[int, OsmWay] = {}
    relations: dict[int, OsmRelation] = {}
    for elem in payload.get("elements", []):
        kind = elem.get("type")
        if kind == "node":
            node = OsmNode(
                int(elem["id"]),
                float(elem["lat"]),
                float(elem["lon"]),
                elem.get("tags", {}),
            )
            nodes[node.id] = node
        elif kind == "way":
            ways[int(elem["id"])] = OsmWay(
                int(elem["id"]),
                [int(v) for v in elem.get("nodes", [])],
                elem.get("tags", {}),
            )
        elif kind == "relation":
            members = [
                (m.get("type", ""), int(m["ref"]), m.get("role", ""))
                for m in elem.get("members", [])
                if "ref" in m
            ]
            relations[int(elem["id"])] = OsmRelation(
                int(elem["id"]), members, elem.get("tags", {})
            )
    return OsmData(nodes, ways, relations, "overpass")


def _cache_path(cache_dir: Path, key: str, suffix: str) -> Path:
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:20]
    path = cache_dir / "osm" / f"{digest}.{suffix}"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _download(url: str, params: dict | None, path: Path, timeout: int = 180) -> None:
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = session.get(url, params=params, timeout=timeout)
            if response.status_code != 200:
                raise DataSourceError(
                    f"HTTP {response.status_code}: {response.text[:300]}"
                )
            tmp = path.with_suffix(path.suffix + ".tmp")
            tmp.write_bytes(response.content)
            tmp.replace(path)
            return
        except Exception as exc:
            last_error = exc
            time.sleep(1.5 + attempt)
    raise DataSourceError(f"Не удалось скачать OSM: {last_error}")


def fetch_osm_api(
    bbox: BBox,
    cache_dir: Path = Path("cache"),
    progress: Callable[[float, str], None] | None = None,
) -> OsmData:
    if bbox.area_km2 > OSM_API_MAX_AREA_KM2:
        raise ValidationError("Зона слишком большая для OSM API")
    key = f"api:{bbox.as_string}"
    path = _cache_path(cache_dir, key, "osm")
    if not path.exists():
        if progress:
            progress(0.36, "Загрузка OSM API")
        params = {
            "bbox": f"{bbox.west:.8f},{bbox.south:.8f},{bbox.east:.8f},{bbox.north:.8f}"
        }
        _download(OSM_API_URL, params, path, timeout=180)
    if progress:
        progress(0.42, "Разбор OSM")
    return parse_osm_xml(path)


def overpass_query(bbox: BBox) -> str:
    b = f"{bbox.south:.8f},{bbox.west:.8f},{bbox.north:.8f},{bbox.east:.8f}"
    return f"""[out:json][timeout:300];
(
  way["building"]({b});
  relation["building"]({b});
  way["highway"]({b});
  way["railway"]({b});
  node["place"]({b});
);
out body;
>;
out skel qt;"""


def fetch_overpass(
    bbox: BBox,
    cache_dir: Path = Path("cache"),
    progress: Callable[[float, str], None] | None = None,
) -> OsmData:
    key = f"overpass:{bbox.as_string}"
    path = _cache_path(cache_dir, key, "json")
    if not path.exists():
        if progress:
            progress(0.36, "Загрузка OSM Overpass")
        query = overpass_query(bbox)
        last_error: Exception | None = None
        for endpoint in OVERPASS_ENDPOINTS:
            try:
                response = requests.post(
                    endpoint,
                    data={"data": query},
                    headers={"User-Agent": USER_AGENT},
                    timeout=330,
                )
                if response.status_code == 200:
                    tmp = path.with_suffix(".json.tmp")
                    tmp.write_bytes(response.content)
                    tmp.replace(path)
                    break
                last_error = DataSourceError(
                    f"{endpoint}: HTTP {response.status_code} {response.text[:200]}"
                )
            except Exception as exc:
                last_error = exc
        else:
            raise DataSourceError(f"Overpass недоступен: {last_error}")
    if progress:
        progress(0.44, "Разбор OSM Overpass")
    return parse_overpass_json(path)


def fetch_osm(
    bbox: BBox,
    source: str = "auto",
    cache_dir: Path = Path("cache"),
    pbf_path: Path | None = None,
    progress: Callable[[float, str], None] | None = None,
) -> OsmData:
    source = source.lower()
    if source == "api":
        return fetch_osm_api(bbox, cache_dir, progress)
    if source == "overpass":
        return fetch_overpass(bbox, cache_dir, progress)
    if source == "pbf":
        return fetch_pbf(bbox, cache_dir, pbf_path, progress)
    if source != "auto":
        raise ValidationError("osm_source должен быть auto, api, overpass или pbf")
    if bbox.area_km2 <= OSM_API_MAX_AREA_KM2:
        try:
            return fetch_osm_api(bbox, cache_dir, progress)
        except Exception:
            pass
    try:
        return fetch_overpass(bbox, cache_dir, progress)
    except Exception as overpass_error:
        try:
            return fetch_pbf(bbox, cache_dir, pbf_path, progress)
        except Exception as pbf_error:
            raise DataSourceError(
                f"Не удалось получить OSM. Overpass: {overpass_error}. PBF: {pbf_error}"
            ) from pbf_error


def fetch_pbf(
    bbox: BBox,
    cache_dir: Path = Path("cache"),
    pbf_path: Path | None = None,
    progress: Callable[[float, str], None] | None = None,
) -> OsmData:
    from .pbf import fetch_pbf_data

    return fetch_pbf_data(bbox, cache_dir, pbf_path, progress)
