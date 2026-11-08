# App Lock (Android 13+)

A tiny app locker built on an AccessibilityService. No external libraries, no Gradle.

**Install:** `dist/AppLock-debug.apk` (debug-signed).

## How it works
- First launch: set a password (min. 4 characters). App Lock itself always asks for it when opened.
- Tick the apps to lock. Every app (including Settings and the package installer) can be ticked or unticked.
- **Website blocker** (Facebook, Instagram, X/Twitter, TikTok - each can be ticked on/off).
  The accessibility service reads only the browser's address bar. If it shows a blocked site, a
  "blocked" screen covers the browser and the tab is sent to google.com. It never touches the
  network (no VPN, no DNS, no internet permission). A Google search that mentions facebook.com
  is not blocked; only the address of the page itself counts.
- Lock screen stays until you act (right password / wrong password / Cancel / Back) or you
  really switch to another app. Turning the screen off locks everything again.
  5 wrong passwords in a row -> 30 s pause.

## Known limits
- Turning off the accessibility service, or "Force stop" in App info, switches everything off.
  Lock the Settings app in the list if you want to prevent that.
- Safe mode disables all downloaded apps' accessibility services.
- Links opened *inside* other apps' own web views (not a real browser) are not checked;
  lock the Facebook / Instagram / X / TikTok apps themselves in the list to block the apps.
- Browsers with an unusual address-bar layout may not be recognised.

## Setup on the phone (Honor / Android 13+)
1. Install the APK (allow "install unknown apps" for your file manager/browser).
2. Open App Lock, set the password.
3. Android blocks Accessibility for sideloaded apps at first ("Restricted setting"). Go to
   Settings → Apps → App Lock → ⋮ (top right) → **Allow restricted settings**.
4. In App Lock tap **Accessibility** → Installed services / Downloaded apps → **App Lock** → On.
5. Honor battery manager may kill the service: Settings → Battery → App launch → App Lock →
   switch to *Manage manually* and enable all three toggles.

## Tests (no phone needed)
```
ANDROID_HOME=/path/to/sdk test/run.sh     # 58 domain checks + 30 Robolectric tests
```

## Build
```
ANDROID_HOME=/path/to/sdk ./build.sh     # needs platforms;android-34 and build-tools;35.0.0
```
`debug.keystore` is kept in the repo so rebuilt APKs install as updates over the old one.
