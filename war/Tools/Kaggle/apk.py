# Kaggle kernel (CPU): builds the Android APK. Unpacks the engine dataset, installs the Android
# toolchain the engine asks for (Engine/Extras/Android/SetupAndroid.sh), builds the Breach map from
# code and runs BuildCookRun for Android (ASTC). The APK lands in /kaggle/working/apk.
from common import sh
import glob, os, sys

BRANCH = "__BRANCH__"
W = "/kaggle/working"
UE = "/tmp/ue"
SDK = "/opt/android-sdk"

sh("apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq zstd unzip openjdk-21-jdk-headless ffmpeg "
   "libgtk-3-0t64 libnss3 libxss1 libasound2t64 libxkbcommon-x11-0 libgbm1 libsdl2-2.0-0 > /dev/null 2>&1; echo apt=$?")
parts = sorted(glob.glob("/kaggle/input/**/ue.tar.zst.part-*", recursive=True))
os.makedirs(UE, exist_ok=True)
sh(f"cat {' '.join(parts)} | zstd -d -T0 | tar -xf - -C {UE}; du -sh {UE}", check=True)
sh(f"find {UE} -type f \\( -name '*.sh' -o -path '*/Binaries/*' -o -path '*/SDKs/HostLinux/*/bin/*' -o -name 'dotnet' \\) -exec chmod +x {{}} +")
sh(f"git clone -q --depth 1 -b {BRANCH} https://github.com/moemenwork0-cmyk/game.git /tmp/game", check=True)
P = "/tmp/game/war/WarGame.uproject"
os.environ["SKETCHFAB_API_TOKEN"] = "__SKETCHFAB__"
sh("python3 /tmp/game/war/Tools/Assets/fetch.py 2>&1 | tail -2", check=True)
sh("mkdir -p /tmp/game/war/Content/Raw/Downloaded/Mixamo && "
   "cp $(find /kaggle/input -path '*desert-breach-animations*' \\( -name '*.fbx' -o -name '*.png' \\)) /tmp/game/war/Content/Raw/Downloaded/Mixamo/")

# Android toolchain: command-line tools, then the engine's own setup script picks the versions.
os.makedirs(f"{SDK}/cmdline-tools", exist_ok=True)
sh(f"cd /tmp && curl -sSLo clt.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip && "
   f"unzip -q clt.zip -d {SDK}/cmdline-tools && mv {SDK}/cmdline-tools/cmdline-tools {SDK}/cmdline-tools/latest", check=True)
java = sh("dirname $(dirname $(readlink -f $(which javac)))").strip().splitlines()[-1]
os.environ.update({"JAVA_HOME": java, "ANDROID_HOME": SDK, "ANDROID_SDK_ROOT": SDK, "STUDIO_SDK_PATH": SDK})
# SetupAndroid.sh needs Android Studio and takes its versions as arguments, so install the
# toolchain directly: NDK r27c (what the engine reports it requires), API 34/35, build-tools.
sh(f"grep -rlE 'r27c' {UE}/Engine/Config {UE}/Engine/Platforms 2>/dev/null | head -5")
SM = f"{SDK}/cmdline-tools/latest/bin/sdkmanager"
sh(f"yes | {SM} --sdk_root={SDK} --licenses > /dev/null 2>&1; echo licenses=$?")
sh(f"yes | {SM} --sdk_root={SDK} platform-tools 'platforms;android-34' 'platforms;android-35' 'build-tools;35.0.1' "
   f"'build-tools;34.0.0' 'ndk;27.2.12479018' 'cmake;3.22.1' 2>&1 | tail -4", check=True)
ndk = sorted(glob.glob(f"{SDK}/ndk/*"))
if ndk:
    os.environ["NDKROOT"] = os.environ["NDK_ROOT"] = ndk[-1]
sh(f"ls {SDK} {SDK}/ndk {SDK}/platforms {SDK}/build-tools 2>&1 | head -20; echo NDK=$NDKROOT JAVA=$JAVA_HOME")

sh("useradd -m ue 2>/dev/null; mkdir -p /kaggle/working/apk; chown -R ue /tmp/ue /tmp/game /kaggle/working " + SDK)
ENV = " ".join(f"{k}={os.environ[k]}" for k in ["JAVA_HOME", "ANDROID_HOME", "ANDROID_SDK_ROOT", "NDKROOT", "NDK_ROOT"] if k in os.environ)
U = f"runuser -u ue -- env HOME=/home/ue {ENV}"
sh(f"{U} {UE}/Engine/Build/BatchFiles/Linux/Build.sh WarGameEditor Linux Development -project={P} -waitmutex > {W}/build.log 2>&1; echo build=$?; tail -5 {W}/build.log")
sh(f"{U} {UE}/Engine/Binaries/Linux/UnrealEditor-Cmd {P} -run=pythonscript -script=/tmp/game/war/Tools/Editor/build_breach.py "
   f"-unattended -nosplash -nullrhi > {W}/map.log 2>&1; echo map=$?")
sh(f"timeout 30000 {U} {UE}/Engine/Build/BatchFiles/RunUAT.sh BuildCookRun -project={P} -noP4 -utf8output -platform=Android "
   f"-cookflavor=ASTC -clientconfig=Development -build -cook -stage -package -pak -archive -archivedirectory={W}/apk "
   f"-unattended > {W}/package.log 2>&1; echo package=$?; tail -40 {W}/package.log")
sh(f"find {W}/apk -name '*.apk' -exec ls -la {{}} +; grep -aE 'Error:|error:' {W}/package.log | head -30")
