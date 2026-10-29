#!/usr/bin/env bash
# Builds and signs the APK straight from the Android SDK tools (no Gradle / network needed).
# Usage: android/build_apk.sh <web-dist-dir> <out.apk>
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_HOME:-/opt/android-sdk}"
BT="$SDK/build-tools/35.0.0"
JAR="$SDK/platforms/android-35/android.jar"
DIST="$(cd "$1" && pwd)"
OUT="$(realpath -m "$2")"
W="$HERE/build"
rm -rf "$W" && mkdir -p "$W"/{res,gen,classes,dex,apk}
MAIN="$HERE/app/src/main"

"$BT/aapt2" compile --dir "$MAIN/res" -o "$W/res/res.zip"
"$BT/aapt2" link -o "$W/base.apk" -I "$JAR" --manifest "$MAIN/AndroidManifest.xml" \
  --java "$W/gen" --min-sdk-version 26 --target-sdk-version 35 --version-code 1 --version-name 1.0 \
  -0 glb -0 bin -0 jpg -0 png -0 ogg -0 wasm "$W/res/res.zip"
javac -source 17 -target 17 -nowarn -classpath "$JAR" -d "$W/classes" \
  $(find "$MAIN/java" "$W/gen" -name '*.java') 2> >(grep -v "bootstrap classpath" >&2 || true)
"$BT/d8" --release --min-api 26 --lib "$JAR" --output "$W/dex" $(find "$W/classes" -name '*.class')

# assemble: resources apk + classes.dex + game files under assets/www (stored, not deflated, for fast streaming)
cd "$W/apk" && unzip -q "$W/base.apk" && cp "$W/dex/classes.dex" . && mkdir -p assets/www && cp -r "$DIST"/. assets/www/
rm -f "$W/unsigned.apk"
zip -q -r -D -X -n .glb:.bin:.jpg:.png:.ogg:.wasm:.webp "$W/unsigned.apk" AndroidManifest.xml resources.arsc classes.dex res assets
"$BT/zipalign" -f -p 4 "$W/unsigned.apk" "$W/aligned.apk"
"$BT/apksigner" sign --ks "$HERE/abyss.keystore" --ks-pass pass:abyssracer --key-pass pass:abyssracer \
  --ks-key-alias abyss --out "$OUT" "$W/aligned.apk"
"$BT/apksigner" verify "$OUT" && ls -la "$OUT"
