# App Lock (Android 13+)

A tiny app locker built on an AccessibilityService. No external libraries, no Gradle.

**Install:** `dist/AppLock-debug.apk` (debug-signed).

## How it works
- First launch: set a password (min. 4 characters). App Lock itself always asks for it when opened.
- Tick the apps to lock. Every app (including Settings and the package installer) can be ticked or unticked.
- **Website blocker** (Facebook, Instagram, X/Twitter, TikTok - each can be ticked on/off). Two layers:
  1. A local DNS-only VPN: lookups for the blocked domains get "not found", so they don't load in
     any browser or app. Other traffic does not go through the VPN.
  2. The accessibility service reads browsers' address bars; if one shows a blocked site it goes
     Back (then Home). This still works when a browser uses its own secure DNS or the VPN is off.
  Private DNS in "hostname" mode skips layer 1 (Android sends DNS straight to that server) - set
  it to Automatic or Off for full blocking. Turn on Settings -> VPN -> App Lock -> *Always-on VPN*
  so Android keeps the blocker running and restarts it after a reboot.
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
