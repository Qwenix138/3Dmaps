# 3Dmaps 0.2.10

[Русская документация](README.ru.md) · [English documentation](README.en.md)

Standalone 3D map-area generator for Blender and other 3D editors. The release contains Android, Linux and Windows builds plus full documentation.

## Quick start

- Android 6+: install `3Dmaps-0.2.10.apk`.
- Linux Mint/Ubuntu x86_64: `sudo apt install ./3dmapgen_0.1.2_amd64.deb`.
- Portable Linux: extract `3dmapgen-linux-x86_64.tar.gz`, run `./3Dmaps` (or `bin/3dmapgen`).
- Windows x86_64: extract `3dmapgen-windows-x86_64.zip` fully, run `3Dmaps.exe`.

Internet is required for OpenStreetMap, Terrarium DEM and EOX satellite imagery. Generation and export run locally.

## Contents

- `README.ru.md`, `README.en.md` — full documentation.
- `CHANGELOG.ru.md`, `CHANGELOG.en.md` — release history.
- `docs/ANDROID.*`, `docs/DESKTOP.*`, `docs/BLENDER.*` — platform and Blender guides.
- `docs/PUBLISHING.*` — GitHub release instructions.
- `LICENSE`, `THIRD_PARTY_NOTICES.*` — licensing and attribution.
- `SHA256SUMS` — checksums for all binaries.
- `RELEASE_NOTES.md` — release summary and verification results.

Verify downloads:

```bash
sha256sum -c SHA256SUMS
```

Satellite imagery: Sentinel-2 cloudless by EOX, CC BY-NC-SA 4.0 (non-commercial). OSM data: © OpenStreetMap contributors, ODbL.
