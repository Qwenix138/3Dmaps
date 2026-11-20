#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="${MAPGEN_ANDROID_BUILD_DIR:-/tmp/3dmapgen-android-build}"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/root/android-sdk}}"
GRADLE_BIN="${GRADLE_BIN:-/root/tools/gradle-8.9/bin/gradle}"
AAPT2="${AAPT2:-/root/aapt2-termux/data/data/com.termux/files/usr/bin/aapt2}"
AAPT2_LIB="${AAPT2_LIB:-/root/aapt2-termux/data/data/com.termux/files/usr/lib}"
GRADLE_ARGS="${GRADLE_ARGS:---offline}"

if [ ! -x "$GRADLE_BIN" ]; then
    GRADLE_BIN="$(command -v gradle || true)"
fi
if [ -z "$GRADLE_BIN" ] || [ ! -x "$GRADLE_BIN" ]; then
    echo "Не найден Gradle. Установи Gradle 8.9 или задай GRADLE_BIN." >&2
    exit 1
fi
if [ ! -d "$SDK" ]; then
    echo "Не найден Android SDK: $SDK" >&2
    exit 1
fi

rm -rf "$WORK"
mkdir -p "$WORK"
tar -C "$HERE" \
    --exclude='./app/build' --exclude='./build' --exclude='./.gradle' \
    --exclude='./local.properties' -cf - . | tar -C "$WORK" -xf -
cd "$WORK"

if [ -x "$AAPT2" ]; then
    printf '\nandroid.aapt2FromMavenOverride=%s\n' "$AAPT2" >> gradle.properties
    export LD_LIBRARY_PATH="$AAPT2_LIB${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK" \
    "$GRADLE_BIN" $GRADLE_ARGS --no-daemon assembleRelease

VERSION="$(awk -F"'" '/versionName/ {print $2; exit}' app/build.gradle)"
APK="$HERE/../release/3Dmaps-${VERSION}/3Dmaps-${VERSION}.apk"
mkdir -p "$HERE/../release/3Dmaps-${VERSION}"
cp app/build/outputs/apk/release/app-release.apk "$APK"
echo "APK: $APK"
