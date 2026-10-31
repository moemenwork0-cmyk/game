package com.simple.applock;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.provider.Settings;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** Password, locked-app list and temporary unlocks. */
final class Store {
    static final long UNLOCK_MS = 2 * 60 * 1000L;

    /** package -> time (elapsedRealtime) until which it stays unlocked. In memory only. */
    private static final Map<String, Long> unlockedUntil = new HashMap<>();

    private Store() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences("applock", Context.MODE_PRIVATE);
    }

    // ---- password ----

    static boolean hasPassword(Context c) {
        return prefs(c).contains("hash");
    }

    static void setPassword(Context c, String pw) {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        String s = hex(salt);
        prefs(c).edit().putString("salt", s).putString("hash", hash(s, pw)).apply();
    }

    static boolean checkPassword(Context c, String pw) {
        SharedPreferences p = prefs(c);
        String salt = p.getString("salt", null), h = p.getString("hash", null);
        return salt != null && h != null && MessageDigest.isEqual(
                h.getBytes(), hash(salt, pw).getBytes());
    }

    private static String hash(String salt, String pw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return hex(md.digest((salt + ":" + pw).getBytes("UTF-8")));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    // ---- locked apps ----

    static Set<String> lockedUserApps(Context c) {
        return new HashSet<>(prefs(c).getStringSet("locked", new HashSet<String>()));
    }

    static void setLocked(Context c, String pkg, boolean locked) {
        Set<String> s = lockedUserApps(c);
        if (locked) s.add(pkg); else s.remove(pkg);
        prefs(c).edit().putStringSet("locked", s).apply();
    }

    private static Set<String> alwaysLocked;

    /** Settings + package installer / uninstaller. Always locked, can't be unchecked. */
    static synchronized Set<String> alwaysLocked(Context c) {
        if (alwaysLocked != null) return alwaysLocked;
        Set<String> s = new HashSet<>();
        s.add("com.android.settings");
        s.add("com.android.packageinstaller");
        s.add("com.google.android.packageinstaller");
        s.add("com.hihonor.packageinstaller");
        s.add("com.huawei.packageinstaller");
        PackageManager pm = c.getPackageManager();

        // The real Settings app (package name varies by vendor).
        for (ResolveInfo ri : pm.queryIntentActivities(
                new Intent(Settings.ACTION_SETTINGS), PackageManager.MATCH_DEFAULT_ONLY)) {
            s.add(ri.activityInfo.packageName);
        }

        // The package installer / uninstaller. We probe the install and uninstall
        // intents, but only keep packages whose name is actually an installer -
        // otherwise every app that can open an .apk (app stores, file managers,
        // AI apps) would get force-locked, which is not what we want.
        Intent[] installProbes = {
                new Intent(Intent.ACTION_VIEW).setDataAndType(
                        Uri.parse("content://x/a.apk"), "application/vnd.android.package-archive"),
                new Intent(Intent.ACTION_INSTALL_PACKAGE).setData(Uri.parse("content://x/a.apk")),
                new Intent(Intent.ACTION_DELETE).setData(Uri.parse("package:com.simple.applock")),
                new Intent(Intent.ACTION_UNINSTALL_PACKAGE).setData(Uri.parse("package:com.simple.applock")),
        };
        for (Intent i : installProbes) {
            for (ResolveInfo ri : pm.queryIntentActivities(i, PackageManager.MATCH_DEFAULT_ONLY)) {
                String p = ri.activityInfo.packageName.toLowerCase();
                if (p.contains("packageinstaller") || p.contains("packageinstall")
                        || p.contains("com.android.packageinstaller")) {
                    s.add(ri.activityInfo.packageName);
                }
            }
        }
        s.remove(c.getPackageName());
        alwaysLocked = s;
        return s;
    }

    static boolean isLocked(Context c, String pkg) {
        return alwaysLocked(c).contains(pkg) || lockedUserApps(c).contains(pkg);
    }

    // ---- temporary unlocks ----

    static synchronized void unlock(String pkg) {
        unlockedUntil.put(pkg, android.os.SystemClock.elapsedRealtime() + UNLOCK_MS);
    }

    static synchronized long remainingMs(String pkg) {
        Long t = unlockedUntil.get(pkg);
        return t == null ? 0 : Math.max(0, t - android.os.SystemClock.elapsedRealtime());
    }
}
