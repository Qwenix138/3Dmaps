# Third-party data and components

[Русский](THIRD_PARTY_NOTICES.md) · [English](THIRD_PARTY_NOTICES.en.md)

## Project code

The 3Dmaps source code is distributed under the MIT License. See `LICENSE`.

## OpenStreetMap

Buildings, roads, railways and `place` points are downloaded from OpenStreetMap.

- Data: © OpenStreetMap contributors.
- License: Open Database License 1.0 (ODbL).
- Terms: https://www.openstreetmap.org/copyright

When distributing models and textures, keep the OpenStreetMap attribution and comply with ODbL requirements for derived databases.

## Terrarium DEM

Elevations are downloaded from public Mapzen/Tilezen Terrarium tiles hosted on AWS Open Data.

- Attribution: Mapzen/Tilezen Terrarium, SRTM/Copernicus DEM.
- Tile source: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png

## EOX Sentinel-2 cloudless

The default satellite texture is downloaded through EOX WMS.

- Attribution: Sentinel-2 cloudless by EOX IT Services GmbH.
- License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 (CC BY-NC-SA 4.0).
- Terms: https://creativecommons.org/licenses/by-nc-sa/4.0/
- Service: https://tiles.maps.eox.at/

CC BY-NC-SA **prohibits commercial use** of the satellite texture without separate permission. For commercial projects, use your own imagery via `--custom-satellite` or another provider with a suitable license.

## DejaVu fonts

`mapgen/assets/fonts/` contains DejaVu Sans and DejaVu Sans Bold.

- Copyright (c) 2003 by Bitstream, Inc.
- DejaVu changes are in the public domain.
