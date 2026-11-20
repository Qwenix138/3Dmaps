# Сторонние данные и компоненты

[Русский](THIRD_PARTY_NOTICES.ru.md) · [English](THIRD_PARTY_NOTICES.en.md)

## Код проекта

Исходный код 3Dmaps распространяется по лицензии MIT. Полный текст находится в `LICENSE`.

## OpenStreetMap

Здания, дороги, железные дороги и точки `place` загружаются из OpenStreetMap.

- Данные: © OpenStreetMap contributors.
- Лицензия: Open Database License 1.0 (ODbL).
- Условия: https://www.openstreetmap.org/copyright

При распространении моделей и текстур необходимо сохранять атрибуцию OpenStreetMap и учитывать требования ODbL к производным базам данных.

## Terrarium DEM

Высоты загружаются из публичных Terrarium-тайлов Mapzen/Tilezen, размещённых в AWS Open Data.

- Атрибуция: Mapzen/Tilezen Terrarium, SRTM/Copernicus DEM.
- Источник тайлов: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png

## EOX Sentinel-2 cloudless

Спутниковая текстура по умолчанию загружается через WMS EOX.

- Атрибуция: Sentinel-2 cloudless by EOX IT Services GmbH.
- Лицензия: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 (CC BY-NC-SA 4.0).
- Условия: https://creativecommons.org/licenses/by-nc-sa/4.0/
- Сервис: https://tiles.maps.eox.at/

Лицензия CC BY-NC-SA **запрещает коммерческое использование** спутниковой текстуры без отдельного разрешения. Для коммерческих проектов используйте собственный снимок через `--custom-satellite` или другого поставщика с подходящей лицензией.

## Шрифты DejaVu

В каталоге `mapgen/assets/fonts/` находятся DejaVu Sans и DejaVu Sans Bold.

- Copyright (c) 2003 by Bitstream, Inc.
- DejaVu changes are in public domain.
- Полный текст лицензии: `mapgen/assets/fonts/LICENSE-DejaVu.txt`.

## Python-зависимости

Проект использует Flask, NumPy, Pillow, pyproj, Shapely, mapbox-earcut, pyosmium, Requests и их транзитивные зависимости. Лицензии конкретных версий указаны в метаданных установленных пакетов и в их репозиториях.

## Интерактивная карта

Leaflet распространяется по лицензии BSD-2-Clause. Тайлы OpenStreetMap в интерфейсе используются по правилам OSM Tile Usage Policy. Three.js распространяется по лицензии MIT. Поиск адресов использует Nominatim и подчиняется Nominatim Usage Policy.
