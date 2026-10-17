"""
Customises the Capacitor Android project: app name, icon (from assets/icon.png), splash (Jello from
assets/brand/jello.png, made by scripts/brand.mjs), portrait, immersive full screen, vibration,
release signing.
Run after `npx cap add android` / `npx cap sync android`:  python3 scripts/android_setup.py
"""
import os, re, sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AND = os.path.join(ROOT, 'android', 'app', 'src', 'main')
RES = os.path.join(AND, 'res')
SRC = os.path.join(ROOT, 'assets', 'icon.png')
BG = '#1B1554'
APP_NAME = 'Jelly Fit'
JELLO = os.path.join(ROOT, 'assets', 'brand', 'jello.png')

if not os.path.exists(SRC):
    sys.exit('assets/icon.png is missing (the app icon from the user)')

icon = Image.open(SRC).convert('RGBA')
side = min(icon.size)
icon = icon.crop(((icon.width - side) // 2, (icon.height - side) // 2, (icon.width + side) // 2, (icon.height + side) // 2))

def masked(img, size, shape):
    im = img.resize((size, size), Image.LANCZOS)
    m = Image.new('L', (size * 4, size * 4), 0)
    d = ImageDraw.Draw(m)
    if shape == 'circle':
        d.ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=int(size * 4 * 0.18), fill=255)
    m = m.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    return out

def feathered(img, size, feather):
    """img resized to size×size with its outer edge fading out over `feather` (0..0.5 of the size)."""
    im = img.resize((size, size), Image.LANCZOS)
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    f = int(size * feather)
    steps = max(1, f)
    for i in range(steps):
        a = int(255 * (i + 1) / steps)
        d.rounded_rectangle((i, i, size - 1 - i, size - 1 - i), radius=max(0, int(size * 0.2) - i), fill=a)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    return out

dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, k in dens.items():
    folder = os.path.join(RES, f'mipmap-{d}')
    os.makedirs(folder, exist_ok=True)
    masked(icon, int(48 * k), 'rounded').save(os.path.join(folder, 'ic_launcher.png'))
    masked(icon, int(48 * k), 'circle').save(os.path.join(folder, 'ic_launcher_round.png'))
    # Adaptive icon: launchers show only the middle 72dp of the 108dp layers and may mask it to a
    # circle. The artwork goes in at 70dp (Jello's head and crown stay inside every mask) with a
    # soft edge, over a blurred, zoomed copy of itself, so no seam or empty border ever shows.
    L = int(108 * k)
    fg = Image.new('RGBA', (L, L), (0, 0, 0, 0))
    art = feathered(icon, int(70 * k), 0.05)
    fg.paste(art, ((L - art.width) // 2, (L - art.height) // 2), art)
    fg.save(os.path.join(folder, 'ic_launcher_foreground.png'))
    # Background: a soft radial blue taken from the artwork's own rays.
    bgimg = Image.new('RGBA', (L, L))
    px = bgimg.load()
    c0 = (24, 92, 250)
    c1 = (6, 40, 190)
    for y in range(L):
        for x in range(L):
            t = min(1.0, (((x - L / 2) ** 2 + (y - L / 2) ** 2) ** 0.5) / (L * 0.62))
            px[x, y] = tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3)) + (255,)
    bgimg.save(os.path.join(folder, 'ic_launcher_bg.png'))

for name in ('ic_launcher.xml', 'ic_launcher_round.xml'):
    with open(os.path.join(RES, 'mipmap-anydpi-v26', name), 'w') as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_bg"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
''')

with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w') as f:
    f.write(f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BG}</color>\n</resources>\n')

# App name under the icon: English.
sp = os.path.join(RES, 'values', 'strings.xml')
st = open(sp, encoding='utf-8').read()
st = re.sub(r'<string name="app_name">[^<]*</string>', f'<string name="app_name">{APP_NAME}</string>', st)
st = re.sub(r'<string name="title_activity_main">[^<]*</string>', f'<string name="title_activity_main">{APP_NAME}</string>', st)
open(sp, 'w', encoding='utf-8').write(st)

# Splash: the night colour with Jello, big and crisp (no small square icon).
for name in os.listdir(RES):
    if name.startswith('drawable-port') or name.startswith('drawable-land'):
        p = os.path.join(RES, name, 'splash.png')
        if os.path.exists(p):
            os.remove(p)
        try:
            os.rmdir(os.path.join(RES, name))
        except OSError:
            pass
for old in ('splash.png', 'splash_icon.png'):
    p = os.path.join(RES, 'drawable', old)
    if os.path.exists(p):
        os.remove(p)
if not os.path.exists(JELLO):
    sys.exit('assets/brand/jello.png is missing: run node scripts/brand.mjs')
jello = Image.open(JELLO).convert('RGBA')
for d, k in dens.items():
    folder = os.path.join(RES, f'drawable-{d}')
    os.makedirs(folder, exist_ok=True)
    # Android 12+ splash icon: 288dp canvas, shown through a 192dp circle; Jello fills it nicely.
    S = int(288 * k)
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    j = jello.resize((int(S * 0.62), int(S * 0.62)), Image.LANCZOS)
    canvas.paste(j, ((S - j.width) // 2, (S - j.height) // 2), j)
    canvas.save(os.path.join(folder, 'splash_jello.png'))
    # Older Android: the same Jello at 170dp on the launch window.
    jj = jello.resize((int(170 * k), int(170 * k)), Image.LANCZOS)
    jj.save(os.path.join(folder, 'splash_jello_small.png'))
with open(os.path.join(RES, 'drawable', 'splash.xml'), 'w') as f:
    f.write(f'''<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item><color android:color="{BG}"/></item>
    <item android:gravity="center"><bitmap android:src="@drawable/splash_jello_small" android:gravity="center"/></item>
</layer-list>
''')

# Styles: splash colours, no edge-to-edge surprises on Android 15, game window.
styles = f'''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:windowBackground">@color/ic_launcher_background</item>
        <item name="android:statusBarColor">{BG}</item>
        <item name="android:navigationBarColor">{BG}</item>
        <item name="android:windowOptOutEdgeToEdgeEnforcement" tools:targetApi="35">true</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="windowSplashScreenBackground">@color/ic_launcher_background</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_jello</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
'''
styles = styles.replace('<resources>', '<resources xmlns:tools="http://schemas.android.com/tools">', 1)
with open(os.path.join(RES, 'values', 'styles.xml'), 'w') as f:
    f.write(styles)

# Manifest: portrait, vibration.
mp = os.path.join(AND, 'AndroidManifest.xml')
m = open(mp).read()
if 'screenOrientation' not in m:
    m = m.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"')
if 'android.permission.VIBRATE' not in m:
    m = m.replace('<uses-permission android:name="android.permission.INTERNET" />', '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.VIBRATE" />')
open(mp, 'w').write(m)

# Immersive full screen (system bars hidden, swipe to peek).
with open(os.path.join(AND, 'java', 'com', 'jellyfit', 'game', 'MainActivity.java'), 'w') as f:
    f.write('''package com.jellyfit.game;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
''')

# Release signing from android/keystore.properties (kept out of git).
bg = os.path.join(ROOT, 'android', 'app', 'build.gradle')
g = open(bg).read()
if 'signingConfigs' not in g:
    g = g.replace('android {', '''def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }''', 1)
    g = g.replace('''        release {
            minifyEnabled false''', '''        release {
            if (keystorePropertiesFile.exists()) signingConfig signingConfigs.release
            minifyEnabled false''', 1)
    open(bg, 'w').write(g)
print('android project customised')
