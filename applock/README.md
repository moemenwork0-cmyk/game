# App Lock (Android 13+)

A tiny app locker built on an AccessibilityService. No external libraries, no Gradle.

**Install:** `dist/AppLock-debug.apk` (debug-signed).

## How it works
- First launch: set a password (min. 4 characters). App Lock itself always asks for it when opened.
- Tick the apps to lock. Android Settings and the package installer/uninstaller are always locked.
- When a locked app comes to the front, a full-screen password screen covers it.
  - Wrong password, Cancel or Back → Home screen.
  - Correct password → the app is usable for 2 minutes, then it locks again.

## Setup on the phone (Honor / Android 13+)
1. Install the APK (allow "install unknown apps" for your file manager/browser).
2. Open App Lock, set the password.
3. Android blocks Accessibility for sideloaded apps at first ("Restricted setting"). Go to
   Settings → Apps → App Lock → ⋮ (top right) → **Allow restricted settings**.
4. In App Lock tap **Accessibility** → Installed services / Downloaded apps → **App Lock** → On.
5. Honor battery manager may kill the service: Settings → Battery → App launch → App Lock →
   switch to *Manage manually* and enable all three toggles.

## Build
```
ANDROID_HOME=/path/to/sdk ./build.sh     # needs platforms;android-34 and build-tools;35.0.0
```
`debug.keystore` is kept in the repo so rebuilt APKs install as updates over the old one.
