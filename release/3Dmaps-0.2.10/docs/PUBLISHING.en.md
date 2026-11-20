# Publishing to GitHub

## 1. Repository

```bash
git init
git add .
git commit -m "3Dmaps 0.2.10"
git branch -M main
git remote add origin https://github.com/Qwenix138/3Dmaps.git
git push -u origin main
```

Binaries under `release/` are excluded from git via `.gitignore`; source, documentation and checksums stay in the repository.

## 2. GitHub Release

1. Open the repository → Releases → Draft a new release.
2. Tag: `v0.2.10`, title: `3Dmaps 0.2.10`.
3. Attach files from `release/3Dmaps-0.2.10/`:
   - `3Dmaps-0.2.10.apk`
   - `3dmapgen_0.1.2_amd64.deb`
   - `3dmapgen-linux-x86_64.tar.gz`
   - `3dmapgen-windows-x86_64.zip`
   - `SHA256SUMS`
4. Paste the text from `RELEASE_NOTES.md` and publish.

## 3. Verify

```bash
sha256sum -c SHA256SUMS
```

The APK installs on Android 6+. The `.deb` installs with `sudo apt install ./3dmapgen_0.1.2_amd64.deb`.
