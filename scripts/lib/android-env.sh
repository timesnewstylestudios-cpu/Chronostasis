# Shared detection for scripts/build-android-termux.sh.
# Source this file, then call android_env_detect. It sets ENV_* and never exits.

android_env_trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s' "$value"
}

android_env_prop() {
  local file="$1"
  local key="$2"
  local line
  [ -f "$file" ] || return 1
  line="$(grep -E "^[[:space:]]*${key}=" "$file" 2>/dev/null | tail -n 1 || true)"
  [ -n "$line" ] || return 1
  android_env_trim "${line#*=}"
}

android_env_sdk_ok() {
  local dir="$1"
  [ -n "$dir" ] && [ -d "$dir" ] || return 1
  [ -d "$dir/platforms" ] || [ -d "$dir/build-tools" ] || [ -d "$dir/cmdline-tools" ]
}

android_env_aapt2_ok() {
  local bin="$1"
  [ -n "$bin" ] && [ -x "$bin" ] || return 1
  "$bin" version >/dev/null 2>&1
}

android_env_java_ok() {
  local home="$1"
  [ -n "$home" ] && [ -x "$home/bin/java" ] || return 1
  "$home/bin/java" -version >/dev/null 2>&1
}

android_env_first_aapt2() {
  local candidate
  for candidate in "$@"; do
    [ -n "$candidate" ] || continue
    if android_env_aapt2_ok "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

android_env_first_sdk() {
  local candidate
  for candidate in "$@"; do
    [ -n "$candidate" ] || continue
    if android_env_sdk_ok "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

android_env_first_java() {
  local candidate
  for candidate in "$@"; do
    [ -n "$candidate" ] || continue
    if android_env_java_ok "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

android_env_build_tools_aapt2() {
  local sdk="$1"
  local tools="$sdk/build-tools"
  local dir base
  [ -d "$tools" ] || return 0
  local found=()
  for dir in "$tools"/*; do
    [ -d "$dir" ] || continue
    base="$(basename "$dir")"
    [ -x "$dir/aapt2" ] || continue
    found+=("$base|$dir/aapt2")
  done
  [ "${#found[@]}" -gt 0 ] || return 0
  printf '%s\n' "${found[@]}" | sort -t. -k1,1n -k2,2n -k3,3n | awk -F'|' '{print $2}'
}

android_env_studio_marker() {
  local prefix="$1"
  local home="$2"
  if [ -x "$prefix/bin/studio" ] || [ -d "$home/.studio" ] || [ -f "$home/termux_studio.py" ] || [ -d "$home/termux-studio" ]; then
    return 0
  fi
  if command -v studio >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# Sets ENV_KIND, ENV_PREFIX, ENV_HOME, ENV_SDK, ENV_AAPT2, ENV_JAVA_HOME, ENV_NODE, ENV_GRADLE.
android_env_detect() {
  local prefix="${PREFIX:-}"
  local home="${HOME:-}"
  local gradle_props="$home/.gradle/gradle.properties"
  local prop_aapt2=""
  local prop_java=""
  ENV_KIND="unbekannt"
  ENV_PREFIX="$prefix"
  ENV_HOME="$home"
  ENV_SDK=""
  ENV_AAPT2=""
  ENV_JAVA_HOME=""
  ENV_NODE=""
  ENV_GRADLE=""
  ENV_NOTE=""

  prop_aapt2="$(android_env_prop "$gradle_props" "android.aapt2FromMavenOverride" || true)"
  prop_java="$(android_env_prop "$gradle_props" "org.gradle.java.home" || true)"

  local studio=0
  if android_env_studio_marker "$prefix" "$home"; then
    studio=1
    ENV_KIND="Termux Studio"
  elif [ -n "$prefix" ] && { [ -x "$prefix/bin/pkg" ] || [ -d "$prefix/lib/jvm" ]; }; then
    ENV_KIND="Termux"
  elif [ -n "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}${JAVA_HOME:-}" ]; then
    ENV_KIND="Umgebungsvariablen"
  fi

  local -a sdk_candidates=()
  local -a aapt2_candidates=()
  local -a java_candidates=()
  local bt

  if [ "$studio" -eq 1 ]; then
    sdk_candidates=(
      "$home/android-sdk"
      "$home/Android/Sdk"
      "$home/Android/sdk"
      "$prefix/opt/android-sdk"
      "${ANDROID_SDK_ROOT:-}"
      "${ANDROID_HOME:-}"
    )
  else
    sdk_candidates=(
      "$home/android-sdk"
      "$home/Android/Sdk"
      "$home/Android/sdk"
      "$prefix/opt/android-sdk"
      "${ANDROID_SDK_ROOT:-}"
      "${ANDROID_HOME:-}"
    )
  fi
  ENV_SDK="$(android_env_first_sdk "${sdk_candidates[@]}" || true)"

  if [ "$studio" -eq 1 ]; then
    aapt2_candidates+=("$prop_aapt2")
    aapt2_candidates+=(
      "$ENV_SDK/build-tools/36.0.0/aapt2"
      "$ENV_SDK/build-tools/36.1.0/aapt2"
      "$ENV_SDK/build-tools/35.0.0/aapt2"
      "$ENV_SDK/build-tools/34.0.4/aapt2"
    )
    if [ -n "$ENV_SDK" ]; then
      while IFS= read -r bt; do
        [ -n "$bt" ] && aapt2_candidates+=("$bt")
      done < <(android_env_build_tools_aapt2 "$ENV_SDK" | awk '{lines[NR]=$0} END {for (i=NR; i>=1; i--) print lines[i]}')
    fi
    aapt2_candidates+=(
      "$prefix/bin/aapt2-aosp"
      "$home/.androidide/aapt2"
      "$prefix/bin/aapt2"
      "${AAPT2:-}"
    )
  else
    aapt2_candidates+=(
      "$prefix/bin/aapt2"
      "$prefix/bin/aapt2-aosp"
      "$prop_aapt2"
      "$ENV_SDK/build-tools/36.0.0/aapt2"
      "$ENV_SDK/build-tools/36.1.0/aapt2"
      "$ENV_SDK/build-tools/35.0.0/aapt2"
      "$ENV_SDK/build-tools/34.0.4/aapt2"
    )
    if [ -n "$ENV_SDK" ]; then
      while IFS= read -r bt; do
        [ -n "$bt" ] && aapt2_candidates+=("$bt")
      done < <(android_env_build_tools_aapt2 "$ENV_SDK" | awk '{lines[NR]=$0} END {for (i=NR; i>=1; i--) print lines[i]}')
    fi
    aapt2_candidates+=(
      "$home/.androidide/aapt2"
      "${AAPT2:-}"
    )
  fi
  if command -v aapt2 >/dev/null 2>&1; then
    aapt2_candidates+=("$(command -v aapt2)")
  fi
  ENV_AAPT2="$(android_env_first_aapt2 "${aapt2_candidates[@]}" || true)"

  if [ "$studio" -eq 1 ]; then
    java_candidates=(
      "$prop_java"
      "$prefix/lib/jvm/java-21-openjdk"
      "$prefix/lib/jvm/java-17-openjdk"
      "$prefix/lib/jvm/java-11-openjdk"
      "$prefix/opt/openjdk"
      "${JAVA_HOME:-}"
    )
  else
    java_candidates=(
      "${JAVA_HOME:-}"
      "$prefix/lib/jvm/java-21-openjdk"
      "$prefix/lib/jvm/java-17-openjdk"
      "$prefix/lib/jvm/java-11-openjdk"
      "$prefix/opt/openjdk"
      "$prop_java"
    )
  fi
  ENV_JAVA_HOME="$(android_env_first_java "${java_candidates[@]}" || true)"

  if [ -n "$prefix" ] && [ -x "$prefix/bin/node" ]; then
    ENV_NODE="$prefix/bin/node"
  elif command -v node >/dev/null 2>&1; then
    ENV_NODE="$(command -v node)"
  fi

  if [ -n "$prefix" ] && [ -x "$prefix/bin/gradle" ]; then
    ENV_GRADLE="$prefix/bin/gradle"
  elif command -v gradle >/dev/null 2>&1; then
    ENV_GRADLE="$(command -v gradle)"
  fi

  if [ "$studio" -eq 1 ] && [ -n "$prop_aapt2" ] && [ "$ENV_AAPT2" = "$prop_aapt2" ]; then
    ENV_NOTE="aapt2 aus ~/.gradle/gradle.properties"
  elif [ "$studio" -eq 1 ]; then
    ENV_NOTE="Studio-aapt2 vor dem Paket aus pkg"
  fi
}

android_env_print() {
  echo "Umgebung: $ENV_KIND"
  echo "  PREFIX: ${ENV_PREFIX:-—}"
  echo "  HOME: ${ENV_HOME:-—}"
  echo "  JAVA_HOME: ${ENV_JAVA_HOME:-—}"
  echo "  ANDROID_HOME: ${ENV_SDK:-—}"
  echo "  aapt2: ${ENV_AAPT2:-—}"
  echo "  Node: ${ENV_NODE:-—}"
  echo "  Gradle (System): ${ENV_GRADLE:-—} (gebaut wird mit android/gradlew)"
  if [ -n "${ENV_NOTE:-}" ]; then
    echo "  Hinweis: $ENV_NOTE"
  fi
}
