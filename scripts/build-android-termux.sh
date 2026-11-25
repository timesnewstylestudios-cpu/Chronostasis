#!/usr/bin/env bash
# Debug-APK auf einem arm64-Gerät mit Termux bauen.
# Die Maven-aapt2 ist x86_64 und startet dort nicht. android.aapt2FromMavenOverride
# zeigt Gradle auf die aapt2 aus pkg install aapt2.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Chronostasis: Android-Debug-APK"

if ! command -v node >/dev/null 2>&1; then
  echo "Node fehlt. In Termux: pkg install nodejs"
  exit 1
fi
if ! command -v java >/dev/null 2>&1; then
  echo "Java fehlt. In Termux: pkg install openjdk-21"
  exit 1
fi

AAPT2="${AAPT2:-}"
if [ -z "$AAPT2" ]; then
  if [ -n "${PREFIX:-}" ] && [ -x "$PREFIX/bin/aapt2" ]; then
    AAPT2="$PREFIX/bin/aapt2"
  elif command -v aapt2 >/dev/null 2>&1; then
    AAPT2="$(command -v aapt2)"
  fi
fi
if [ -z "$AAPT2" ] || [ ! -x "$AAPT2" ]; then
  echo "aapt2 fehlt. Auf arm64: pkg install aapt2"
  echo "Oder setze AAPT2=/pfad/zur/arm64-Datei."
  exit 1
fi
if ! "$AAPT2" version >/dev/null 2>&1; then
  echo "Diese aapt2 startet nicht."
  echo "Gradle würde sonst eine x86_64-Datei laden. Nutze die Termux-aapt2 über android.aapt2FromMavenOverride."
  exit 1
fi

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/android-sdk}}"
if [ ! -d "$SDK" ]; then
  echo "Android-SDK nicht gefunden unter $SDK"
  echo "Ablage und Pakete: docs/android-termux.md"
  exit 1
fi

npm install
npm run build
if [ ! -d android ]; then
  npx cap add android
fi
npx cap sync android
node scripts/patch-android.mjs "$AAPT2" "$SDK"
chmod +x android/gradlew
(
  cd android
  ./gradlew assembleDebug --no-daemon -Pandroid.aapt2FromMavenOverride="$AAPT2"
)
echo "Fertig: android/app/build/outputs/apk/debug/app-debug.apk"
