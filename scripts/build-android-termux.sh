#!/usr/bin/env bash
# Debug-APK auf einem arm64-Gerät mit Termux oder Termux Studio bauen.
# Die Maven-aapt2 ist x86_64 und startet dort nicht. android.aapt2FromMavenOverride
# zeigt Gradle auf eine aapt2, die auf dem Gerät läuft.
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck source=lib/android-env.sh
source "$(dirname "$0")/lib/android-env.sh"

echo "Chronostasis: Android-Debug-APK"
android_env_detect
android_env_print

if [ -z "${ENV_NODE:-}" ]; then
  echo "Node fehlt. Termux Studio installiert Node nicht."
  echo "In Termux: pkg install nodejs   (mindestens Node 20)"
  exit 1
fi
if [ -z "${ENV_JAVA_HOME:-}" ]; then
  echo "JDK fehlt. Termux Studio legt es nach \$PREFIX/lib/jvm/java-21-openjdk."
  echo "Sonst: pkg install openjdk-21   oder JAVA_HOME setzen."
  exit 1
fi
if [ -z "${ENV_AAPT2:-}" ]; then
  echo "Keine startbare aapt2 gefunden."
  echo "Termux Studio: \$HOME/android-sdk/build-tools/36.0.0/aapt2 oder \$PREFIX/bin/aapt2-aosp."
  echo "Nur Termux: pkg install aapt2, oder AAPT2=/pfad/zur/arm64-Datei."
  exit 1
fi
if [ -z "${ENV_SDK:-}" ]; then
  echo "Android-SDK nicht gefunden."
  echo "Gesucht: \$HOME/android-sdk, \$HOME/Android/Sdk, \$PREFIX/opt/android-sdk, ANDROID_SDK_ROOT, ANDROID_HOME."
  echo "Ablage: docs/android-termux.md"
  exit 1
fi

export JAVA_HOME="$ENV_JAVA_HOME"
export ANDROID_HOME="$ENV_SDK"
export ANDROID_SDK_ROOT="$ENV_SDK"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

npm install
npm run build
if [ ! -d android ]; then
  npx cap add android
fi
npx cap sync android
node scripts/patch-android.mjs "$ENV_AAPT2" "$ENV_SDK"
chmod +x android/gradlew
(
  cd android
  ./gradlew assembleDebug --no-daemon -Pandroid.aapt2FromMavenOverride="$ENV_AAPT2"
)
echo "Fertig: android/app/build/outputs/apk/debug/app-debug.apk"
echo "aapt2 für Gradle: $ENV_AAPT2"
echo "sdk.dir: $ENV_SDK"
