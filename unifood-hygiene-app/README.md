# UNIFOOD Hygiene Score – Android app

Mobile version of `UNIFOOD_Hygiene_Score_v5_1.html` (form F-C&S-01-04). The checklist (160 points, 18 areas, 6 departments), the scoring and every feature of the web page are kept. Two things are new:

- **Mobile design:** bottom tab bar, large ✓ / ✗ / N/A buttons, a filter sheet, the native camera and Android share menu, the hardware back button and a zoomable plant map.
- **Shared database:** every phone with the app sees the same records and photos live, through Cloud Firestore (Firebase project `unifood-hygiene`, free Spark plan). There is no login. Without internet everything is saved on the phone and uploads on its own when the connection returns. A badge in the top bar shows the state (synced / uploading / offline).

## Data in Firestore

| Collection | One document per | Content |
|---|---|---|
| `docs` | day (`YYYY-MM-DD_D`) | `marks`, `notes`, `at`, `who` and `nat`, keyed by point ID. Each tap merges only that point, so phones never overwrite each other. |
| `pmeta` | photo | point, date, time, inspector and a small thumbnail |
| `pfull` | photo | the compressed JPEG (about 0.2 MB) |

Firestore rules allow read and write on these collections (plus `meta`) only.

Files from the old web page (day file or full backup) can be brought in through **Send → Import files**.

## Build

The build needs Node 22, JDK 21 and the Android SDK (platform 36).

```bash
npm ci
npm run apk
```

```bash
# the APK is written here:
ls android/app/build/outputs/apk/release/app-release.apk
```

GitHub Actions (`.github/workflows/unifood-apk.yml`) builds the same APK on every push that changes this folder. You download it from the run's **Artifacts**.

**Signing:** the release key (`signing/unifood-release.jks` and `signing/keystore.properties`) is kept out of git and stored by the owner. Put the `signing/` folder back next to this README before you build an update: Android installs an update over the old app only when the update is signed with the same key. Without that folder the build uses the debug key, which is fine for testing only. When you release an update, raise `versionCode` and `versionName` in `android/app/build.gradle`, and `APP_VERSION` in `src/main.js`.

## Code

- `src/data.js`: checklist data, copied unchanged from the web page
- `src/main.js`: screens and logic (scoring is unchanged from the web page)
- `src/firebase.js`: shared database
- `src/native.js`: camera, sharing, vibration and the back button
- `src/styles.css`: design
