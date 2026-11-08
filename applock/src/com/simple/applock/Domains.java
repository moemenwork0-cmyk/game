package com.simple.applock;

import java.util.Set;

/** Pure Java (no Android) so it can be unit-tested on a computer. */
final class Domains {
    private Domains() {}

    /** Sites the user can block. Each entry: id, display name, domains (subdomains included). */
    static final String[][] SITES = {
            {"facebook", "Facebook",
                    "facebook.com", "facebook.net", "fb.com", "fb.me", "fb.watch", "fbcdn.net",
                    "fbsbx.com", "messenger.com"},
            {"instagram", "Instagram",
                    "instagram.com", "cdninstagram.com", "ig.me", "instagr.am"},
            {"x", "X (Twitter)",
                    "x.com", "twitter.com", "twimg.com", "t.co"},
            {"tiktok", "TikTok",
                    "tiktok.com", "tiktokv.com", "tiktokv.us", "tiktokw.us", "tiktokcdn.com",
                    "tiktokcdn-us.com", "tiktokcdn-eu.com", "musical.ly", "tiktok.org"},
    };

    /**
     * Host part of what a browser shows in its address bar, or null if the text
     * isn't an address. "https://m.facebook.com/home?x=1" -> "m.facebook.com".
     * Only the host counts, so "google.com/search?q=facebook.com" -> "google.com".
     */
    static String hostOf(CharSequence text) {
        if (text == null) return null;
        String s = text.toString().trim().toLowerCase();
        if (s.isEmpty()) return null;
        if (s.startsWith("view-source:")) s = s.substring("view-source:".length());
        int scheme = s.indexOf("://");
        if (scheme > 0 && s.substring(0, scheme).matches("[a-z][a-z0-9+.-]*")) {
            s = s.substring(scheme + 3);
        }
        int end = s.length();
        for (char c : new char[]{'/', '?', '#', ' ', '\t', '\n'}) {
            int i = s.indexOf(c);
            if (i >= 0 && i < end) end = i;
        }
        s = s.substring(0, end);
        int at = s.lastIndexOf('@');          // user:pass@host
        if (at >= 0) s = s.substring(at + 1);
        int colon = s.indexOf(':');           // host:port
        if (colon >= 0) s = s.substring(0, colon);
        while (s.endsWith(".")) s = s.substring(0, s.length() - 1);
        if (!s.matches("([a-z0-9-]+\\.)+[a-z][a-z0-9-]+")) return null;
        return s;
    }

    /** True if host is one of the blocked domains or a subdomain of one. */
    static boolean isBlocked(Set<String> blocked, String host) {
        if (host == null || blocked.isEmpty()) return false;
        String h = host.toLowerCase();
        // Google Translate proxy: www-facebook-com.translate.goog -> www.facebook.com
        if (h.endsWith(".translate.goog")) {
            String label = h.substring(0, h.length() - ".translate.goog".length());
            int dot = label.lastIndexOf('.');
            if (dot >= 0) label = label.substring(dot + 1);
            h = label.replace("--", "\u0000").replace('-', '.').replace('\u0000', '-');
        }
        while (true) {
            if (blocked.contains(h)) return true;
            int dot = h.indexOf('.');
            if (dot < 0) return false;
            h = h.substring(dot + 1);
        }
    }
}
