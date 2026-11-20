# Packaging

[Русский](README.md) · [English](README.en.md)

## Status

- Linux x86_64 — `.deb` and portable archive: `release/3Dmaps-0.2.10/3dmapgen_0.1.2_amd64.deb`, `release/3Dmaps-0.2.10/3dmapgen-linux-x86_64.tar.gz`.
- Windows x86_64 — portable build with Python: `release/3Dmaps-0.2.10/3dmapgen-windows-x86_64.zip`.
- Android — standalone WebView generator: `release/3Dmaps-0.2.10/3Dmaps-0.2.10.apk`.
- GitHub Actions — Linux x86_64 and Windows x86_64 onefile builds when the repository is pushed.

## Linux and Windows via GitHub Actions

Workflow `.github/workflows/build.yml` runs manually or on a `v*` tag. It produces:

- `3dmapgen-cli`/`3dmapgen-cli.exe`;
- `3dmapgen-web`/`3dmapgen-web.exe`;
- artifact archives for Linux x86_64 and Windows x86_64.

Download them from Actions → run → Artifacts.

## Portable Linux x86_64 and Windows x86_64 builds

The builds in `release/3Dmaps-0.2.10/` do not require Python installed:

- `3dmapgen-linux-x86_64.tar.gz` — extract and run `./3Dmaps` (opens the UI in a browser) or `bin/3dmapgen` / `bin/3dmapgen-web`;
- `3dmapgen-windows-x86_64.zip` — extract fully and run `3Dmaps.exe`; `3dmapgen.exe`, `3dmapgen-web.exe` and `.bat` wrappers are also included.

They bundle Python 3.14 and dependency wheels for the target platform. They are not PyInstaller onefile binaries: a `python/` directory sits next to the launchers. Linux x86_64 was verified through qemu (imports, `--help`, web page); the Windows build was checked structurally and requires Windows to run. For onefile builds, use a native Windows/Linux machine or the workflow.

## Installing on Linux Mint / Ubuntu x86_64

```bash
sudo apt install ./3dmapgen_0.1.2_amd64.deb
```

After installation, “3Dmaps” appears in the menu, the CLI is `3dmapgen`, and the web version is `3dmapgen-web`. The menu entry opens a local server at `127.0.0.1:8765`. Uninstall with `sudo apt remove 3dmapgen`.

## Local Linux build

```bash
pip install -r requirements-dev.txt
python -m pip install .
PYTHON=/path/to/venv/bin/python bash packaging/build_local.sh
```

`PYTHON` can be omitted when the environment is active. PyInstaller does not cross-compile: Linux produces a Linux binary, Windows produces `.exe`. For Windows, use Windows, the workflow or the ready portable build.

On a `noexec` mount, copy the binary to an executable filesystem such as `/tmp`.

## Running the built version

```bash
./dist/3dmapgen --center 47.222,39.710 --size-km 2 --smoothing 1
./dist/3dmapgen-web --host 127.0.0.1 --port 8000 --open
```

The onefile web build stores results in `~/3Dmaps/output` and cache in `~/3Dmaps/cache`. Override with:

```bash
MAPGEN_OUTPUT=/path/to/output MAPGEN_CACHE=/path/to/cache ./dist/3dmapgen-web
```

## Android

Ready app: `release/3Dmaps-0.2.10/3Dmaps-0.2.10.apk`. It is standalone: no server, Termux or Python on the phone. Only internet access for OSM, Terrarium DEM and EOX satellite is required. Version 0.2.10 adds RU/EN, quality presets and a result summary.

Build:

```bash
bash android/build-apk.sh
```

Details, installation and limitations are in `android/README.md` and `android/README.en.md`.
