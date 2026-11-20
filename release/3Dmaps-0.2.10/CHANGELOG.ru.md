# История изменений

## 0.2.10 / desktop 0.1.2 — 2026-11-20

### Исправлено

- Android: если Overpass недоступен или не резолвится, OSM загружается плитками через OSM API; при лимите 50 000 узлов плитка автоматически дробится.
- Android: ошибки всех источников OSM объединяются, а не показывается только последняя.
- Android: таймаут Overpass снижен до 60 секунд на зеркало, добавлен прогресс по зеркалам и плиткам.
- Android: `overpass.private.coffee` заменён на `overpass.openstreetmap.ru`.
- Android: версия 0.2.10, versionCode 12.

## 0.2.9 / desktop 0.1.2 — 2026-11-20


### Исправлено

- Android: плотные города вроде Нью-Йорка больше не падают с `HTTP 400: You requested too many nodes (limit is 50000)`.
- Android: при ошибке OSM API автоматически используется Overpass; зоны больше 8 км² сразу загружаются через Overpass.
- Android: добавлены понятные ошибки OSM и прогресс загрузки через Overpass.
- Android: версия 0.2.9, versionCode 11.

## 0.2.8 / desktop 0.1.2 — 2026-11-20


### Добавлено

- Русский и английский интерфейс в Android и desktop; выбор языка сохраняется.
- Пресеты качества «Быстро / Баланс / Детально» в Android и desktop.
- Сводка результата в Android: площадь, треугольники, здания, дороги, предупреждения.
- Сглаживание DEM в desktop: CLI `--smoothing`, API `smoothing`, поле в интерфейсе.
- Улучшенный дизайн панелей, карточек, статуса и списка файлов.
- Английская документация, CHANGELOG и release-папка с checksums.
- `tests/test_elevation.py` и `tests/test_ui_i18n.py`.

### Исправлено

- Android: правильные расширения `.obj`/`.mtl` при сохранении в Download.
- Android: высота рельефа и сглаживание DEM применяются до экспорта.
- Desktop: `generator` в GLB теперь берётся из `__version__`.
- Desktop: язык, качество и сводка не сбрасываются при переключении языка.
- Desktop: корректное отображение площади в км² для выбранного языка.
- Старые сборки APK и desktop удалены из релизных папок.

### Сборки

- Android: `3Dmaps-0.2.8.apk`, versionCode 10, Android 6+.
- Linux: `3dmapgen_0.1.2_amd64.deb`, `3dmapgen-linux-x86_64.tar.gz`.
- Windows: `3dmapgen-windows-x86_64.zip`.

## 0.2.7 / desktop 0.1.1

- Android: исправлены MIME/расширения OBJ/MTL, добавлены высота рельефа и сглаживание.
- Desktop: height scale, улучшенные портативные сборки, обновлённые README внутри архивов.
- Linux: `.deb`, tar и Windows zip пересобраны; проверка qemu.

## 0.1.0

- Первый публичный релиз: веб-интерфейс, CLI, OBJ/GLB, Android APK.
