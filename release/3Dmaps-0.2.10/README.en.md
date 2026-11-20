# 3Dmaps

[Русский](README.ru.md) · [English](README.en.md)

A free generator of 3D map areas for Blender and other 3D editors. Select a rectangle on the map — 3Dmaps builds terrain, buildings, roads and railways, applies textures and exports the scene as OBJ/GLB.

The project uses OpenStreetMap and open elevation data instead of Google Maps. Google tiles and Google 3D cannot be legally exported as a model, so Google is not used as a geometry or texture source.

## Download

Official repository: [github.com/Qwenix138/3Dmaps](https://github.com/Qwenix138/3Dmaps). Ready builds are on [GitHub Releases](https://github.com/Qwenix138/3Dmaps/releases/tag/v0.2.10):

- [Android APK 0.2.10](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3Dmaps-0.2.10.apk) — Android 6+;
- [Linux .deb 0.1.2](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3dmapgen_0.1.2_amd64.deb) — Debian/Ubuntu x86_64;
- [Linux portable 0.1.2](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3dmapgen-linux-x86_64.tar.gz);
- [Windows portable 0.1.2](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3dmapgen-windows-x86_64.zip).

The project is open source under the MIT license. Verify downloads with `sha256sum -c SHA256SUMS` from the release.

## Features

- Rectangle selection in a Leaflet web interface.
- Russian and English UI: switch the language in the header; the choice is remembered.
- Place search via Nominatim and a “My location” button.
- Terrain from Terrarium DEM with configurable grid step, height and smoothing.
- Fast / Balanced / Detailed quality presets.
- Real OSM building footprints with grey prisms and tagged heights.
- Roads and railways with widths by type.
- Textures:
  - `satellite.jpg` — Sentinel-2 cloudless via EOX WMS;
  - `labels.png` — labels and map linework rendered from OSM;
  - `hybrid.jpg` — satellite with labels and roads;
  - `labels_overlay.png` — transparent layer for custom materials;
  - `relief.jpg` — fallback texture when satellite is unavailable.
- OBJ+MTL and GLB export with embedded textures.
- Heightmap as PNG and NumPy `.npy`.
- `meta.json` with bbox, elevations, object counts, attribution and licenses.
- Built-in Three.js preview.
- CLI for batch generation without a browser.
- Standalone Android APK: generation on the phone, no server or Termux.

## Limitations

- Maximum area is 500 km²; the UI warns above 20×20 km. The Android app is limited to 15×15 km (225 km²); 2–4 km² works best in dense cities.
- Terrain accuracy depends on DEM and grid step: 30 m by default. This is not LiDAR.
- Building height comes from `height`, `building:levels` or a default value. Real height may differ.
- The OSM API is suitable only for small areas up to about 6 km². Larger areas use Overpass and fall back to PBF.
- Automatic PBF selection is implemented for Geofabrik regions of Russia. For other countries, pass a local file via `--pbf` or use Overpass.
- EOX satellite imagery is **CC BY-NC-SA 4.0**: non-commercial use. For commercial projects, use your own imagery.
- This is not photogrammetry or a ready GIS model: buildings are simplified, and trees/small objects are not exported.
- A large 20×20 km area with a 4096 or 8192 texture may use a lot of RAM and disk space.

## Installation

Python 3.10+ is required. Python 3.12–3.14 is recommended.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

On Android/Termux or a FUSE mount, creating `.venv` inside the project may fail due to symlinks. Create the environment outside the project:

```bash
python -m venv /root/.venvs/3dmap
/root/.venvs/3dmap/bin/python -m pip install -r requirements.txt
```

For development:

```bash
pip install -r requirements-dev.txt
python -m pytest
```

## Web interface

```bash
python -m mapgen.web --host 127.0.0.1 --port 8000 --open
```

Open `http://127.0.0.1:8000`. Choose RU/EN, draw a rectangle, set the name, quality, terrain height and smoothing, then click “Generate 3D area”.

Results are written to `output/<time>-<id>-<name>/`. The preview button loads the GLB in Three.js. The browser needs internet and the unpkg CDN, or local Leaflet/Three.js copies.

Quality presets: Fast — 60 m step, 2048 texture, smoothing 1; Balanced — 30 m, 4096, no smoothing; Detailed — 15 m, 4096, no smoothing. Every value can be changed manually.

### Android APK

Ready APK: [3Dmaps-0.2.10.apk](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3Dmaps-0.2.10.apk) (Android 6+). It is standalone: no Python, Termux or separate server. The generator runs in a WebView, and a Java bridge downloads OSM/DEM/satellite data and saves files to `Download/3Dmaps/<name>/`.

Install the APK, open 3Dmaps and draw a rectangle. Resize it with 8 handles, move it by the center point or from inside, or use a 0.5–3 km preset; width, height and center are available in the “Exact size” section. Internet is required for the map, OSM, Terrarium elevations and EOX satellite imagery; generation and export run on the phone. The map shows area size, scale, zoom and coordinates. Maximum area is 15×15 km (225 km²); 2–4 km² works best downtown. Terrain step is 10–60 m, height 0.5×–2×, DEM smoothing, texture 512–2048 px. Save everything, GLB only, or OBJ+MTL; OBJ is saved with the correct `.obj` extension.

Version 0.2.10 fixes OSM loading for dense cities such as New York: the OSM API 50,000-node limit falls back to Overpass, and then to automatically split OSM API tiles if Overpass is unavailable. Errors from all sources are combined. It also adds English, quality presets and a result summary. Sources and the build script are in `android/`; old APKs are removed and the current build is in the release folder.

### API

- `GET /health` — server check.
- `POST /api/generate` — create a job. Body: `bbox`, `name`, `terrain_spacing`, `height_scale`, `smoothing`, `texture_size`, `labels`, `satellite`, `buildings`, `roads`, `railways`.
- `GET /api/jobs/<id>` — status, progress and file list.
- `GET /files/<id>/<path>` — download a file.
- `GET /view/<id>` — 3D preview.

Example:

```bash
curl -s http://127.0.0.1:8000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"bbox":[47.220,39.690,47.225,39.700],"name":"rostov","texture_size":2048,"smoothing":1}'
```

## CLI

```bash
python -m mapgen.cli \
  --bbox 47.220,39.690,47.225,39.700 \
  --name rostov \
  --out output/rostov \
  --texture-size 2048 \
  --smoothing 1
```

Center and size:

```bash
python -m mapgen.cli --center 47.222,39.710 --size-km 2,1 --name center
```

No satellite or labels:

```bash
python -m mapgen.cli --bbox 47.220,39.690,47.225,39.700 --no-satellite --no-labels
```

Large area with a local PBF:

```bash
python -m mapgen.cli \
  --center 47.222,39.710 \
  --size-km 12 \
  --osm-source pbf \
  --pbf /path/to/region-latest.osm.pbf \
  --texture-size 4096 \
  --out output/large
```

Options:

- `--terrain-spacing` — terrain step in metres, 5–120.
- `--texture-size` — 256–8192.
- `--height-scale` — terrain height scale, 0.5–5.0.
- `--smoothing` — DEM smoothing: 0, 1 or 2.
- `--simplify` — building outline simplification, 0–5 m.
- `--custom-satellite` — north-up image stretched over the bbox.
- `--satellite-layer` — EOX WMS layer.
- `--no-buildings`, `--no-roads`, `--no-railways`, `--no-satellite`, `--no-labels`.
- `--json` — print metadata only.

## Output

```text
output/rostov/
├── rostov.obj
├── rostov.mtl
├── rostov.glb
├── rostov_labels.obj
├── rostov_labels.mtl
├── rostov_hybrid.obj
├── rostov_hybrid.mtl
├── heightmap.png
├── heightmap.npy
├── meta.json
└── textures/
    ├── labels.png
    ├── labels_overlay.png
    ├── satellite.jpg
    └── hybrid.jpg
```

`_labels` and `_hybrid` variants are created for areas up to 25 km² and scenes up to 900,000 triangles.

Axes:

- OBJ: `X` east, `Y` north, `Z` up. Suitable for Blender.
- GLB: `X` east, `Y` up, `Z` south. Standard glTF orientation.
- Heightmap: north-up, row 0 is north. `heightmap.png` stores 16-bit normalized heights; `.npy` stores absolute metres.

### Blender

Import `*.glb` via **File → Import → glTF 2.0**. If the object looks grey, switch to **Material Preview** (`Z`). Labels are baked into the texture; buildings, roads and railways are separate geometry. If objects are missing, check `counts.buildings` and `counts.roads` in `meta.json` and make sure you imported the new GLB. If the model is not visible, press `Numpad .` (Frame Selected) and increase **Clip End**.

## Sources and licenses

- OpenStreetMap: © OpenStreetMap contributors, ODbL 1.0.
- Terrarium DEM: Mapzen/Tilezen, SRTM/Copernicus DEM.
- EOX Sentinel-2 cloudless: CC BY-NC-SA 4.0, non-commercial use.
- DejaVu fonts: Bitstream Vera License.
- Project code: [MIT](LICENSE).

See `THIRD_PARTY_NOTICES.md` and `THIRD_PARTY_NOTICES.en.md`. When publishing models, keep the attribution from `meta.json` and the UI.

## Building

The repository contains a GitHub Actions workflow at `.github/workflows/build.yml`. It builds standalone `3dmapgen-cli` and `3dmapgen-web` for Linux x86_64 and Windows x86_64 with PyInstaller and attaches archives to the workflow run.

Local Linux build:

```bash
pip install -r requirements-dev.txt
python -m pip install .
bash packaging/build_local.sh
```

Output: `dist/3dmapgen`, `dist/3dmapgen-web`.

Ready builds:

- [3dmapgen_0.1.2_amd64.deb](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3dmapgen_0.1.2_amd64.deb) — installer for Linux Mint/Ubuntu x86_64;
- [3dmapgen-linux-x86_64.tar.gz](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3dmapgen-linux-x86_64.tar.gz) — portable build with Python, run `./3Dmaps` or `bin/3dmapgen`;
- [3dmapgen-windows-x86_64.zip](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3dmapgen-windows-x86_64.zip) — portable build with Python, run `3Dmaps.exe`;
- [3Dmaps-0.2.10.apk](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3Dmaps-0.2.10.apk) — standalone Android APK.

Install `.deb`: `sudo apt install ./3dmapgen_0.1.2_amd64.deb`. The “3Dmaps” entry appears in the menu and the CLI is available as `3dmapgen`.

Portable builds bundle Python 3.14 and dependency wheels; Linux x86_64 and Windows onefile builds are still produced in GitHub Actions. The onefile web build stores results in `~/3Dmaps/output` and cache in `~/3Dmaps/cache`. Override with `MAPGEN_OUTPUT` and `MAPGEN_CACHE`.

Build the standalone Android APK:

```bash
bash android/build-apk.sh
```

The script builds in `/tmp/3dmapgen-android-build` to avoid Cyrillic path issues in Gradle and copies `release/3Dmaps-<version>/3Dmaps-<version>.apk`. Details, installation and limitations are in `docs/ANDROID.ru.md` and `docs/ANDROID.en.md`.

## Publishing to GitHub

```bash
git init
git add .
git commit -m "3Dmaps 0.2.10"
git branch -M main
git remote add origin https://github.com/Qwenix138/3Dmaps.git
git push -u origin main
```

After the first push, run the `build` workflow manually: Actions → build → Run workflow. Upload binaries from `release/` to a GitHub Release manually; source and documentation go into the repository.

## Project layout

```text
mapgen/
├── buildings.py
├── cli.py
├── config.py
├── elevation.py
├── errors.py
├── export.py
├── geo.py
├── mesh.py
├── osm.py
├── pbf.py
├── pipeline.py
├── roads.py
├── textures.py
├── web.py
├── assets/fonts/
├── static/
└── templates/

android/          # standalone WebView app and APK build script
release/          # ready builds and documentation for GitHub
```

## Tests

```bash
python -m pytest
```

Tests do not use the network: parsers, projection, geometry, heightmap, textures, OBJ/GLB export and UI i18n keys are covered.

## Documentation

- [Русский README](README.ru.md)
- [CHANGELOG.ru.md](CHANGELOG.ru.md) · [CHANGELOG.en.md](CHANGELOG.en.md)
- [Android](docs/ANDROID.ru.md) · [Android English](docs/ANDROID.en.md)
- [Packaging](docs/DESKTOP.ru.md) · [Packaging English](docs/DESKTOP.en.md)
- [Third-party notices](THIRD_PARTY_NOTICES.ru.md) · [English](THIRD_PARTY_NOTICES.en.md)
