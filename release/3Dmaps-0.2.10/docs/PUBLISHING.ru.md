# Публикация на GitHub

## 1. Репозиторий

```bash
git init
git add .
git commit -m "3Dmaps 0.2.10"
git branch -M main
git remote add origin https://github.com/Qwenix138/3Dmaps.git
git push -u origin main
```

Бинарники в `release/` исключены из git через `.gitignore`; исходники, документация и checksums остаются в репозитории.

## 2. GitHub Release

1. Откройте репозиторий → Releases → Draft a new release.
2. Tag: `v0.2.10`, title: `3Dmaps 0.2.10`.
3. Прикрепите файлы из `release/3Dmaps-0.2.10/`:
   - `3Dmaps-0.2.10.apk`
   - `3dmapgen_0.1.2_amd64.deb`
   - `3dmapgen-linux-x86_64.tar.gz`
   - `3dmapgen-windows-x86_64.zip`
   - `SHA256SUMS`
4. Вставьте текст из `RELEASE_NOTES.md` и опубликуйте.

## 3. Проверка

```bash
sha256sum -c SHA256SUMS
```

Linux APK можно установить на Android 6+. `.deb` ставится через `sudo apt install ./3dmapgen_0.1.2_amd64.deb`.
