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

    static boolean isLocked(Context c, String pkg) {
        return lockedUserApps(c).contains(pkg);
    }

    // ---- Private DNS lock ----

    /** Key used for the temporary unlock of the Private DNS screen. */
    static final String DNS_KEY = "#private_dns";

    static boolean dnsLockOn(Context c) {
        return prefs(c).getBoolean("dns_lock", true);
    }

    static void setDnsLock(Context c, boolean on) {
        prefs(c).edit().putBoolean("dns_lock", on).apply();
    }

    private static Set<String> settingsPkgs;

    /** The Settings app package(s) on this phone. */
    static synchronized Set<String> settingsPackages(Context c) {
        if (settingsPkgs != null) return settingsPkgs;
        Set<String> s = new HashSet<>();
        s.add("com.android.settings");
        for (ResolveInfo ri : c.getPackageManager().queryIntentActivities(
                new Intent(Settings.ACTION_SETTINGS), PackageManager.MATCH_DEFAULT_ONLY)) {
            s.add(ri.activityInfo.packageName);
        }
        settingsPkgs = s;
        return s;
    }

    /** Package installer / uninstaller(s): no launcher icon, but lockable from the list. */
    static Set<String> installerPackages(Context c) {
        Set<String> s = new HashSet<>();
        PackageManager pm = c.getPackageManager();
        Intent[] probes = {
                new Intent(Intent.ACTION_VIEW).setDataAndType(
                        Uri.parse("content://x/a.apk"), "application/vnd.android.package-archive"),
                new Intent(Intent.ACTION_INSTALL_PACKAGE).setData(Uri.parse("content://x/a.apk")),
                new Intent(Intent.ACTION_DELETE).setData(Uri.parse("package:" + c.getPackageName())),
                new Intent(Intent.ACTION_UNINSTALL_PACKAGE).setData(Uri.parse("package:" + c.getPackageName())),
        };
        for (Intent i : probes) {
            for (ResolveInfo ri : pm.queryIntentActivities(i, PackageManager.MATCH_DEFAULT_ONLY)) {
                if (ri.activityInfo.packageName.toLowerCase().contains("packageinstall")) {
                    s.add(ri.activityInfo.packageName);
                }
            }
        }
        return s;
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
