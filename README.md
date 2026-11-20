# 3Dmaps

[Русский](README.md) · [English](README.en.md)

Бесплатный генератор 3D-участков карты для Blender и других 3D-редакторов. Выделите прямоугольник на карте — программа соберёт рельеф, здания, дороги и железные дороги, наложит текстуры и сохранит сцену в OBJ/GLB.

Проект использует OpenStreetMap и открытые данные о высотах, а не Google Maps. Google-тайлы и Google 3D нельзя легально экспортировать в модель, поэтому Google не используется как источник геометрии или текстуры.

## Скачать

Официальный репозиторий: [github.com/Qwenix138/3Dmaps](https://github.com/Qwenix138/3Dmaps). Готовые сборки — в [GitHub Releases](https://github.com/Qwenix138/3Dmaps/releases/tag/v0.2.10):

- [Android APK 0.2.10](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3Dmaps-0.2.10.apk) — Android 6+;
- [Linux .deb 0.1.2](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3dmapgen_0.1.2_amd64.deb) — Debian/Ubuntu x86_64;
- [Linux portable 0.1.2](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3dmapgen-linux-x86_64.tar.gz);
- [Windows portable 0.1.2](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3dmapgen-windows-x86_64.zip).

Код проекта открыт под лицензией MIT. Проверка загрузок: `sha256sum -c SHA256SUMS` из release.

## Возможности

- Выбор зоны прямоугольником в браузерном интерфейсе на Leaflet.
- Русский и английский интерфейс: язык переключается в шапке и запоминается.
- Поиск места через Nominatim и кнопка «Моё место».
- Рельеф из Terrarium DEM с настраиваемым шагом сетки, высотой и сглаживанием.
- Пресеты качества «Быстро / Баланс / Детально».
- Реальные контуры зданий из OSM и серые призмы с высотой по тегам.
- Дороги и железные дороги с шириной по типу.
- Текстуры:
  - `satellite.jpg` — Sentinel-2 cloudless через EOX WMS;
  - `labels.png` — подписи и схема, нарисованные из OSM;
  - `hybrid.jpg` — спутник с подписями и дорогами;
  - `labels_overlay.png` — прозрачный слой для собственных материалов;
  - `relief.jpg` — запасная текстура, если спутник недоступен.
- Экспорт OBJ+MTL и GLB со встроенной текстурой.
- Heightmap в PNG и NumPy `.npy`.
- Метаданные `meta.json`: bbox, высоты, количество объектов, атрибуции и лицензии.
- Локальный Three.js-просмотрщик прямо из веб-интерфейса.
- CLI для пакетной генерации без браузера.
- Автономный Android APK: генерация на телефоне, без сервера и Termux.

## Ограничения

- Максимальная площадь зоны — 500 км²; интерфейс предупреждает при площади больше 20×20 км. В Android-приложении максимальная зона — 15 × 15 км (225 км²), в плотной застройке лучше 2–4 км².
- Точность рельефа зависит от DEM и шага сетки: по умолчанию 30 м. Это не LiDAR.
- Высота зданий берётся из `height`, `building:levels` или типового значения. Реальная высота может отличаться.
- OSM API подходит только для небольших зон примерно до 6 км². Для больших зон используется Overpass, а при его недоступности — PBF.
- Автоматический выбор PBF реализован для регионов России Geofabrik. Для других стран передайте локальный файл через `--pbf` или используйте Overpass.
- Спутник EOX имеет лицензию **CC BY-NC-SA 4.0**: некоммерческое использование. Для коммерческих задач используйте собственный снимок.
- Это не фотограмметрия и не готовая GIS-модель: здания упрощены, деревья и мелкие объекты не экспортируются.
- Один большой участок 20×20 км с текстурой 4096 или 8192 может занимать много оперативной памяти и диска.

## Установка

Нужен Python 3.10 или новее. Рекомендуется Python 3.12–3.14.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

На Android/Termux или FUSE-разделе создание `.venv` внутри проекта может не работать из-за symlink. В этом случае создайте окружение вне проекта:

```bash
python -m venv /root/.venvs/3dmap
/root/.venvs/3dmap/bin/python -m pip install -r requirements.txt
```

Для разработки:

```bash
pip install -r requirements-dev.txt
python -m pytest
```

## Веб-интерфейс

```bash
python -m mapgen.web --host 127.0.0.1 --port 8000 --open
```

Откройте `http://127.0.0.1:8000`. Выберите язык RU/EN, нарисуйте прямоугольник, задайте название, качество, высоту и сглаживание рельефа, затем нажмите «Сгенерировать 3D-участок».

Готовые файлы складываются в `output/<время>-<id>-<название>/`. Кнопка «Открыть 3D-просмотр» загружает GLB в Three.js. Для работы браузеру нужны интернет и CDN unpkg, либо локальная копия Leaflet/Three.js.

Пресеты качества: «Быстро» — шаг 60 м, текстура 2048, сглаживание 1; «Баланс» — 30 м, 4096, без сглаживания; «Детально» — 15 м, 4096, без сглаживания. Любой параметр можно изменить вручную.

### Android APK

Готовый APK: [3Dmaps-0.2.10.apk](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3Dmaps-0.2.10.apk) (Android 6+). Это автономное приложение: Python, Termux и отдельный сервер не нужны. Генератор работает внутри WebView на JavaScript, а Java-мост загружает OSM/DEM/спутник и сохраняет файлы в `Download/3Dmaps/<название>/`.

Установи APK, открой 3Dmaps и выдели рамку на карте. Меняй её за 8 ручек, перемещай за центральную точку или изнутри либо нажми пресет 0.5–3 км; ширина, высота и центр доступны в свёрнутом блоке «Точные размеры». Нужен интернет для карты, OSM, высот Terrarium и спутника EOX; расчёт и экспорт выполняются на телефоне. На карте видны размеры и площадь зоны, масштаб, zoom и координаты. Максимальная зона — 15 × 15 км (225 км²), в плотной застройке лучше 2–4 км²; шаг рельефа 10–60 м, высота рельефа 0.5×–2×, сглаживание DEM, текстура 512–2048 px. Можно сохранить всё или только GLB / OBJ+MTL; OBJ сохраняется с правильным расширением `.obj`.

Версия 0.2.10 исправляет загрузку OSM для плотных городов вроде Нью-Йорка: при лимите OSM API 50 000 узлов используется Overpass, а если он недоступен — плитки OSM API с автоматическим дроблением. Ошибки всех источников теперь объединяются. Также добавлены английский язык, пресеты качества и сводка результата. Исходники и скрипт сборки — в `android/`; старые APK удалены, актуальная версия лежит в папке релиза.

### API

- `GET /health` — проверка сервера.
- `POST /api/generate` — создать задачу. Тело: `bbox`, `name`, `terrain_spacing`, `height_scale`, `smoothing`, `texture_size`, `labels`, `satellite`, `buildings`, `roads`, `railways`.
- `GET /api/jobs/<id>` — статус, прогресс, список файлов.
- `GET /files/<id>/<path>` — скачать файл.
- `GET /view/<id>` — 3D-просмотр.

Пример:

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

Центр и размер зоны:

```bash
python -m mapgen.cli --center 47.222,39.710 --size-km 2,1 --name center
```

Без спутника и подписей:

```bash
python -m mapgen.cli --bbox 47.220,39.690,47.225,39.700 --no-satellite --no-labels
```

Большая зона с локальным PBF:

```bash
python -m mapgen.cli \
  --center 47.222,39.710 \
  --size-km 12 \
  --osm-source pbf \
  --pbf /path/to/region-latest.osm.pbf \
  --texture-size 4096 \
  --out output/large
```

Параметры:

- `--terrain-spacing` — шаг рельефа в метрах, 5–120.
- `--texture-size` — 256–8192.
- `--height-scale` — масштаб рельефа, 0.5–5.0.
- `--smoothing` — сглаживание DEM: 0, 1 или 2.
- `--simplify` — упрощение контуров зданий, 0–5 м.
- `--custom-satellite` — север-сверху изображение, которое будет растянуто на bbox.
- `--satellite-layer` — слой EOX WMS.
- `--no-buildings`, `--no-roads`, `--no-railways`, `--no-satellite`, `--no-labels`.
- `--json` — вывести только метаданные.

## Результат

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

Варианты `_labels` и `_hybrid` создаются для зон до 25 км² и сцены до 900 000 треугольников.

Оси:

- OBJ: `X` — восток, `Y` — север, `Z` — вверх. Подходит для импорта в Blender.
- GLB: `X` — восток, `Y` — вверх, `Z` — юг. Стандартная ориентация glTF.
- Heightmap: север сверху, строка 0 соответствует северу. В `heightmap.png` высота нормализована в 16 бит, в `.npy` хранятся абсолютные метры.

### Blender

Импортируйте `*.glb` через **File → Import → glTF 2.0**. Если объект выглядит серым, включите **Material Preview** (`Z`). Подписи находятся в текстуре, а здания, дороги и железные дороги — отдельная геометрия. Если объектов нет, проверьте `counts.buildings` и `counts.roads` в `meta.json` и убедитесь, что импортирован новый GLB. Если модель не видна, нажмите `Numpad .` (Frame Selected) и увеличьте **Clip End** в настройках вида.

## Источники и лицензии

- OpenStreetMap: © OpenStreetMap contributors, ODbL 1.0.
- Terrarium DEM: Mapzen/Tilezen, SRTM/Copernicus DEM.
- Спутник EOX Sentinel-2 cloudless: CC BY-NC-SA 4.0, некоммерческое использование.
- Шрифты DejaVu: Bitstream Vera License.
- Код проекта: [MIT](LICENSE).

Подробности находятся в `THIRD_PARTY_NOTICES.md` и `THIRD_PARTY_NOTICES.en.md`. При публикации моделей сохраняйте атрибуции в `meta.json` и интерфейсе.

## Сборка

В репозитории есть GitHub Actions workflow `.github/workflows/build.yml`. Он собирает автономные `3dmapgen-cli` и `3dmapgen-web` для Linux x86_64 и Windows x86_64 через PyInstaller и прикладывает архивы к запуску workflow.

Локальная сборка Linux:

```bash
pip install -r requirements-dev.txt
python -m pip install .
bash packaging/build_local.sh
```

Результат: `dist/3dmapgen`, `dist/3dmapgen-web`.

Готовые сборки:

- [3dmapgen_0.1.2_amd64.deb](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3dmapgen_0.1.2_amd64.deb) — установщик для Linux Mint/Ubuntu x86_64;
- [3dmapgen-linux-x86_64.tar.gz](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3dmapgen-linux-x86_64.tar.gz) — портативная сборка с Python, запуск через `./3Dmaps` или `bin/3dmapgen`;
- [3dmapgen-windows-x86_64.zip](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3dmapgen-windows-x86_64.zip) — портативная сборка с Python, запуск через `3Dmaps.exe`;
- [3Dmaps-0.2.10.apk](https://github.com/Qwenix138/3Dmaps/releases/download/v0.2.10/3Dmaps-0.2.10.apk) — автономный Android APK.

Установка `.deb`: `sudo apt install ./3dmapgen_0.1.2_amd64.deb`. После установки приложение «3Dmaps» появляется в меню, CLI доступен как `3dmapgen`.

Портативные сборки содержат встроенный Python 3.14 и колёса зависимостей; onefile-сборки для Linux x86_64 и Windows по-прежнему собираются в GitHub Actions. Веб-версия в onefile-сборке хранит результаты в `~/3Dmaps/output`, кэш — в `~/3Dmaps/cache`. Пути можно переопределить через `MAPGEN_OUTPUT` и `MAPGEN_CACHE`.

Автономный Android APK собирается локально:

```bash
bash android/build-apk.sh
```

Скрипт собирает в `/tmp/3dmapgen-android-build`, чтобы Gradle не спотыкался о кириллицу в пути, и копирует `release/3Dmaps-<version>/3Dmaps-<version>.apk`. Подробности, установка и ограничения — в `android/README.md` и `android/README.en.md`.

## Релизы

- [GitHub Releases](https://github.com/Qwenix138/3Dmaps/releases) — APK, `.deb`, портативные Linux/Windows сборки и `SHA256SUMS`.
- [RELEASE_NOTES.md](release/3Dmaps-0.2.10/RELEASE_NOTES.md) — состав и результаты проверки 0.2.10.
- [PUBLISHING.ru.md](release/3Dmaps-0.2.10/docs/PUBLISHING.ru.md) — процесс подготовки нового релиза.
- Бинарники исключены из git через `.gitignore` и прикладываются к GitHub Release отдельно.

Workflow `build` запускается вручную или по тегу `v*`: Actions → build → Run workflow.

## Структура проекта

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

android/          # автономное WebView-приложение и скрипт сборки APK
release/          # готовые сборки и документация для GitHub
```

## Проверка

```bash
python -m pytest
```

Тесты не обращаются к сети: проверяются парсеры, проекция, геометрия, heightmap, текстуры, экспорт OBJ/GLB и i18n-ключи интерфейса.

## Документация

- [English README](README.en.md)
- [CHANGELOG.md](CHANGELOG.md) · [CHANGELOG.en.md](CHANGELOG.en.md)
- [Android](android/README.md) · [Android English](android/README.en.md)
- [Packaging](packaging/README.md) · [Packaging English](packaging/README.en.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md) · [English](THIRD_PARTY_NOTICES.en.md)
