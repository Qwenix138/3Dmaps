(function (root) {
  'use strict';

  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const EARTH_RADIUS = 6378137;
  const COLORS = {
    building: [0.56, 0.56, 0.56, 1],
    rail: [0.23, 0.17, 0.13, 1],
    road: [0.15, 0.15, 0.16, 1],
    water: [0.20, 0.46, 0.65, 1],
    terrain: [1, 1, 1, 1],
  };
  const LAYER_OFFSETS = { terrain: 0.0, water: 0.2, road: 0.4, rail: 0.6 };
  const BUILDING_FOUNDATION_M = 4.0;
  const ROAD_STYLES = {
    motorway: { color: '#e6bd73', width: 22 },
    motorway_link: { color: '#e6bd73', width: 13 },
    trunk: { color: '#e6bd73', width: 20 },
    trunk_link: { color: '#e6bd73', width: 12 },
    primary: { color: '#f4dfaa', width: 17 },
    primary_link: { color: '#f4dfaa', width: 10 },
    secondary: { color: '#f4e8c6', width: 14 },
    secondary_link: { color: '#f4e8c6', width: 9 },
    tertiary: { color: '#f4f0dd', width: 11 },
    tertiary_link: { color: '#f4f0dd', width: 8 },
    residential: { color: '#e9e9e1', width: 8 },
    unclassified: { color: '#e9e9e1', width: 7 },
    living_street: { color: '#e9e9e1', width: 6 },
    service: { color: '#cfcfc7', width: 4 },
    pedestrian: { color: '#d6c8a8', width: 4 },
    footway: { color: '#b9b6aa', width: 2.2 },
    path: { color: '#a9a58f', width: 2 },
    track: { color: '#a59a82', width: 3 },
    rail: { color: '#3a2b22', width: 3.2 },
  };
  const DEFAULT_HEIGHTS = {
    house: 7,
    detached: 7,
    residential: 15,
    apartments: 24,
    commercial: 12,
    retail: 8,
    industrial: 10,
    warehouse: 9,
    garage: 3,
    garages: 3,
    shed: 3,
    school: 10,
    hospital: 18,
    church: 15,
    cathedral: 25,
    hotel: 20,
    office: 20,
    service: 5,
    yes: 8,
  };

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function parseNumber(value) {
    if (value === null || value === undefined) return null;
    const match = String(value).match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return null;
    const result = parseFloat(match[0].replace(',', '.'));
    return Number.isFinite(result) ? result : null;
  }

  function bboxInfo(bbox) {
    const south = bbox[0], west = bbox[1], north = bbox[2], east = bbox[3];
    const lat0 = (south + north) / 2;
    const lon0 = (west + east) / 2;
    const mPerLat = 111132.92 - 559.82 * Math.cos(2 * lat0 * RAD)
      + 1.175 * Math.cos(4 * lat0 * RAD) - 0.0023 * Math.cos(6 * lat0 * RAD);
    const mPerLon = 111412.84 * Math.cos(lat0 * RAD)
      - 93.5 * Math.cos(3 * lat0 * RAD) + 0.118 * Math.cos(5 * lat0 * RAD);
    const width = (east - west) * mPerLon;
    const height = (north - south) * mPerLat;
    return {
      south, west, north, east, lat0, lon0, mPerLat, mPerLon,
      width, height, areaKm2: Math.abs(width * height) / 1e6,
      xMin: -Math.abs(width) / 2, xMax: Math.abs(width) / 2,
      yMin: -Math.abs(height) / 2, yMax: Math.abs(height) / 2,
      toX: (lon) => (lon - lon0) * mPerLon,
      toY: (lat) => (lat - lat0) * mPerLat,
      toLon: (x) => lon0 + x / mPerLon,
      toLat: (y) => lat0 + y / mPerLat,
    };
  }

  function cleanRing(ring) {
    const result = [];
    for (const point of ring || []) {
      if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
      const last = result[result.length - 1];
      if (!last || Math.abs(point[0] - last[0]) > 1e-9 || Math.abs(point[1] - last[1]) > 1e-9) {
        result.push([point[0], point[1]]);
      }
    }
    if (result.length > 2) {
      const first = result[0], last = result[result.length - 1];
      if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) result.pop();
    }
    return result;
  }

  function signedArea(ring) {
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    return area / 2;
  }

  function ensureCCW(ring) {
    const copy = ring.map((p) => [p[0], p[1]]);
    if (signedArea(copy) < 0) copy.reverse();
    return copy;
  }

  function triangulateRing(ring) {
    const points = ensureCCW(cleanRing(ring));
    if (points.length < 3) return { points: [], triangles: [] };
    if (points.length === 3) return { points, triangles: [[0, 1, 2]] };
    return triangulateRingsScanline([points]);
  }

  function ensureCW(ring) {
    const copy = ring.map((p) => [p[0], p[1]]);
    if (signedArea(copy) > 0) copy.reverse();
    return copy;
  }

  function pointInRing(point, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if (((a[1] > point[1]) !== (b[1] > point[1]))
        && (point[0] < (b[0] - a[0]) * (point[1] - a[1]) / ((b[1] - a[1]) || 1e-12) + a[0])) {
        inside = !inside;
      }
    }
    return inside;
  }

  function triangulatePolygon(outer, holes) {
    const cleanOuter = ensureCCW(cleanRing(outer));
    if (cleanOuter.length < 3) return { points: [], triangles: [] };
    const cleanHoles = (holes || [])
      .map((ring) => cleanRing(ring))
      .filter((ring) => ring.length >= 3);
    if (!cleanHoles.length) return triangulateRing(cleanOuter);
    return triangulateRingsScanline([cleanOuter, ...cleanHoles]);
  }

  function triangulateRingsScanline(rings) {
    const edges = [];
    const xs = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        xs.push(a[0]);
        if (Math.abs(b[0] - a[0]) < 1e-9) continue;
        edges.push({ a, b, minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]) });
      }
    }
    xs.sort((a, b) => a - b);
    edges.sort((a, b) => a.minX - b.minX);
    const unique = [];
    for (const x of xs) {
      if (!unique.length || Math.abs(x - unique[unique.length - 1]) > 1e-7) unique.push(x);
    }
    const points = [];
    const triangles = [];
    const edgeY = (edge, x) => {
      const dx = edge.b[0] - edge.a[0];
      return edge.a[1] + (edge.b[1] - edge.a[1]) * (x - edge.a[0]) / dx;
    };
    const addPoint = (point) => {
      points.push(point);
      return points.length - 1;
    };
    const addTriangle = (ia, ib, ic) => {
      const a = points[ia], b = points[ib], c = points[ic];
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-8) return;
      if (area > 0) triangles.push([ia, ib, ic]);
      else triangles.push([ia, ic, ib]);
    };
    let nextEdge = 0;
    let active = [];
    for (let k = 0; k + 1 < unique.length; k++) {
      const left = unique[k], right = unique[k + 1];
      if (right - left < 1e-7) continue;
      while (nextEdge < edges.length && edges[nextEdge].minX <= left + 1e-9) {
        active.push(edges[nextEdge++]);
      }
      active = active.filter((edge) => edge.maxX >= right - 1e-9);
      const middle = (left + right) / 2;
      const hits = [];
      for (const edge of active) {
        if (middle < edge.minX - 1e-9 || middle > edge.maxX + 1e-9) continue;
        hits.push({ y: edgeY(edge, middle), edge });
      }
      hits.sort((a, b) => a.y - b.y);
      for (let i = 0; i + 1 < hits.length; i += 2) {
        const lower = hits[i], upper = hits[i + 1];
        if (upper.y - lower.y < 1e-7) continue;
        const p0 = [left, edgeY(lower.edge, left)];
        const p1 = [right, edgeY(lower.edge, right)];
        const p2 = [right, edgeY(upper.edge, right)];
        const p3 = [left, edgeY(upper.edge, left)];
        if (Math.abs(p0[1] - p3[1]) < 1e-7 && Math.abs(p1[1] - p2[1]) < 1e-7) continue;
        const i0 = addPoint(p0);
        const i1 = addPoint(p1);
        const i2 = addPoint(p2);
        const i3 = addPoint(p3);
        addTriangle(i0, i1, i2);
        addTriangle(i0, i2, i3);
      }
    }
    return { points, triangles };
  }

  function clipRing(ring, bbox) {
    if (!ring || ring.length < 3) return [];
    let points = ring.map((p) => [p[0], p[1]]);
    const edges = [
      [0, (value) => value >= bbox.xMin, (a, b) => intersectX(a, b, bbox.xMin)],
      [0, (value) => value <= bbox.xMax, (a, b) => intersectX(a, b, bbox.xMax)],
      [1, (value) => value >= bbox.yMin, (a, b) => intersectY(a, b, bbox.yMin)],
      [1, (value) => value <= bbox.yMax, (a, b) => intersectY(a, b, bbox.yMax)],
    ];
    for (const [axis, inside, cut] of edges) {
      const output = [];
      for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const previous = points[(i - 1 + points.length) % points.length];
        const currentIn = inside(current[axis]);
        const previousIn = inside(previous[axis]);
        if (currentIn) {
          if (!previousIn) output.push(cut(previous, current));
          output.push(current);
        } else if (previousIn) {
          output.push(cut(previous, current));
        }
      }
      points = output;
      if (!points.length) return [];
    }
    return cleanRing(points);
  }

  function intersectX(a, b, x) {
    const t = (x - a[0]) / (b[0] - a[0]);
    return [x, a[1] + (b[1] - a[1]) * t];
  }

  function intersectY(a, b, y) {
    const t = (y - a[1]) / (b[1] - a[1]);
    return [a[0] + (b[0] - a[0]) * t, y];
  }

  function buildingHeight(tags) {
    const height = parseNumber(tags.height || tags['building:height']);
    if (height !== null) {
      const text = String(tags.height || '').toLowerCase();
      return clamp(text.includes('ft') || text.includes("'") ? height * 0.3048 : height, 2, 300);
    }
    const levels = parseNumber(tags['building:levels'] || tags.levels);
    if (levels !== null && levels > 0) {
      return clamp(levels * 3.1 + 0.7 + (parseNumber(tags['roof:height']) || 0), 2, 300);
    }
    const kind = String(tags.building || tags['building:part'] || 'yes').toLowerCase();
    return clamp(DEFAULT_HEIGHTS[kind] || 8, 2, 300);
  }

  function sampleTerrain(terrain, x, y) {
    const nx = terrain.nx, ny = terrain.ny;
    const u = clamp((x - terrain.xMin) / (terrain.xMax - terrain.xMin), 0, 1) * (nx - 1);
    const v = clamp((y - terrain.yMin) / (terrain.yMax - terrain.yMin), 0, 1) * (ny - 1);
    const i0 = Math.floor(u), j0 = Math.floor(v);
    const i1 = Math.min(nx - 1, i0 + 1), j1 = Math.min(ny - 1, j0 + 1);
    const fu = u - i0, fv = v - j0;
    const a = terrain.z[j0 * nx + i0], b = terrain.z[j0 * nx + i1];
    const c = terrain.z[j1 * nx + i0], d = terrain.z[j1 * nx + i1];
    return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
  }

  function mercatorX(lon) {
    return lon * 20037508.34 / 180;
  }

  function mercatorY(lat) {
    const clipped = clamp(lat, -85.05112878, 85.05112878);
    return Math.log(Math.tan((90 + clipped) * Math.PI / 360)) * 20037508.34 / Math.PI;
  }

  function terrainMesh(terrain) {
    const nx = terrain.nx, ny = terrain.ny;
    const positions = new Float64Array(nx * ny * 3);
    const uvs = new Float64Array(nx * ny * 2);
    const normals = new Float64Array(nx * ny * 3);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = terrain.xs[i], y = terrain.ys[j];
        const z = terrain.z[k] - terrain.baseElevation;
        positions[k * 3] = x;
        positions[k * 3 + 1] = y;
        positions[k * 3 + 2] = z;
        if (terrain.info) {
          const lon = terrain.info.toLon(x), lat = terrain.info.toLat(y);
          const mx = mercatorX(lon), my = mercatorY(lat);
          const west = mercatorX(terrain.info.west), east = mercatorX(terrain.info.east);
          const south = mercatorY(terrain.info.south), north = mercatorY(terrain.info.north);
          uvs[k * 2] = (mx - west) / Math.max(1e-9, east - west);
          uvs[k * 2 + 1] = (my - south) / Math.max(1e-9, north - south);
        } else {
          uvs[k * 2] = (x - terrain.xMin) / (terrain.xMax - terrain.xMin);
          uvs[k * 2 + 1] = (y - terrain.yMin) / (terrain.yMax - terrain.yMin);
        }
        const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1);
        const j0 = Math.max(0, j - 1), j1 = Math.min(ny - 1, j + 1);
        const dzdx = (terrain.z[j * nx + i1] - terrain.z[j * nx + i0])
          / Math.max(1e-6, terrain.xs[i1] - terrain.xs[i0]);
        const dzdy = (terrain.z[j1 * nx + i] - terrain.z[j0 * nx + i])
          / Math.max(1e-6, terrain.ys[j1] - terrain.ys[j0]);
        const len = Math.hypot(-dzdx, -dzdy, 1);
        normals[k * 3] = -dzdx / len;
        normals[k * 3 + 1] = -dzdy / len;
        normals[k * 3 + 2] = 1 / len;
      }
    }
    const indices = new Uint32Array((nx - 1) * (ny - 1) * 6);
    let p = 0;
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx + 1, d = a + nx;
        indices[p++] = a; indices[p++] = b; indices[p++] = c;
        indices[p++] = a; indices[p++] = c; indices[p++] = d;
      }
    }
    return {
      name: 'terrain', material: 'terrain', color: COLORS.terrain,
      positions, normals, uvs, indices, textured: true,
    };
  }

  function appendMesh(target, source) {
    const offset = target.positions.length / 3;
    if (source.positions && source.positions.length) {
      const pos = new Float32Array(target.positions.length + source.positions.length);
      pos.set(target.positions, 0);
      pos.set(source.positions, target.positions.length);
      target.positions = pos;
    }
    if (source.normals && source.normals.length) {
      const norm = new Float32Array(target.normals.length + source.normals.length);
      norm.set(target.normals, 0);
      norm.set(source.normals, target.normals.length);
      target.normals = norm;
    }
    if (source.indices && source.indices.length) {
      const idx = new Uint32Array(target.indices.length + source.indices.length);
      idx.set(target.indices, 0);
      for (let i = 0; i < source.indices.length; i++) {
        idx[target.indices.length + i] = source.indices[i] + offset;
      }
      target.indices = idx;
    }
  }

  function addQuad(positions, normals, indices, a, b, c, d, normal) {
    const offset = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    if (normal) {
      for (let i = 0; i < 4; i++) normals.push(normal[0], normal[1], normal[2]);
    }
  }

  function buildingMesh(buildings, terrain) {
    const positions = [], normals = [], indices = [];
    for (const building of buildings) {
      for (const rawRing of building.rings || []) {
        const clipped = clipRing(rawRing, terrain);
        if (clipped.length < 3) continue;
        const ring = ensureCCW(clipped);
        if (Math.abs(signedArea(ring)) < 4) continue;
        const triangulated = triangulateRing(ring);
        if (!triangulated.triangles.length) continue;
        let ground = Infinity;
        for (const p of ring) ground = Math.min(ground, sampleTerrain(terrain, p[0], p[1]));
        ground -= terrain.baseElevation;
        const base = ground - BUILDING_FOUNDATION_M;
        const top = ground + building.height;
        const offset = positions.length / 3;
        for (const p of triangulated.points) {
          positions.push(p[0], p[1], top);
          normals.push(0, 0, 1);
        }
        for (const tri of triangulated.triangles) {
          indices.push(offset + tri[0], offset + tri[1], offset + tri[2]);
        }
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05) continue;
          const dx = b[0] - a[0], dy = b[1] - a[1];
          const len = Math.hypot(dx, dy);
          const nx = dy / len, ny = -dx / len;
          addQuad(
            positions, normals, indices,
            [a[0], a[1], base], [b[0], b[1], base],
            [b[0], b[1], top], [a[0], a[1], top],
            [nx, ny, 0]
          );
        }
      }
    }
    return {
      name: 'buildings', material: 'building', color: COLORS.building,
      positions: new Float32Array(positions), normals: new Float32Array(normals),
      indices: new Uint32Array(indices), textured: false,
    };
  }

  function roadMesh(roads, terrain) {
    const groups = new Map();
    for (const road of roads) {
      const kind = road.kind;
      const style = ROAD_STYLES[kind] || ROAD_STYLES.rail;
      if (!groups.has(kind)) {
        groups.set(kind, {
          name: 'roads_' + kind.replace(/[^a-z0-9_]/gi, '_'),
          material: kind === 'rail' ? 'rail' : 'road',
          color: hexColor(style.color),
          positions: [], normals: [], indices: [], textured: false,
        });
      }
      const group = groups.get(kind);
      const coords = road.coords;
      const offset = kind === 'rail' ? LAYER_OFFSETS.rail : LAYER_OFFSETS.road;
      const maxStep = 12;
      for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i], b = coords[i + 1];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        if (len < 0.25) continue;
        const nx = -dy / len * road.width / 2;
        const ny = dx / len * road.width / 2;
        const pieces = Math.max(1, Math.ceil(len / maxStep));
        for (let j = 0; j < pieces; j++) {
          const t0 = j / pieces, t1 = (j + 1) / pieces;
          const ax = a[0] + dx * t0, ay = a[1] + dy * t0;
          const bx = a[0] + dx * t1, by = a[1] + dy * t1;
          const za = sampleTerrain(terrain, ax, ay) - terrain.baseElevation + offset;
          const zb = sampleTerrain(terrain, bx, by) - terrain.baseElevation + offset;
          addQuad(
            group.positions, group.normals, group.indices,
            [ax + nx, ay + ny, za], [bx + nx, by + ny, zb],
            [bx - nx, by - ny, zb], [ax - nx, ay - ny, za],
            [0, 0, 1]
          );
        }
      }
    }
    return Array.from(groups.values()).map((group) => ({
      ...group,
      positions: new Float32Array(group.positions),
      normals: new Float32Array(group.normals),
      indices: new Uint32Array(group.indices),
    })).filter((group) => group.indices.length > 0);
  }

  function waterMesh(water, terrain) {
    const positions = [], normals = [], indices = [];
    for (const body of water || []) {
      const clipped = clipRing(body.outer || body.rings?.[0] || [], terrain);
      if (clipped.length < 3) continue;
      const outer = ensureCCW(clipped);
      const holes = [];
      for (const raw of body.holes || []) {
        const hole = clipRing(raw, terrain);
        if (hole.length >= 3) holes.push(hole);
      }
      const triangulated = triangulatePolygon(outer, holes);
      if (!triangulated.triangles.length) continue;
      const offset = positions.length / 3;
      for (const point of triangulated.points) {
        positions.push(point[0], point[1],
          sampleTerrain(terrain, point[0], point[1]) - terrain.baseElevation + LAYER_OFFSETS.water);
        normals.push(0, 0, 1);
      }
      for (const tri of triangulated.triangles) {
        indices.push(offset + tri[0], offset + tri[1], offset + tri[2]);
      }
    }
    return {
      name: 'water', material: 'water', color: COLORS.water,
      positions: new Float32Array(positions), normals: new Float32Array(normals),
      indices: new Uint32Array(indices), textured: false,
    };
  }

  function hexColor(value) {
    const clean = String(value || '#ffffff').replace('#', '');
    const expanded = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const number = parseInt(expanded, 16);
    if (!Number.isFinite(number)) return [1, 1, 1, 1];
    return [
      ((number >> 16) & 255) / 255,
      ((number >> 8) & 255) / 255,
      (number & 255) / 255,
      1,
    ];
  }

  function toTriangles(group) {
    if (!group.indices || !group.indices.length) return [];
    const result = [];
    for (let i = 0; i + 2 < group.indices.length; i += 3) {
      result.push([group.indices[i], group.indices[i + 1], group.indices[i + 2]]);
    }
    return result;
  }

  function buildObj(groups, options) {
    const name = options.name || 'zone';
    const texture = options.texture || 'textures/hybrid.jpg';
    const lines = [`mtllib ${name}.mtl`];
    const mtl = [];
    const materials = new Set();
    let vertexBase = 1, uvBase = 1, normalBase = 1;
    for (const group of groups) {
      if (!group.positions.length || !group.indices.length) continue;
      const material = group.textured ? 'terrain_hybrid' : group.material;
      materials.add(material);
      lines.push('o ' + group.name);
      lines.push('usemtl ' + material);
      for (let i = 0; i < group.positions.length; i += 3) {
        lines.push(`v ${fmt(group.positions[i])} ${fmt(group.positions[i + 1])} ${fmt(group.positions[i + 2])}`);
      }
      const hasUv = group.uvs && group.uvs.length;
      if (hasUv) {
        for (let i = 0; i < group.uvs.length; i += 2) {
          lines.push(`vt ${fmt6(group.uvs[i])} ${fmt6(group.uvs[i + 1])}`);
        }
      }
      const hasNormal = group.normals && group.normals.length;
      if (hasNormal) {
        for (let i = 0; i < group.normals.length; i += 3) {
          lines.push(`vn ${fmt6(group.normals[i])} ${fmt6(group.normals[i + 1])} ${fmt6(group.normals[i + 2])}`);
        }
      }
      for (let i = 0; i < group.indices.length; i += 3) {
        const face = [group.indices[i], group.indices[i + 1], group.indices[i + 2]].map((idx) => {
          let value = String(vertexBase + idx);
          if (hasUv && hasNormal) value += `/${uvBase + idx}/${normalBase + idx}`;
          else if (hasUv) value += `/${uvBase + idx}`;
          else if (hasNormal) value += `//${normalBase + idx}`;
          return value;
        }).join(' ');
        lines.push('f ' + face);
      }
      vertexBase += group.positions.length / 3;
      if (hasUv) uvBase += group.uvs.length / 2;
      if (hasNormal) normalBase += group.normals.length / 3;
    }
    mtl.push('newmtl terrain_hybrid');
    mtl.push('Ka 1.000 1.000 1.000', 'Kd 1.000 1.000 1.000', 'Ks 0 0 0', 'd 1.0', 'illum 1');
    mtl.push(`map_Kd ${texture}`, '');
    for (const material of materials) {
      if (material === 'terrain_hybrid') continue;
      const color = material === 'building' ? COLORS.building
        : material === 'rail' ? COLORS.rail
        : material === 'water' ? COLORS.water : COLORS.road;
      mtl.push(`newmtl ${material}`);
      mtl.push(`Kd ${fmt(color[0])} ${fmt(color[1])} ${fmt(color[2])}`, 'Ks 0 0 0', 'd 1.0', 'illum 1', '');
    }
    return { obj: lines.join('\n') + '\n', mtl: mtl.join('\n') + '\n' };
  }

  function fmt(value) {
    return Number(value).toFixed(4);
  }

  function fmt6(value) {
    return Number(value).toFixed(6);
  }

  function finalizeNormals(group) {
    if (group.normals && group.normals.length === group.positions.length) return;
    const length = group.positions.length / 3;
    const normals = new Float32Array(length * 3);
    for (let i = 0; i < group.indices.length; i += 3) {
      const ia = group.indices[i] * 3, ib = group.indices[i + 1] * 3, ic = group.indices[i + 2] * 3;
      const ax = group.positions[ia], ay = group.positions[ia + 1], az = group.positions[ia + 2];
      const bx = group.positions[ib], by = group.positions[ib + 1], bz = group.positions[ib + 2];
      const cx = group.positions[ic], cy = group.positions[ic + 1], cz = group.positions[ic + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      normals[ia] += nx; normals[ia + 1] += ny; normals[ia + 2] += nz;
      normals[ib] += nx; normals[ib + 1] += ny; normals[ib + 2] += nz;
      normals[ic] += nx; normals[ic + 1] += ny; normals[ic + 2] += nz;
    }
    for (let i = 0; i < normals.length; i += 3) {
      const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
      normals[i] /= len; normals[i + 1] /= len; normals[i + 2] /= len;
    }
    group.normals = normals;
  }

  function buildGlb(groups, textureBytes, mime) {
    const binary = [];
    let binaryLength = 0;
    const views = [];
    const accessors = [];
    const materials = [];
    const materialIndex = {};
    const materialColors = {
      terrain: COLORS.terrain,
      building: COLORS.building,
      rail: COLORS.rail,
      road: COLORS.road,
      water: COLORS.water,
    };
    for (const key of Object.keys(materialColors)) {
      materialIndex[key] = materials.length;
      materials.push({
        name: key,
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: materialColors[key].slice(),
          metallicFactor: 0,
          roughnessFactor: 0.9,
        },
      });
    }
    const addView = (bytes, target) => {
      while (binaryLength % 4) { binary.push(0); binaryLength++; }
      const offset = binaryLength;
      for (const byte of bytes) { binary.push(byte); binaryLength++; }
      const view = { buffer: 0, byteOffset: offset, byteLength: bytes.length };
      if (target) view.target = target;
      views.push(view);
      return views.length - 1;
    };
    const addAccessor = (array, type, componentType, minmax) => {
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      const view = addView(bytes, type === 'SCALAR' ? 34963 : 34962);
      const accessor = {
        bufferView: view, componentType, count: array.length / (type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1),
        type,
      };
      if (minmax) {
        const count = type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1;
        const min = new Array(count).fill(Infinity);
        const max = new Array(count).fill(-Infinity);
        for (let i = 0; i < array.length; i += count) {
          for (let j = 0; j < count; j++) {
            min[j] = Math.min(min[j], array[i + j]);
            max[j] = Math.max(max[j], array[i + j]);
          }
        }
        accessor.min = min;
        accessor.max = max;
      }
      accessors.push(accessor);
      return accessors.length - 1;
    };
    let imageView = null;
    if (textureBytes && textureBytes.length) {
      imageView = addView(textureBytes, 0);
    }
    const primitives = [];
    for (const group of groups) {
      if (!group.positions.length || !group.indices.length) continue;
      finalizeNormals(group);
      const count = group.positions.length / 3;
      const positions = new Float32Array(count * 3);
      const normals = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const x = group.positions[i * 3], y = group.positions[i * 3 + 1], z = group.positions[i * 3 + 2];
        positions[i * 3] = x;
        positions[i * 3 + 1] = z;
        positions[i * 3 + 2] = -y;
        const nx = group.normals[i * 3], ny = group.normals[i * 3 + 1], nz = group.normals[i * 3 + 2];
        normals[i * 3] = nx;
        normals[i * 3 + 1] = nz;
        normals[i * 3 + 2] = -ny;
      }
      const indices = new Uint32Array(group.indices.length);
      for (let i = 0; i < group.indices.length; i++) indices[i] = group.indices[i];
      const attributes = {
        POSITION: addAccessor(positions, 'VEC3', 5126, true),
        NORMAL: addAccessor(normals, 'VEC3', 5126, false),
      };
      if (group.uvs && group.uvs.length) {
        const uvs = new Float32Array(group.uvs.length);
        for (let i = 0; i < group.uvs.length; i += 2) {
          uvs[i] = group.uvs[i];
          uvs[i + 1] = 1 - group.uvs[i + 1];
        }
        attributes.TEXCOORD_0 = addAccessor(uvs, 'VEC2', 5126, false);
      }
      const material = group.textured && imageView !== null
        ? materialIndex.terrain
        : materialIndex[group.material] || materialIndex.road;
      primitives.push({
        attributes,
        indices: addAccessor(indices, 'SCALAR', 5125, false),
        material,
        mode: 4,
      });
    }
    if (imageView === null) {
      materials[materialIndex.terrain].pbrMetallicRoughness.baseColorFactor = [0.45, 0.55, 0.42, 1];
    } else {
      materials[materialIndex.terrain].pbrMetallicRoughness.baseColorTexture = { index: 0 };
    }
    const document = {
      asset: { version: '2.0', generator: '3Dmaps standalone 0.2.11' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: '3Dmaps' }],
      meshes: [{ primitives }],
      materials,
      buffers: [{ byteLength: binaryLength }],
      bufferViews: views,
      accessors,
    };
    if (imageView !== null) {
      document.images = [{ bufferView: imageView, mimeType: mime || 'image/jpeg' }];
      document.textures = [{ sampler: 0, source: 0 }];
      document.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
    }
    const json = new TextEncoder().encode(JSON.stringify(document));
    const jsonPad = (4 - json.length % 4) % 4;
    const binPad = (4 - binaryLength % 4) % 4;
    const total = 12 + 8 + json.length + jsonPad + 8 + binaryLength + binPad;
    const output = new Uint8Array(total);
    const view = new DataView(output.buffer);
    view.setUint32(0, 0x46546C67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, total, true);
    view.setUint32(12, json.length + jsonPad, true);
    view.setUint32(16, 0x4E4F534A, true);
    output.set(json, 20);
    for (let i = 0; i < jsonPad; i++) output[20 + json.length + i] = 0x20;
    const binStart = 20 + json.length + jsonPad;
    view.setUint32(binStart, binaryLength + binPad, true);
    view.setUint32(binStart + 4, 0x004E4942, true);
    output.set(binary, binStart + 8);
    return output;
  }

  function simplifyRing(ring, tolerance) {
    const points = cleanRing(ring);
    if (points.length <= 4 || !tolerance) return points;
    const result = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const last = result[result.length - 1];
      if (Math.hypot(points[i][0] - last[0], points[i][1] - last[1]) >= tolerance) result.push(points[i]);
    }
    if (result.length < 3) return points;
    return result;
  }

  root.D3M = {
    RAD, DEG, EARTH_RADIUS, COLORS, ROAD_STYLES, DEFAULT_HEIGHTS,
    clamp, parseNumber, bboxInfo, cleanRing, signedArea, ensureCCW,
    triangulateRing, triangulatePolygon, pointInRing, ensureCW, clipRing,
    buildingHeight, sampleTerrain, mercatorX, mercatorY,
    terrainMesh, buildingMesh, roadMesh, waterMesh, buildObj, buildGlb,
    finalizeNormals, simplifyRing, hexColor, LAYER_OFFSETS, BUILDING_FOUNDATION_M,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.D3M;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {}));
