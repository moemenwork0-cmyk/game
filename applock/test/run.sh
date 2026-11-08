#!/bin/bash
# Runs the tests on a computer (no phone needed) with Robolectric.
# First run downloads the test libraries (~350 MB) into test/lib.
set -e
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-$HOME/android-sdk}"
[ -d lib ] || mvn -q -B dependency:copy-dependencies -DoutputDirectory=lib
for a in lib/*.aar; do [ -f "${a%.aar}.jar" ] || unzip -p "$a" classes.jar > "${a%.aar}.jar"; done
rm -rf out && mkdir out
LIBS=$(ls lib/*.jar | grep -v android-all | tr '\n' ':')
javac -nowarn -d out -cp "$LIBS$SDK/platforms/android-34/android.jar" \
    ../src/com/simple/applock/{Store,Domains,LockService,MainActivity}.java src/com/simple/applock/*.java
java -cp out com.simple.applock.DomainsTest
java -Drobolectric.enabledSdks=33 -Drobolectric.offline=true -Drobolectric.dependency.dir=lib \
    -cp "out:${LIBS}lib/android-all-instrumented-13-robolectric-9030017-i7.jar" \
    org.junit.runner.JUnitCore com.simple.applock.LockServiceTest com.simple.applock.MainActivityTest
