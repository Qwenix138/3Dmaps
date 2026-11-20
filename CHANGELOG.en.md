# Changelog

## 0.2.11 / desktop 0.1.3 — 2026-11-20

### Added

- OSM water layer: lakes, reservoirs, basins, rivers, streams and canals; islands and polygon holes.
- Water in textures, preview, `meta.json` and the Android result summary.
- Building foundations, layer Z-offsets and road/rail tessellation.
- EOX 2×2 satellite tiles with retries, blank-tile checks and fallback.
- Mercator terrain UVs, `water` export in OBJ/MTL and GLB (`doubleSided`).
- `tests/test_water.py` and satellite orientation tests.

### Fixed

- North-up satellite tile orientation on desktop and Android.
- Polygon-with-holes triangulation on Android (scanline).
- Multipolygon relation assembly from split OSM ways.
- Variant files, MTL and texture export next to OBJ.
- Android: blank EOX tiles no longer end up in the texture.

### Builds

- Android: `3Dmaps-0.2.11.apk`, versionCode 13.
- Linux: `3dmapgen_0.1.3_amd64.deb`, `3dmapgen-linux-x86_64.tar.gz`.
- Windows: `3dmapgen-windows-x86_64.zip`.

## 0.2.10 / desktop 0.1.2 — 2026-11-20

### Fixed

- Android: if Overpass is unavailable or cannot resolve, OSM loads in tiles from the OSM API; tiles split automatically when they hit the 50,000-node limit.
- Android: errors from all OSM sources are combined instead of showing only the last one.
- Android: Overpass timeout is 60 seconds per mirror, with progress for mirrors and tiles.
- Android: `overpass.private.coffee` is replaced by `overpass.openstreetmap.ru`.
- Android: version 0.2.10, versionCode 12.

## 0.2.9 / desktop 0.1.2 — 2026-11-20


### Fixed

- Android: dense cities such as New York no longer fail with `HTTP 400: You requested too many nodes (limit is 50000)`.
- Android: automatically falls back to Overpass when the OSM API fails; areas over 8 km² use Overpass directly.
- Android: clearer OSM errors and Overpass loading progress.
- Android: version 0.2.9, versionCode 11.

## 0.2.8 / desktop 0.1.2 — 2026-11-20


### Added

- Russian and English UI on Android and desktop; language choice is persisted.
- Fast / Balanced / Detailed quality presets on Android and desktop.
- Android result summary: area, triangles, buildings, roads and warnings.
- Desktop DEM smoothing: CLI `--smoothing`, API `smoothing`, UI control.
- Improved panel, card, status and file-list design.
- English documentation, changelog and a release folder with checksums.
- `tests/test_elevation.py` and `tests/test_ui_i18n.py`.

### Fixed

- Android: correct `.obj`/`.mtl` extensions when saving to Download.
- Android: terrain height and DEM smoothing are applied before export.
- Desktop: GLB `generator` now uses `__version__`.
- Desktop: language, quality and summary survive language switching.
- Desktop: correct km² area formatting for the selected language.
- Old APK and desktop builds removed from release folders.

### Builds

- Android: `3Dmaps-0.2.8.apk`, versionCode 10, Android 6+.
- Linux: `3dmapgen_0.1.2_amd64.deb`, `3dmapgen-linux-x86_64.tar.gz`.
- Windows: `3dmapgen-windows-x86_64.zip`.

## 0.2.7 / desktop 0.1.1

- Android: fixed OBJ/MTL MIME/extensions; added terrain height and smoothing.
- Desktop: height scale, improved portable builds, updated README inside archives.
- Linux: rebuilt `.deb`, tar and Windows zip; qemu verification.

## 0.1.0

- First public release: web UI, CLI, OBJ/GLB and Android APK.
