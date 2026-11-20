# Android APK

[Русский](README.md) · [English](README.en.md)

[`3Dmaps-0.2.11.apk`](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.11/3Dmaps-0.2.11.apk) is a standalone Android app. The UI and generator are bundled in the APK: no separate server, Termux, Python or address setup is required.

## Installation

1. Copy the APK to the phone and allow installation from unknown sources.
2. Install `3Dmaps-0.2.11.apk`. Version 0.2.11 upgrades 0.2.10/0.2.9/0.2.8/0.2.7/0.2.6/0.2.5/0.2.4/0.2.3/0.2.2/0.2.1/0.2.0/0.1.0 with the same package, `com.opencode.mapgen`.
3. Open 3Dmaps, choose RU/EN in the header, tap “Box” and draw a rectangle. Resize it by corners/edges, move it by the center point or from inside, or use a preset.

Internet is required for the map, OSM outlines, Terrarium elevations and EOX satellite imagery. Generation, geometry and file saving run on the phone.

## What's new in 0.2.11

- Water from OSM: lakes, reservoirs, rivers, streams, canals and islands; water is rendered in textures and exported as a separate material.
- Building foundations, layer Z-offsets and road/rail tessellation.
- More reliable EOX satellite texture: 2×2 tiles, retries, blank-tile checks and fallback.
- Fixed satellite tile orientation, polygon-with-holes triangulation and multipolygon relation assembly.
- Includes the 0.2.7–0.2.10 fixes: correct `.obj`/`.mtl` extensions, terrain height, DEM smoothing, presets, summary and OSM loading.

## Included

- Built-in OSM map without Leaflet or external CDNs.
- Nominatim place search and a “My location” button; both use the selected area size.
- Rectangle selection with 8 handles, inside dragging, 0.5–3 km presets and exact dimensions.
- Terrain step 10–60 m, height 0.5×–2×, DEM smoothing, texture 512/1024/2048 px.
- Quick save as GLB only or OBJ+MTL; OBJ also saves its textures.
- Terrarium DEM terrain; a neutral height is used if a tile fails.
- Buildings, roads and railways from OSM: the OSM API for small areas, Overpass for dense cities and large areas.
- Sentinel-2 cloudless via EOX WMS; on failure, a local relief texture is used.
- OBJ+MTL, GLB, PNG heightmap, metadata and textures.
- Saves to `Download/3Dmaps/<name>/` on Android 10+. On older versions, if permission is denied, files go to `Android/data/com.opencode.mapgen/files/Download/3Dmaps/`.

Limitations:

- Maximum area is 15×15 km (225 km²). Dense cities such as New York are loaded via Overpass; the first such request can take noticeably longer.
- Texture size is 512–2048 px. 4096 may run out of memory on a phone.
- EOX satellite imagery is CC BY-NC-SA 4.0: non-commercial use only.
- Google tiles and Google 3D are not used.

## Building

Requires JDK 17, Android SDK 35 and Gradle 8.9.

```bash
cd android
ANDROID_HOME=/path/to/android-sdk GRADLE_BIN=/path/to/gradle-8.9/bin/gradle bash build-apk.sh
```

The script builds in `/tmp/3dmapgen-android-build` to avoid Cyrillic path issues in Gradle and copies the APK to `../release/3Dmaps-<version>/3Dmaps-<version>.apk`. This machine uses:

- `ANDROID_HOME=/root/android-sdk`
- `GRADLE_BIN=/root/tools/gradle-8.9/bin/gradle`
- Termux `aapt2` with `LD_LIBRARY_PATH` (the script picks it up)

The APK is signed with the debug key from `~/.android/debug.keystore`; this is enough for personal installation. Publishing requires a separate release key.

Application sources:

```text
android/app/src/main/
├── AndroidManifest.xml
├── java/com/opencode/mapgen/MainActivity.java
├── assets/web/index.html
├── assets/web/style.css
├── assets/web/core.js
└── assets/web/app.js
```

Old APKs 0.2.3–0.2.9 are removed. If an old `*.obj.txt` file remains, rename it to `*.obj` or save it again: since 0.2.7 OBJ gets the correct extension.
