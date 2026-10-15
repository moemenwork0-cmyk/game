"""
Customises the Capacitor Android project: icon (from assets/icon.png), splash, portrait,
immersive full screen, vibration permission, release signing.
Run after `npx cap add android` / `npx cap sync android`:  python3 scripts/android_setup.py
"""
import os, re, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AND = os.path.join(ROOT, 'android', 'app', 'src', 'main')
RES = os.path.join(AND, 'res')
SRC = os.path.join(ROOT, 'assets', 'icon.png')
BG = '#2C4596'

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

dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, k in dens.items():
    folder = os.path.join(RES, f'mipmap-{d}')
    os.makedirs(folder, exist_ok=True)
    masked(icon, int(48 * k), 'rounded').save(os.path.join(folder, 'ic_launcher.png'))
    masked(icon, int(48 * k), 'circle').save(os.path.join(folder, 'ic_launcher_round.png'))
    # Adaptive icon: the artwork fills the whole 108dp layer; the launcher mask crops the edges.
    icon.resize((int(108 * k), int(108 * k)), Image.LANCZOS).save(os.path.join(folder, 'ic_launcher_foreground.png'))

with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w') as f:
    f.write(f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BG}</color>\n</resources>\n')

# Splash: brand blue with the icon in the middle (replaces the Capacitor placeholder images).
for name in os.listdir(RES):
    if name.startswith('drawable-port') or name.startswith('drawable-land'):
        p = os.path.join(RES, name, 'splash.png')
        if os.path.exists(p):
            os.remove(p)
        try:
            os.rmdir(os.path.join(RES, name))
        except OSError:
            pass
old = os.path.join(RES, 'drawable', 'splash.png')
if os.path.exists(old):
    os.remove(old)
masked(icon, 288, 'rounded').save(os.path.join(RES, 'drawable', 'splash_icon.png'))
with open(os.path.join(RES, 'drawable', 'splash.xml'), 'w') as f:
    f.write(f'''<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item><color android:color="{BG}"/></item>
    <item android:width="144dp" android:height="144dp" android:gravity="center" android:drawable="@drawable/splash_icon"/>
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
        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>
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
