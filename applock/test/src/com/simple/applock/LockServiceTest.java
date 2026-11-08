package com.simple.applock;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.ResolveInfo;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.widget.Button;
import android.widget.EditText;

import org.robolectric.RuntimeEnvironment;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAccessibilityNodeInfo;
import org.robolectric.shadows.ShadowAccessibilityService;
import org.robolectric.shadows.ShadowAccessibilityWindowInfo;

import java.lang.reflect.Field;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33, manifest = Config.NONE, qualifiers = "w1080dp-h2400dp-mdpi")
public class LockServiceTest {

    static final String GAME = "com.example.game";
    static final String NOTES = "com.example.notes";
    static final String LAUNCHER = "com.hihonor.android.launcher";
    static final String CHROME = "com.android.chrome";
    static final String KEYBOARD = "com.google.android.inputmethod.latin";
    static final String ME = "com.simple.applock";
    static final int W = 1080, H = 2400;

    Context ctx;
    LockService svc;
    ShadowAccessibilityService shadowSvc;

    @Before
    public void setUp() throws Exception {
        ctx = RuntimeEnvironment.getApplication();
        for (String p : new String[]{GAME, NOTES, LAUNCHER, CHROME, KEYBOARD}) installApp(p);
        // Chrome handles web links, so it is detected as a browser.
        ResolveInfo ri = new ResolveInfo();
        ri.activityInfo = new ActivityInfo();
        ri.activityInfo.packageName = CHROME;
        ri.activityInfo.name = CHROME + ".Main";
        ri.activityInfo.applicationInfo = new ApplicationInfo();
        ri.activityInfo.applicationInfo.packageName = CHROME;
        shadowOf(ctx.getPackageManager()).addResolveInfoForIntent(
                new Intent(Intent.ACTION_VIEW, Uri.parse("http://example.com")), ri);

        // reset static state between tests
        Store.clearUnlocks();
        setStatic(Store.class, "wrongInARow", 0);
        setStatic(Store.class, "lockedOutUntil", 0L);
        setStatic(Store.class, "blockedCache", null);

        Store.setPassword(ctx, "1234");
        Store.setLocked(ctx, GAME, true);
        for (String[] s : Domains.SITES) Store.setSiteBlocked(ctx, s[0], true);

        svc = Robolectric.setupService(LockService.class);
        shadowSvc = shadowOf(svc);
        svc.onServiceConnected();
    }

    // ------------------------------------------------------------ app lock

    @Test public void lockedApp_showsLockScreen() {
        open(GAME);
        assertEquals(1, kind());
        assertTrue("lock screen must be focusable for typing", lockFocusable());
    }

    @Test public void unlockedApp_noLockScreen() {
        open(NOTES);
        assertNull(overlay());
    }

    /** The reported bug: keyboard popping up made the lock screen vanish. */
    @Test public void keyboardEvent_withNoReadableWindows_keepsLockScreen() {
        open(GAME);
        setWindows(); // phone briefly reports no app windows
        event(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED, KEYBOARD);
        event(AccessibilityEvent.TYPE_WINDOWS_CHANGED, null);
        idle(3000);
        assertEquals("lock screen must stay while user types", 1, kind());
        assertTrue(shadowSvc.getGlobalActionsPerformed().isEmpty());
    }

    @Test public void ownOverlayEvents_keepLockScreen() {
        open(GAME);
        event(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED, ME);
        setWindows();
        event(AccessibilityEvent.TYPE_WINDOWS_CHANGED, null);
        idle(3000);
        assertEquals(1, kind());
    }

    @Test public void lockScreen_staysUntilUserActs_evenAfterLongTime() {
        open(GAME);
        for (int i = 0; i < 20; i++) {
            event(AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED, GAME);
            event(AccessibilityEvent.TYPE_WINDOWS_CHANGED, null);
            idle(500);
        }
        assertEquals(1, kind());
        assertTrue(shadowSvc.getGlobalActionsPerformed().isEmpty());
    }

    @Test public void briefLauncherFlash_doesNotCloseLockScreen() {
        open(GAME);
        setWindows(win(LAUNCHER, 1, full()));
        event(AccessibilityEvent.TYPE_WINDOWS_CHANGED, null);
        idle(150);
        setWindows(win(GAME, 2, full()));
        event(AccessibilityEvent.TYPE_WINDOWS_CHANGED, null);
        idle(2000);
        assertEquals(1, kind());
    }

    @Test public void goingHome_closesLockScreen() {
        open(GAME);
        setWindows(win(LAUNCHER, 1, full()));
        event(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED, LAUNCHER);
        idle(1000);
        assertNull(overlay());
    }

    @Test public void correctPassword_unlocksFor2Minutes_thenRelocks() {
        open(GAME);
        type("1234");
        clickButton("Unlock");
        idle(100);
        assertNull("unlocked", overlay());
        assertTrue(shadowSvc.getGlobalActionsPerformed().isEmpty());
        // keep using the app for 1 minute: no lock
        event(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED, GAME);
        idle(60_000);
        assertNull(overlay());
        // after 2 minutes the lock comes back by itself
        idle(61_000);
        assertEquals(1, kind());
    }

    @Test public void wrongPassword_goesHome() {
        open(GAME);
        type("9999");
        clickButton("Unlock");
        idle(100);
        assertNull(overlay());
        assertEquals(Arrays.asList(AccessibilityService.GLOBAL_ACTION_HOME),
                shadowSvc.getGlobalActionsPerformed());
    }

    @Test public void emptyPassword_staysOnLockScreen() {
        open(GAME);
        clickButton("Unlock");
        idle(100);
        assertEquals(1, kind());
        assertTrue(shadowSvc.getGlobalActionsPerformed().isEmpty());
    }

    @Test public void cancel_goesHome() {
        open(GAME);
        clickButton("Cancel");
        assertNull(overlay());
        assertEquals(Arrays.asList(AccessibilityService.GLOBAL_ACTION_HOME),
                shadowSvc.getGlobalActionsPerformed());
    }

    @Test public void fiveWrongTries_pauseFor30s() {
        for (int i = 0; i < 5; i++) assertFalse(Store.tryPassword(ctx, "0000"));
        assertTrue(Store.lockoutLeftMs() > 0);
        assertFalse("even the right password waits", Store.tryPassword(ctx, "1234"));
        idle(31_000);
        assertTrue(Store.tryPassword(ctx, "1234"));
    }

    @Test public void screenOff_relocksImmediately() {
        Store.unlock(GAME);
        ctx.sendBroadcast(new Intent(Intent.ACTION_SCREEN_OFF));
        idle(10);
        assertEquals(0, Store.remainingMs(GAME));
    }

    @Test public void splitScreen_lockedHalf_isLocked() {
        setWindows(win(NOTES, 2, new Rect(0, 0, W, H / 2)), win(GAME, 1, new Rect(0, H / 2, W, H)));
        event(AccessibilityEvent.TYPE_WINDOWS_CHANGED, null);
        assertEquals(1, kind());
    }

    @Test public void pictureInPicture_smallWindow_isIgnored() {
        setWindows(win(LAUNCHER, 1, full()), win(GAME, 2, new Rect(600, 1800, 1050, 2100)));
        event(AccessibilityEvent.TYPE_WINDOWS_CHANGED, null);
        idle(1000);
        assertNull(overlay());
        assertTrue(shadowSvc.getGlobalActionsPerformed().isEmpty());
    }

    @Test public void ownAppInFront_noLock() {
        open(ME);
        assertNull(overlay());
    }

    // ------------------------------------------------------------ website blocker

    @Test public void blockedSite_inChrome_showsBlockScreen_neverPressesHomeOrBack() {
        openChrome("facebook.com");
        assertEquals(2, kind());
        assertFalse("block screen must not steal focus from the browser", lockFocusable());
        idle(5000);
        assertTrue("no HOME/BACK loops", shadowSvc.getGlobalActionsPerformed().isEmpty());
    }

    @Test public void allFourSites_blocked() {
        for (String url : new String[]{"https://m.facebook.com/home", "instagram.com/reel/1",
                "x.com/someone", "twitter.com", "www.tiktok.com/@a", "vm.tiktok.com/xyz"}) {
            openChrome("google.com");
            assertNull(url, overlay());
            openChrome(url);
            assertEquals(url, 2, kind());
        }
    }

    @Test public void googleSearchMentioningFacebook_isAllowed() {
        openChrome("google.com/search?q=facebook.com");
        assertNull(overlay());
        openChrome("https://www.google.com/search?q=instagram+login");
        assertNull(overlay());
    }

    @Test public void normalSites_allowed() {
        for (String url : new String[]{"google.com", "youtube.com", "box.com", "netflix.com",
                "x.com.eg", "notfacebook.com"}) {
            openChrome(url);
            assertNull(url, overlay());
        }
    }

    @Test public void leavingBlockedSite_removesBlockScreen() {
        openChrome("facebook.com");
        assertEquals(2, kind());
        openChrome("google.com");
        assertNull(overlay());
    }

    @Test public void untickedSite_isAllowed() {
        Store.setSiteBlocked(ctx, "facebook", false);
        openChrome("facebook.com");
        assertNull(overlay());
        openChrome("instagram.com");
        assertEquals(2, kind());
    }

    @Test public void addressBarChange_insideSameWindow_isNoticed() {
        openChrome("google.com");
        assertNull(overlay());
        setWindows(chromeWin("facebook.com"));
        event(AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED, CHROME); // no new window, just typing
        idle(1000);
        assertEquals(2, kind());
    }

    @Test public void contentChangesInOtherApps_areIgnored() {
        setWindows(win(NOTES, 1, full()));
        event(AccessibilityEvent.TYPE_WINDOWS_CHANGED, null);
        idle(1000);
        int before = shadowSvc.getGlobalActionsPerformed().size();
        for (int i = 0; i < 100; i++) event(AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED, NOTES);
        idle(1000);
        assertNull(overlay());
        assertEquals(before, shadowSvc.getGlobalActionsPerformed().size());
    }

    @Test public void blockScreen_goToGoogle_opensGoogleInSameBrowser() {
        openChrome("facebook.com");
        clickButton("Go to Google");
        Intent i = shadowOf((android.app.Application) ctx).getNextStartedActivity();
        assertNotNull(i);
        assertEquals("https://www.google.com", i.getDataString());
        assertEquals(CHROME, i.getPackage());
        assertNull(overlay());
    }

    @Test public void lockedBrowser_withBlockedSite_asksPasswordFirst() {
        Store.setLocked(ctx, CHROME, true);
        openChrome("facebook.com");
        assertEquals(1, kind());
    }

    @Test public void nothingTouchesTheNetwork() {
        // The app has no VPN service and no internet permission at all.
        String manifest = readFile("../AndroidManifest.xml");
        assertFalse(manifest.contains("BIND_VPN_SERVICE"));
        assertFalse(manifest.contains("android.permission.INTERNET"));
    }

    // ------------------------------------------------------------ helpers

    void open(String pkg) {
        setWindows(win(pkg, 1, full()));
        event(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED, pkg);
        idle(600);
    }

    void openChrome(String url) {
        setWindows(chromeWin(url));
        event(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED, CHROME);
        idle(600);
    }

    AccessibilityWindowInfo chromeWin(String url) {
        AccessibilityNodeInfo root = node(CHROME, "android.widget.FrameLayout");
        AccessibilityNodeInfo bar = node(CHROME, "android.widget.EditText");
        bar.setViewIdResourceName(CHROME + ":id/url_bar");
        bar.setText(url);
        bar.setEditable(true);
        shadowOf(root).addChild(bar);
        AccessibilityNodeInfo web = node(CHROME, "android.webkit.WebView");
        AccessibilityNodeInfo pageText = node(CHROME, "android.widget.EditText");
        pageText.setText("facebook.com"); // page content mentions it - must be ignored
        shadowOf(web).addChild(pageText);
        shadowOf(root).addChild(web);
        return winWithRoot(root, 1, full());
    }

    static AccessibilityNodeInfo node(String pkg, String cls) {
        AccessibilityNodeInfo n = AccessibilityNodeInfo.obtain();
        n.setPackageName(pkg);
        n.setClassName(cls);
        return n;
    }

    AccessibilityWindowInfo winWithRoot(AccessibilityNodeInfo root, int layer, Rect bounds) {
        AccessibilityWindowInfo w = AccessibilityWindowInfo.obtain();
        ShadowAccessibilityWindowInfo sw = shadowOf(w);
        sw.setType(AccessibilityWindowInfo.TYPE_APPLICATION);
        sw.setLayer(layer);
        sw.setBoundsInScreen(bounds);
        sw.setRoot(root);
        return w;
    }

    AccessibilityWindowInfo win(String pkg, int layer, Rect bounds) {
        AccessibilityWindowInfo w = AccessibilityWindowInfo.obtain();
        ShadowAccessibilityWindowInfo sw = shadowOf(w);
        sw.setType(AccessibilityWindowInfo.TYPE_APPLICATION);
        sw.setLayer(layer);
        sw.setBoundsInScreen(bounds);
        AccessibilityNodeInfo root = AccessibilityNodeInfo.obtain();
        root.setPackageName(pkg);
        root.setClassName("android.widget.FrameLayout");
        sw.setRoot(root);
        return w;
    }

    Rect full() { return new Rect(0, 0, W, H); }

    void setWindows(AccessibilityWindowInfo... ws) {
        shadowSvc.setWindows(new ArrayList<>(Arrays.asList(ws)));
    }

    void event(int type, String pkg) {
        AccessibilityEvent e = AccessibilityEvent.obtain(type);
        if (pkg != null) e.setPackageName(pkg);
        svc.onAccessibilityEvent(e);
    }

    void idle(long ms) {
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(ms));
    }

    View overlay() { return (View) getField(svc, "overlay"); }

    int kind() {
        assertNotNull("expected an overlay", overlay());
        return (Integer) getField(svc, "overlayKind");
    }

    boolean lockFocusable() {
        WindowManager.LayoutParams lp = (WindowManager.LayoutParams) overlay().getLayoutParams();
        assertEquals(WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, lp.type);
        return (lp.flags & WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE) == 0;
    }

    void type(String s) {
        EditText e = find(overlay(), EditText.class, null);
        assertNotNull(e);
        e.setText(s);
    }

    void clickButton(String label) {
        Button b = find(overlay(), Button.class, label);
        assertNotNull("button " + label, b);
        b.performClick();
    }

    @SuppressWarnings("unchecked")
    static <T extends View> T find(View v, Class<T> cls, String text) {
        if (cls.isInstance(v) && (text == null || text.contentEquals(((android.widget.TextView) v).getText()))) {
            return (T) v;
        }
        if (v instanceof ViewGroup) {
            ViewGroup g = (ViewGroup) v;
            for (int i = 0; i < g.getChildCount(); i++) {
                T t = find(g.getChildAt(i), cls, text);
                if (t != null) return t;
            }
        }
        return null;
    }

    void installApp(String pkg) {
        PackageInfo pi = new PackageInfo();
        pi.packageName = pkg;
        pi.applicationInfo = new ApplicationInfo();
        pi.applicationInfo.packageName = pkg;
        pi.applicationInfo.name = pkg;
        shadowOf(RuntimeEnvironment.getApplication().getPackageManager())
                .installPackage(pi);
    }

    static Object getField(Object o, String name) {
        try {
            Field f = o.getClass().getDeclaredField(name);
            f.setAccessible(true);
            return f.get(o);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    static void setStatic(Class<?> c, String name, Object v) throws Exception {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        f.set(null, v);
    }

    static String readFile(String p) {
        try { return new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(p))); }
        catch (Exception e) { throw new RuntimeException(e); }
    }
}
