#!/usr/bin/env bash
# Builds a debug-signed APK without Gradle. Needs: JDK, Android SDK with
# platforms;android-34 and build-tools;34.0.0.  Output: dist/AppLock-debug.apk
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/android-sdk}}"
BT="$SDK/build-tools/35.0.0"
JAR="$SDK/platforms/android-34/android.jar"
OUT=build
rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex" dist

"$BT/aapt2" compile --dir res -o "$OUT/res.zip"
"$BT/aapt2" link -I "$JAR" --manifest AndroidManifest.xml --java "$OUT/gen" \
    --min-sdk-version 33 --target-sdk-version 34 --version-code 1 --version-name 1.0 \
    -o "$OUT/unsigned.apk" "$OUT/res.zip"

javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$JAR:$BT/core-lambda-stubs.jar" -d "$OUT/classes" \
    $(find src "$OUT/gen" -name '*.java')
"$BT/d8" --release --min-api 33 --lib "$JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
(cd "$OUT/dex" && zip -q ../unsigned.apk classes.dex)

"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

KS=debug.keystore
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass android -keypass android -alias androiddebugkey \
      -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
fi
"$BT/apksigner" sign --v2-signing-enabled true --v4-signing-enabled false --ks "$KS" --ks-pass pass:android --key-pass pass:android \
    --out dist/AppLock-debug.apk "$OUT/aligned.apk"
"$BT/apksigner" verify dist/AppLock-debug.apk
echo "Built dist/AppLock-debug.apk"
