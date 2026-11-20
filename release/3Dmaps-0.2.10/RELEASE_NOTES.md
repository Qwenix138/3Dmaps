# 3Dmaps 0.2.10 / desktop 0.1.2

Release date: 2026-11-20

## Highlights

- Android OSM loading is now resilient in dense cities such as New York. The chain is: OSM API → Overpass mirrors → tiled OSM API fallback.
- If Overpass is blocked or cannot resolve, the app loads OpenStreetMap through `api.openstreetmap.org` in tiles instead of stopping.
- Dense tiles that hit `HTTP 400: too many nodes (limit is 50000)` are split into four smaller tiles automatically.
- OSM errors from all sources are combined, so the UI no longer shows only the last DNS error.
- Overpass has a 60-second timeout per mirror and visible mirror/tile progress.
- Russian and English UI on Android and desktop; the language choice is remembered.
- Fast / Balanced / Detailed quality presets and Android result summary.
- Desktop DEM smoothing: UI, API `smoothing` and CLI `--smoothing`.

## Fixed

- Android: `HTTP 400` followed by `Unable to resolve host "overpass.private.coffee"` no longer blocks map generation.
- Android: tiled OSM fallback works for areas up to 12 km² with automatic splitting, up to 64 requests and depth 3.
- Android: `overpass.private.coffee` was replaced with `overpass.openstreetmap.ru`.
- Android: correct OBJ/MTL extensions, terrain height, DEM smoothing, quality presets and result summary are preserved.
- Desktop GLB generator uses the package version; language, quality and summary state survive UI language switching.

## Builds

| Platform | File | Version |
|---|---|---|
| Android 6+ | `3Dmaps-0.2.10.apk` | 0.2.10 / versionCode 12 |
| Linux x86_64 | `3dmapgen_0.1.2_amd64.deb` | desktop 0.1.2 |
| Linux x86_64 portable | `3dmapgen-linux-x86_64.tar.gz` | desktop 0.1.2 |
| Windows x86_64 portable | `3dmapgen-windows-x86_64.zip` | desktop 0.1.2 |

## Verification

- `pytest`: 33 passed.
- Android `app.js` / `core.js`: `node --check` passed.
- Android generation mock paths passed:
  - normal OSM API;
  - forced `HTTP 400` → Overpass;
  - Overpass DNS failure → tiled OSM API;
  - tile split after `HTTP 400` → merged OSM;
  - 3×3 km area with Overpass down → tiled fallback.
- Android failure path shows an aggregated OSM error instead of hanging silently.
- Android HTML: 67 unique IDs; RU/EN dictionaries have 130 keys each with identical key sets.
- APK: `com.opencode.mapgen`, versionCode 12, versionName 0.2.10; packaged web assets match sources.
- Desktop HTML: 37 unique IDs; inline JS `node --check` passed.
- Desktop Linux tar under qemu: `GET /` 200, RU/EN selector, smoothing control and version `0.1.2`.
- Debian package under qemu: `GET /` 200, same UI and version; package metadata `0.1.2 amd64`.
- Windows zip: 1967 entries, correct root and `3Dmaps.exe`.
- `SHA256SUMS` verified for all four binaries.

Live OSM/Overpass access, Windows runtime and installation on a physical Android device were not available in this environment. The APK is built and signed with the debug key; the Windows build was checked structurally.

## SHA-256

```text
e3e8c8653a346222e4631680524f894634624b5d55298752737e36a648938540   3Dmaps-0.2.10.apk
0da01100c90b79695f2928fbfd1391171864479425343337a7cbd6e0f2cecb11   3dmapgen_0.1.2_amd64.deb
cb3e348f4728f40920bb3b8c77a36abc998d221ca296335ccf9b0a08fcc21943   3dmapgen-linux-x86_64.tar.gz
7da78de3c1b2fbe5ec034bd89fee9d366a24f10b3decede3bcd46d3743b7d5ab   3dmapgen-windows-x86_64.zip
```

## Licensing

OpenStreetMap data: © OpenStreetMap contributors, ODbL 1.0.
Sentinel-2 cloudless by EOX: CC BY-NC-SA 4.0, non-commercial use.
Code: MIT. See `LICENSE` and `THIRD_PARTY_NOTICES.*`.
