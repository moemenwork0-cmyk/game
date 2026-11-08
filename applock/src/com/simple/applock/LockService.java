package com.simple.applock;

import android.accessibilityservice.AccessibilityService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * App lock + website blocker, both driven by what is on screen.
 *
 * App lock: if any visible app window belongs to a locked app (and it wasn't
 * unlocked in the last 2 minutes) a full-screen password screen covers it.
 *
 * Website blocker: if a browser's address bar shows a blocked site, a "blocked"
 * screen covers the browser and the tab is sent to google.com. Nothing here
 * touches the network.
 */
public class LockService extends AccessibilityService {

    private static final int KIND_LOCK = 1, KIND_BLOCK = 2;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager wm;
    private View overlay;           // the screen we are showing, or null
    private int overlayKind;        // KIND_LOCK or KIND_BLOCK
    private String overlayKey;      // locked package, or "browserPkg|host" for a block
    private long hideCandidateSince; // see requestHide()
    private String lastEventPkg;    // fallback when the window list can't be read

    // ---- shown on App Lock's main screen ----
    static volatile boolean running = false;
    static volatile String lastSeenPkg = null;
    private static final ArrayDeque<String> LOG = new ArrayDeque<>();

    static synchronized void log(String s) {
        String t = new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date());
        LOG.addFirst(t + "  " + s);
        while (LOG.size() > 25) LOG.removeLast();
    }

    static synchronized String logText() {
        StringBuilder sb = new StringBuilder();
        for (String s : LOG) sb.append(s).append('\n');
        return sb.toString();
    }

    private final BroadcastReceiver screenOff = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            Store.clearUnlocks(); // turning the screen off locks everything again
        }
    };

    @Override
    protected void onServiceConnected() {
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        running = true;
        registerReceiver(screenOff, new IntentFilter(Intent.ACTION_SCREEN_OFF));
        log("service started");
    }

    @Override
    public boolean onUnbind(Intent intent) {
        running = false;
        log("service stopped by Android");
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        running = false;
        try { unregisterReceiver(screenOff); } catch (RuntimeException ignored) {}
        removeOverlay();
        super.onDestroy();
    }

    @Override
    public void onInterrupt() {}

    // ---------------- events ----------------

    private boolean checkPending = false;
    private final Runnable check = new Runnable() {
        @Override public void run() { checkPending = false; checkScreen(); }
    };

    /** Run a check soon (at most one queued; never starved by a stream of events). */
    private void checkSoon(long delay) {
        if (checkPending) return;
        checkPending = true;
        handler.postDelayed(check, delay);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        int type = e.getEventType();
        String pkg = e.getPackageName() == null ? null : e.getPackageName().toString();
        if (type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            // Only browsers matter here (address bar changes inside the same window).
            if (pkg != null && isBrowser(pkg)) checkSoon(300);
            return;
        }
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && pkg != null
                && !pkg.equals(getPackageName()) && !isKeyboardOrSystem(pkg)) {
            lastEventPkg = pkg;
        }
        // Window opened/closed/moved: check right away, and again once animations settle.
        checkScreen();
        checkSoon(400);
    }

    // ---------------- the decision ----------------

    private static final class Win {
        String pkg; AccessibilityWindowInfo w; AccessibilityNodeInfo root; long area; int layer;
        boolean guessed; // from the last event, not actually seen in the window list
    }

    private Set<String> keyboards;

    /** Keyboards, status bar, system dialogs: never "the app in front". */
    private boolean isKeyboardOrSystem(String pkg) {
        if (pkg.equals("android") || pkg.contains("systemui")) return true;
        if (keyboards == null) {
            keyboards = new HashSet<>();
            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            for (android.view.inputmethod.InputMethodInfo i : imm.getInputMethodList()) {
                keyboards.add(i.getPackageName());
            }
        }
        return keyboards.contains(pkg);
    }

    /** Look at every app window on screen and decide what to show. */
    private void checkScreen() {
        List<Win> wins = appWindows();
        Win top = null;
        for (Win x : wins) if (top == null || x.layer > top.layer) top = x;
        if (top != null) lastSeenPkg = top.pkg;

        // 1) Any visible locked app?
        long relockIn = Long.MAX_VALUE;
        String toLock = null;
        for (Win x : wins) {
            if (x.pkg.equals(getPackageName()) || !Store.isLocked(this, x.pkg)) continue;
            long left = Store.remainingMs(x.pkg);
            if (left > 0) { relockIn = Math.min(relockIn, left); continue; }
            if (toLock == null || x == top) toLock = x.pkg;
        }
        if (relockIn != Long.MAX_VALUE) {
            handler.removeCallbacks(relock);
            handler.postDelayed(relock, relockIn + 300);
        }
        if (toLock != null) { showLock(toLock); return; }

        // 2) Blocked website in a visible browser?
        if (!Store.blockedDomains(this).isEmpty()) {
            for (Win x : wins) {
                if (x.root == null || !isBrowser(x.pkg)) continue;
                AccessibilityNodeInfo bar = findBlockedAddressBar(x.root, x.pkg);
                if (bar != null) { showBlock(x.pkg, Domains.hostOf(bar.getText()), bar); return; }
            }
        }

        // 3) Nothing to cover. A password screen only goes away when we actually SEE
        //    another app in front - never on a guess.
        if (overlayKind == KIND_LOCK && (top == null || top.guessed)) return;
        requestHide(top == null ? "?" : top.pkg);
    }

    private final Runnable relock = new Runnable() {
        @Override public void run() { checkScreen(); }
    };
    private final Runnable hideCheck = new Runnable() {
        @Override public void run() { checkScreen(); }
    };

    /**
     * Normal app windows on screen that are big enough to matter (ignores
     * picture-in-picture and small floating bubbles). Keyboard, status bar
     * and our own overlay are other window types, so they never show up here.
     */
    private List<Win> appWindows() {
        List<Win> out = new ArrayList<>();
        List<AccessibilityWindowInfo> ws;
        try { ws = getWindows(); } catch (RuntimeException ex) { ws = new ArrayList<>(); }
        Rect screen = wm.getCurrentWindowMetrics().getBounds();
        long screenArea = (long) screen.width() * screen.height();
        Rect r = new Rect();
        for (AccessibilityWindowInfo w : ws) {
            if (w.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) continue;
            w.getBoundsInScreen(r);
            long area = (long) r.width() * r.height();
            if (area * 4 < screenArea) continue; // smaller than 1/4 of the screen
            AccessibilityNodeInfo root = w.getRoot();
            if (root == null || root.getPackageName() == null) continue;
            Win x = new Win();
            x.pkg = root.getPackageName().toString();
            x.w = w; x.root = root; x.area = area; x.layer = w.getLayer();
            out.add(x);
        }
        if (out.isEmpty() && lastEventPkg != null) {
            // Couldn't read the windows (happens briefly during animations): use the last event.
            Win x = new Win();
            x.pkg = lastEventPkg;
            x.guessed = true;
            out.add(x);
        }
        return out;
    }

    /**
     * Hide the overlay - but for the password screen only once a different app
     * has really been on top for a moment, so a stray event during an animation
     * can't make the lock screen vanish under the user's fingers.
     */
    private void requestHide(String whyPkg) {
        if (overlay == null) return;
        if (overlayKind == KIND_BLOCK) { log("unblocked (now " + whyPkg + ")"); removeOverlay(); return; }
        long now = SystemClock.elapsedRealtime();
        if (hideCandidateSince == 0) {
            hideCandidateSince = now;
            handler.postDelayed(hideCheck, 400);
            return;
        }
        if (now - hideCandidateSince >= 350) {
            log("lock screen closed: " + whyPkg + " is now in front");
            removeOverlay();
        }
    }

    // ---------------- browsers ----------------

    private Set<String> browsers = new HashSet<>();
    private long browsersAt = 0;

    private boolean isBrowser(String pkg) {
        long now = SystemClock.elapsedRealtime();
        if (browsersAt == 0 || now - browsersAt > 60000) {
            browsersAt = now;
            Set<String> s = new HashSet<>(Arrays.asList(
                    "com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.chrome.canary",
                    "org.mozilla.firefox", "org.mozilla.firefox_beta", "org.mozilla.focus",
                    "com.sec.android.app.sbrowser", "com.opera.browser", "com.opera.mini.native",
                    "com.opera.gx", "com.microsoft.emmx", "com.brave.browser",
                    "com.duckduckgo.mobile.android", "com.kiwibrowser.browser", "com.vivaldi.browser",
                    "com.UCMobile.intl", "com.uc.browser.en", "com.huawei.browser",
                    "com.hihonor.baidu.browser", "com.hihonor.browser", "com.mi.globalbrowser",
                    "com.yandex.browser", "mark.via.gp", "com.google.android.googlequicksearchbox"));
            Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse("http://example.com"));
            for (ResolveInfo ri : getPackageManager().queryIntentActivities(web, PackageManager.MATCH_ALL)) {
                s.add(ri.activityInfo.packageName);
            }
            s.remove(getPackageName());
            browsers = s;
        }
        return browsers.contains(pkg);
    }

    /** Known address-bar view ids of popular browsers. */
    private static final String[] URL_IDS = {
            "url_bar", "mozac_browser_toolbar_url_view", "mozac_browser_toolbar_edit_url_view",
            "location_bar_edit_text", "url_field", "url", "address_bar", "addressbar",
            "url_edittext", "url_edit_text", "search_fragment_input_view", "omnibox_url",
    };

    /**
     * The browser's address bar if it shows a blocked site, else null. Only the
     * host of the address counts, and page content (WebView) is never read, so
     * a Google search that mentions facebook.com is fine.
     */
    private AccessibilityNodeInfo findBlockedAddressBar(AccessibilityNodeInfo root, String pkg) {
        boolean sawBar = false;
        for (String id : URL_IDS) {
            List<AccessibilityNodeInfo> found;
            try { found = root.findAccessibilityNodeInfosByViewId(pkg + ":id/" + id); }
            catch (RuntimeException ex) { continue; }
            for (AccessibilityNodeInfo n : found) {
                sawBar = true;
                if (Store.isHostBlocked(this, Domains.hostOf(n.getText()))) return n;
            }
        }
        if (sawBar) return null;
        // Unknown browser: look for an address-like field near the top of the tree.
        ArrayDeque<AccessibilityNodeInfo> q = new ArrayDeque<>();
        q.add(root);
        int visited = 0;
        while (!q.isEmpty() && visited++ < 400) {
            AccessibilityNodeInfo n = q.poll();
            if (n == null) continue;
            CharSequence cls = n.getClassName();
            if (cls != null && cls.toString().contains("WebView")) continue; // page content
            String id = n.getViewIdResourceName();
            String lid = id == null ? "" : id.toLowerCase(Locale.US);
            boolean addressLike = (cls != null && cls.toString().contains("EditText"))
                    || lid.contains("url") || lid.contains("address") || lid.contains("location")
                    || lid.contains("omnibox");
            if (addressLike && Store.isHostBlocked(this, Domains.hostOf(n.getText()))) return n;
            for (int i = 0; i < n.getChildCount(); i++) q.add(n.getChild(i));
        }
        return null;
    }

    private long lastRedirectAt = 0;

    /**
     * Send the tab somewhere harmless by typing google.com into the address bar,
     * so the blocked page is gone from the tab (the browser stays usable).
     */
    private void redirectTab(final String pkg, AccessibilityNodeInfo bar) {
        long now = SystemClock.elapsedRealtime();
        if (now - lastRedirectAt < 2500) return;
        lastRedirectAt = now;
        bar.performAction(AccessibilityNodeInfo.ACTION_CLICK); // enter edit mode
        handler.postDelayed(new Runnable() {
            @Override public void run() {
                AccessibilityNodeInfo edit = findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
                if (edit == null || edit.getPackageName() == null
                        || !pkg.equals(edit.getPackageName().toString()) || !edit.isEditable()) return;
                Bundle args = new Bundle();
                args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                        "https://www.google.com");
                edit.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                edit.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.getId());
                log("sent " + pkg + " tab to google.com");
            }
        }, 350);
    }

    // ---------------- screens ----------------

    private void showLock(String pkg) {
        hideCandidateSince = 0;
        if (overlay != null && overlayKind == KIND_LOCK && pkg.equals(overlayKey)) return;
        removeOverlay();
        if (addOverlay(buildLockView(pkg), true)) {
            overlayKind = KIND_LOCK;
            overlayKey = pkg;
            log("locked " + pkg);
        } else {
            log("could not show lock screen over " + pkg + " - going Home");
            performGlobalAction(GLOBAL_ACTION_HOME);
        }
    }

    private void showBlock(String browserPkg, String host, AccessibilityNodeInfo bar) {
        hideCandidateSince = 0;
        String key = browserPkg + "|" + host;
        if (!(overlay != null && overlayKind == KIND_BLOCK && key.equals(overlayKey))) {
            removeOverlay();
            // Not focusable: the browser keeps keyboard focus, so we can still fix its tab.
            if (addOverlay(buildBlockView(browserPkg, host), false)) {
                overlayKind = KIND_BLOCK;
                overlayKey = key;
                log("blocked " + host + " in " + browserPkg);
            }
        }
        redirectTab(browserPkg, bar);
    }

    private boolean addOverlay(View v, boolean focusable) {
        int flags = WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN;
        if (!focusable) flags |= WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, flags, PixelFormat.OPAQUE);
        lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
        lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                wm.addView(v, lp);
                overlay = v;
                return true;
            } catch (RuntimeException ex) {
                log("addView failed: " + ex.getClass().getSimpleName());
            }
        }
        return false;
    }

    private void removeOverlay() {
        hideCandidateSince = 0;
        if (overlay != null) {
            try { wm.removeView(overlay); } catch (RuntimeException ignored) {}
            overlay = null;
            overlayKey = null;
            overlayKind = 0;
        }
    }

    private float dp() { return getResources().getDisplayMetrics().density; }

    private LinearLayout box(FrameLayout root) {
        root.setBackgroundColor(Color.rgb(18, 22, 40));
        root.setClickable(true); // swallow touches so nothing behind can be used
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER_HORIZONTAL);
        int pad = (int) (32 * dp());
        box.setPadding(pad, pad, pad, pad);
        root.addView(box, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
        return box;
    }

    private TextView title(String s) {
        TextView tv = new TextView(this);
        tv.setText(s);
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(22);
        tv.setGravity(Gravity.CENTER);
        tv.setPadding(0, (int) (16 * dp()), 0, (int) (24 * dp()));
        return tv;
    }

    private Button button(LinearLayout box, String text) {
        Button b = new Button(this);
        b.setText(text);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = (int) (8 * dp());
        box.addView(b, lp);
        return b;
    }

    private View buildLockView(final String pkg) {
        PackageManager pm = getPackageManager();
        CharSequence label = pkg;
        Drawable icon = null;
        try {
            label = pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0));
            icon = pm.getApplicationIcon(pkg);
        } catch (PackageManager.NameNotFoundException ignored) {}

        FrameLayout root = new FrameLayout(this) {
            @Override public boolean dispatchKeyEvent(KeyEvent ev) {
                if (ev.getKeyCode() == KeyEvent.KEYCODE_BACK) {
                    if (ev.getAction() == KeyEvent.ACTION_UP) leave("Back pressed");
                    return true;
                }
                return super.dispatchKeyEvent(ev);
            }
        };
        LinearLayout box = box(root);
        if (icon != null) {
            ImageView iv = new ImageView(this);
            iv.setImageDrawable(icon);
            box.addView(iv, new LinearLayout.LayoutParams((int) (72 * dp()), (int) (72 * dp())));
        }
        box.addView(title(label + " is locked"));

        final TextView msg = new TextView(this);
        msg.setTextColor(0xFFFF8A80);
        msg.setGravity(Gravity.CENTER);
        box.addView(msg);

        final EditText pw = new EditText(this);
        pw.setHint("Password");
        pw.setHintTextColor(Color.GRAY);
        pw.setTextColor(Color.WHITE);
        pw.setSingleLine(true);
        pw.setGravity(Gravity.CENTER);
        pw.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        pw.setImeOptions(EditorInfo.IME_ACTION_DONE);
        box.addView(pw, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));

        final Runnable submit = new Runnable() {
            @Override public void run() {
                String text = pw.getText().toString();
                if (text.isEmpty()) return; // nothing typed: just stay
                long wait = Store.lockoutLeftMs();
                if (wait > 0) {
                    msg.setText("Too many wrong tries. Wait " + (wait / 1000 + 1) + " s.");
                    return;
                }
                if (Store.tryPassword(LockService.this, text)) {
                    Store.unlock(pkg);
                    log("unlocked " + pkg + " for 2 min");
                    removeOverlay();
                    handler.postDelayed(relock, Store.UNLOCK_MS + 300);
                } else {
                    leave("wrong password");
                }
            }
        };
        button(box, "Unlock").setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { submit.run(); }
        });
        button(box, "Cancel").setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { leave("Cancel"); }
        });
        pw.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override public boolean onEditorAction(TextView v, int id, KeyEvent ev) {
                boolean enterUp = ev != null && ev.getKeyCode() == KeyEvent.KEYCODE_ENTER
                        && ev.getAction() == KeyEvent.ACTION_UP;
                if (id == EditorInfo.IME_ACTION_DONE || enterUp) submit.run();
                return true;
            }
        });

        pw.requestFocus();
        handler.postDelayed(new Runnable() {
            @Override public void run() {
                if (!pw.isAttachedToWindow()) return;
                InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
                imm.showSoftInput(pw, InputMethodManager.SHOW_IMPLICIT);
            }
        }, 300);
        return root;
    }

    private View buildBlockView(final String browserPkg, String host) {
        FrameLayout root = new FrameLayout(this);
        LinearLayout box = box(root);
        box.addView(title(host + " is blocked"));
        TextView sub = new TextView(this);
        sub.setText("This site is blocked by App Lock.");
        sub.setTextColor(Color.LTGRAY);
        sub.setGravity(Gravity.CENTER);
        box.addView(sub);
        button(box, "Go to Google").setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                removeOverlay();
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com"))
                        .setPackage(browserPkg)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        .putExtra("com.android.browser.application_id", browserPkg);
                try { startActivity(i); } catch (RuntimeException ex) { performGlobalAction(GLOBAL_ACTION_HOME); }
            }
        });
        button(box, "Home").setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                removeOverlay();
                performGlobalAction(GLOBAL_ACTION_HOME);
            }
        });
        return root;
    }

    /** Wrong password / Cancel / Back on the lock screen: go to the Home screen. */
    private void leave(String why) {
        log("lock screen: " + why + " -> Home");
        removeOverlay();
        performGlobalAction(GLOBAL_ACTION_HOME);
    }
}
