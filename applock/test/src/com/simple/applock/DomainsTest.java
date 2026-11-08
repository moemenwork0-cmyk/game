package com.simple.applock;
import java.util.*;
public class DomainsTest {
  static int fail = 0;
  static void eq(Object got, Object want, String what) {
    if (!Objects.equals(got, want)) { fail++; System.out.println("FAIL " + what + ": got " + got + " want " + want); }
  }
  public static void main(String[] a) {
    Set<String> all = new HashSet<>();
    for (String[] s : Domains.SITES) for (int i = 2; i < s.length; i++) all.add(s[i]);
    String[][] host = {
      {"facebook.com","facebook.com"}, {"https://m.facebook.com/home?x=1","m.facebook.com"},
      {"HTTP://WWW.FACEBOOK.COM","www.facebook.com"}, {"  facebook.com  ","facebook.com"},
      {"facebook.com:443/login","facebook.com"}, {"user:pw@facebook.com/x","facebook.com"},
      {"view-source:https://x.com","x.com"}, {"google.com/search?q=facebook.com","google.com"},
      {"https://www.google.com/search?q=site:facebook.com","www.google.com"},
      {"facebook","" }, {"how to delete facebook.com account","" /*first word*/},
      {"Search or type web address",null}, {"","" }, {null,null},
      {"facebook.com.",  "facebook.com"}, {"192.168.1.1", null}, {"about:blank", null},
      {"chrome://settings", null}, {"www-facebook-com.translate.goog/x","www-facebook-com.translate.goog"},
    };
    for (String[] h : host) {
      String want = h[1] == null || h[1].isEmpty() ? null : h[1];
      if (h[0] != null && h[0].equals("how to delete facebook.com account")) want = null;
      eq(Domains.hostOf(h[0]), want, "hostOf(" + h[0] + ")");
    }
    String[] blocked = {"facebook.com","m.facebook.com","web.facebook.com","fb.com","instagram.com",
      "www.instagram.com","x.com","mobile.x.com","twitter.com","mobile.twitter.com","t.co","tiktok.com",
      "www.tiktok.com","vm.tiktok.com","www-facebook-com.translate.goog","www-instagram-com.translate.goog",
      "messenger.com","FACEBOOK.COM"};
    String[] allowed = {"google.com","box.com","fax.com","netflix.com","notfacebook.com","facebook.co",
      "x.co","x.com.eg","t.com","tiktok.co","example.com","youtube.com","instagram.org","translate.goog",
      "www-google-com.translate.goog", "linkedin.com", "dns.google"};
    for (String h : blocked) eq(Domains.isBlocked(all, h), true, "blocked " + h);
    for (String h : allowed) eq(Domains.isBlocked(all, h), false, "allowed " + h);
    eq(Domains.isBlocked(new HashSet<String>(), "facebook.com"), false, "empty set");
    eq(Domains.isBlocked(all, null), false, "null host");
    // only Facebook ticked
    Set<String> fb = new HashSet<>(Arrays.asList(Arrays.copyOfRange(Domains.SITES[0], 2, Domains.SITES[0].length)));
    eq(Domains.isBlocked(fb, "instagram.com"), false, "instagram allowed when only fb ticked");
    eq(Domains.isBlocked(fb, "facebook.com"), true, "fb blocked when fb ticked");
    System.out.println(fail == 0 ? "ALL PASSED (" + (host.length + blocked.length + allowed.length + 4) + " checks)" : fail + " FAILED");
  }
}
