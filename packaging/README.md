# Сборка

[Русский](README.md) · [English](README.en.md)

## Статус

- Linux x86_64 — `.deb` и портативный архив: `release/3Dmaps-0.2.11/3dmapgen_0.1.3_amd64.deb`, `release/3Dmaps-0.2.11/3dmapgen-linux-x86_64.tar.gz`.
- Windows x86_64 — портативная сборка с Python: `release/3Dmaps-0.2.11/3dmapgen-windows-x86_64.zip`.
- Android — автономный WebView-генератор: `release/3Dmaps-0.2.11/3Dmaps-0.2.11.apk`.
- GitHub Actions — onefile-сборки Linux x86_64 и Windows x86_64, если репозиторий запушен.

## Linux и Windows через GitHub Actions

Workflow `.github/workflows/build.yml` запускается вручную или по тегу `v*`. Он создаёт:

- `3dmapgen-cli`/`3dmapgen-cli.exe`;
- `3dmapgen-web`/`3dmapgen-web.exe`;
- архивы артефактов для Linux x86_64 и Windows x86_64.

Скачайте архив из раздела Actions → нужный запуск → Artifacts.

## Портативные сборки Linux x86_64 и Windows x86_64

Сборки лежат в `release/3Dmaps-0.2.11/` и не требуют установленного Python:

- `3dmapgen-linux-x86_64.tar.gz` — распакуйте и запускайте `./3Dmaps` (интерфейс откроется в браузере) либо `bin/3dmapgen` / `bin/3dmapgen-web`;
- `3dmapgen-windows-x86_64.zip` — полностью распакуйте и запускайте `3Dmaps.exe`; также доступны `3dmapgen.exe`, `3dmapgen-web.exe` и `.bat`-обёртки.

Внутри — встроенный Python 3.14 и колёса зависимостей для целевой платформы. Это не onefile-бинарники PyInstaller: рядом с лаунчерами находится каталог `python/`. Linux x86_64 проверен через qemu (импорты, `--help`, веб-страница); Windows-сборка проверена структурно, запуск требует Windows. Для onefile-сборок используйте нативную Windows/Linux-машину или workflow.

## Установка на Linux Mint / Ubuntu x86_64

```bash
sudo apt install ./3dmapgen_0.1.3_amd64.deb
```

После установки в меню появится «3Dmaps», CLI доступен как `3dmapgen`, веб-версия — как `3dmapgen-web`. Запуск из меню открывает локальный сервер на `127.0.0.1:8765`. Удаление: `sudo apt remove 3dmapgen`.

## Локальная Linux-сборка

```bash
pip install -r requirements-dev.txt
python -m pip install .
PYTHON=/path/to/venv/bin/python bash packaging/build_local.sh
```

`PYTHON` можно не задавать, если нужное окружение уже активировано. PyInstaller не кросс-компилирует. Сборка на Linux даёт Linux-бинарник, на Windows — `.exe`. Для Windows используйте Windows, workflow или готовую портативную сборку.

Если проект лежит на разделе с `noexec`, бинарник нужно скопировать на исполняемый раздел, например в `/tmp`.

## Запуск собранной версии

```bash
./dist/3dmapgen --center 47.222,39.710 --size-km 2 --smoothing 1
./dist/3dmapgen-web --host 127.0.0.1 --port 8000 --open
```

В onefile-сборке веб-версия сохраняет результаты в `~/3Dmaps/output`, кэш — в `~/3Dmaps/cache`. Переопределение:

```bash
MAPGEN_OUTPUT=/path/to/output MAPGEN_CACHE=/path/to/cache ./dist/3dmapgen-web
```

## Android

Готовое приложение: `release/3Dmaps-0.2.11/3Dmaps-0.2.11.apk`. Оно работает автономно: сервер, Termux и Python на телефоне не нужны. Нужен только интернет для OSM, DEM Terrarium и спутника EOX. В 0.2.11 добавлены вода из OSM, фундаменты, тесселяция, надёжный спутник, RU/EN, пресеты качества и сводка результата.

Сборка:

```bash
bash android/build-apk.sh
```

Подробности, установка и ограничения — в `android/README.md` и `android/README.en.md`.
