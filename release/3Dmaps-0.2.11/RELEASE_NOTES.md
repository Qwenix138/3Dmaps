# 3Dmaps 0.2.11 / desktop 0.1.3

Release date: 2026-11-20

## Highlights

- OSM water layer on desktop and Android: lakes, reservoirs, basins, rivers, streams and canals.
- Water polygons support islands and inner holes; water is rendered in labels/overlay textures, preview, `meta.json` and the Android result summary.
- Building foundations, explicit layer Z-offsets and densified road/rail meshes reduce gaps and Z-fighting.
- EOX satellite imagery now loads as 2×2 tiles with retries, blank-tile checks and nearest-tile fallback.
- Terrain UVs use Mercator projection on both desktop and Android.
- OBJ/MTL exports include a `water` material; GLB exports include water with `doubleSided` enabled.
- Android polygon-with-holes triangulation was replaced with a scanline implementation; split OSM multipolygon relation ways are assembled correctly.

## Fixed

- Satellite tiles are north-up on desktop and Android.
- Empty or partially failed EOX tiles no longer appear as blank texture regions.
- Android water holes, touching holes and large coordinates triangulate correctly.
- Desktop multipolygon relations with outer/inner ways split into multiple segments are assembled before polygonization.
- OBJ variant files, MTL files and textures are included in the output `files` list and copied next to the model.

## Builds

| Platform | File | Version |
|---|---|---|
| Android 6+ | `3Dmaps-0.2.11.apk` | 0.2.11 / versionCode 13 |
| Linux x86_64 | `3dmapgen_0.1.3_amd64.deb` | desktop 0.1.3 |
| Linux x86_64 portable | `3dmapgen-linux-x86_64.tar.gz` | desktop 0.1.3 |
| Windows x86_64 portable | `3dmapgen-windows-x86_64.zip` | desktop 0.1.3 |

## Verification

- `pytest`: 41 passed.
- `node --check` passed for Android `app.js` and `core.js`.
- APK: `com.opencode.mapgen`, versionCode 13, versionName 0.2.11; packaged `app.js`, `core.js` and `index.html` match the source SHA-256.
- Desktop app source matches the repository in the Linux tar, Windows zip and Debian package; `mapgen/water.py` is present in all three.
- `gzip -t`, `unzip -t` and `dpkg-deb --info` passed for the portable archives and Debian package.
- Linux app CLI `--help` and `mapgen.water` imports passed with the host Python; the x86_64 runtime itself was not executed because the build host is aarch64.
- Windows portable build was checked structurally; it was not run on Windows.
- Live OSM/Overpass, Blender import and a physical Android device were not available in this environment.

## SHA-256

```text
7fc009d02ebfdb1d260c168e69c20d94cc345a33ffcce1a6a2a35499d5f1319a   3Dmaps-0.2.11.apk
198388b6441d7839f0937ad52247de990538fb8b11737ae3be7c6e22d7402783   3dmapgen_0.1.3_amd64.deb
09caa0eba834b92e9c2e4252237a4a425a1d3ca0276c62bcab09350f9d4158f4   3dmapgen-linux-x86_64.tar.gz
72ffecb901b7fc9fad3639a372690cc19e831403cc513b5e75e58ae15f78e04a   3dmapgen-windows-x86_64.zip
```

## Licensing

OpenStreetMap data: © OpenStreetMap contributors, ODbL 1.0.
Sentinel-2 cloudless by EOX: CC BY-NC-SA 4.0, non-commercial use.
Code: MIT. See `LICENSE` and `THIRD_PARTY_NOTICES.*`.
