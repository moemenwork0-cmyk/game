package com.simple.applock;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.os.Handler;
import android.os.Looper;
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

import java.util.ArrayDeque;
import java.util.List;

/**
 * Watches which app is on top. If it is locked (and not temporarily unlocked)
 * a full-screen password overlay is drawn over it. Optionally also locks just
 * the "Private DNS" screen inside Settings.
 */
public class LockService extends AccessibilityService {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager wm;
    private View overlay;          // currently shown lock screen, or null
    private String overlayKey;     // what the overlay is locking (package or Store.DNS_KEY)
    private String lastEventPkg;   // fallback if the window list is unavailable

    // ---- status shown on App Lock's main screen ----
    static volatile boolean running = false;
    static volatile int eventCount = 0;
    static volatile String lastSeenPkg = null;

    @Override
    protected void onServiceConnected() {
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        running = true;
    }

    @Override
    public boolean onUnbind(Intent intent) {
        running = false;
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        running = false;
        hideOverlay();
        super.onDestroy();
    }

    @Override
    public void onInterrupt() {}

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        eventCount++;
        int type = e.getEventType();
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && e.getPackageName() != null) {
            lastEventPkg = e.getPackageName().toString();
        }
        handler.removeCallbacks(evaluate);
        if (type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            // Very frequent: just check once things calm down.
            handler.postDelayed(evaluate, 250);
        } else {
            // Window changes arrive in bursts during animations. Check now and
            // once more after things settle, so a late event can't fool us.
            checkForeground();
            handler.postDelayed(evaluate, 500);
        }
    }

    private final Runnable evaluate = new Runnable() {
        @Override public void run() { checkForeground(); }
    };
    private final Runnable relock = new Runnable() {
        @Override public void run() { checkForeground(); }
    };

    /** Look at what is really on screen and lock / unlock accordingly. */
    private void checkForeground() {
        AccessibilityWindowInfo top = topAppWindow();
        String pkg = null;
        if (top != null) {
            AccessibilityNodeInfo r = top.getRoot();
            if (r != null && r.getPackageName() != null) pkg = r.getPackageName().toString();
        }
        if (pkg == null) pkg = lastEventPkg;
        if (pkg == null) return;
        lastSeenPkg = pkg;

        if (pkg.equals(getPackageName())) { hideOverlay(); return; }

        // 1) Whole app locked?
        if (Store.isLocked(this, pkg)) {
            long left = Store.remainingMs(pkg);
            if (left == 0) { showOverlay(pkg, pkg, null); return; }
            scheduleRelock(left);
        }

        // 2) Private DNS screen inside Settings?
        if (Store.dnsLockOn(this) && Store.settingsPackages(this).contains(pkg)
                && privateDnsVisible(pkg)) {
            long left = Store.remainingMs(Store.DNS_KEY);
            if (left == 0) { showOverlay(Store.DNS_KEY, pkg, "Private DNS is locked"); return; }
            scheduleRelock(left);
        }

        hideOverlay(); // nothing locked is in front
    }

    private void scheduleRelock(long ms) {
        handler.removeCallbacks(relock);
        handler.postDelayed(relock, ms + 300);
    }

    /** Top-most normal app window. Keyboard, status bar and our overlay are other types. */
    private AccessibilityWindowInfo topAppWindow() {
        List<AccessibilityWindowInfo> ws;
        try { ws = getWindows(); } catch (RuntimeException ex) { return null; }
        AccessibilityWindowInfo best = null;
        for (AccessibilityWindowInfo w : ws) {
            if (w.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) continue;
            if (best == null || w.getLayer() > best.getLayer()) best = w;
        }
        return best;
    }

    /** True if any window of the Settings app currently shows the Private DNS options. */
    private boolean privateDnsVisible(String pkg) {
        List<AccessibilityWindowInfo> ws;
        try { ws = getWindows(); } catch (RuntimeException ex) { return false; }
        for (AccessibilityWindowInfo w : ws) {
            if (w.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) continue;
            AccessibilityNodeInfo root = w.getRoot();
            if (root == null || root.getPackageName() == null
                    || !pkg.equals(root.getPackageName().toString())) continue;
            if (treeHasPrivateDns(root)) return true;
        }
        return false;
    }

    private static boolean treeHasPrivateDns(AccessibilityNodeInfo root) {
        ArrayDeque<AccessibilityNodeInfo> q = new ArrayDeque<>();
        q.add(root);
        int visited = 0;
        while (!q.isEmpty() && visited++ < 3000) {
            AccessibilityNodeInfo n = q.poll();
            if (n == null) continue;
            String id = n.getViewIdResourceName();
            if (id != null && id.toLowerCase().contains("private_dns")) return true;
            if (isDnsHostnameText(n.getText()) || isDnsHostnameText(n.getHintText())) return true;
            for (int i = 0; i < n.getChildCount(); i++) q.add(n.getChild(i));
        }
        return false;
    }

    /** "Private DNS provider hostname" and similar labels (English / Arabic). */
    private static boolean isDnsHostnameText(CharSequence cs) {
        if (cs == null) return false;
        String t = cs.toString().toLowerCase();
        if (!t.contains("dns")) return false;
        return t.contains("hostname") || t.contains("host name") || t.contains("provider")
                || t.contains("مضيف") || t.contains("موفر") || t.contains("مزود") || t.contains("مزوّد");
    }

    // ---------------- overlay ----------------

    /**
     * @param key     what gets unlocked by the right password (package or DNS_KEY)
     * @param iconPkg app whose icon/name is shown
     * @param title   custom title, or null for "<app> is locked"
     */
    private void showOverlay(final String key, String iconPkg, String title) {
        if (overlay != null) {
            if (key.equals(overlayKey)) return;
            hideOverlay();
        }
        overlayKey = key;

        float d = getResources().getDisplayMetrics().density;
        PackageManager pm = getPackageManager();
        CharSequence label = iconPkg;
        Drawable icon = null;
        try {
            label = pm.getApplicationLabel(pm.getApplicationInfo(iconPkg, 0));
            icon = pm.getApplicationIcon(iconPkg);
        } catch (PackageManager.NameNotFoundException ignored) {}

        final boolean dns = Store.DNS_KEY.equals(key);

        // Root that turns the Back key into "leave".
        FrameLayout root = new FrameLayout(this) {
            @Override public boolean dispatchKeyEvent(KeyEvent ev) {
                if (ev.getKeyCode() == KeyEvent.KEYCODE_BACK) {
                    if (ev.getAction() == KeyEvent.ACTION_UP) leave(dns);
                    return true;
                }
                return super.dispatchKeyEvent(ev);
            }
        };
        root.setBackgroundColor(Color.rgb(18, 22, 40));
        root.setClickable(true);

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER_HORIZONTAL);
        int pad = (int) (32 * d);
        box.setPadding(pad, pad, pad, pad);

        if (icon != null) {
            ImageView iv = new ImageView(this);
            iv.setImageDrawable(icon);
            box.addView(iv, new LinearLayout.LayoutParams((int) (72 * d), (int) (72 * d)));
        }
        TextView tv = new TextView(this);
        tv.setText(title != null ? title : label + " is locked");
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(22);
        tv.setGravity(Gravity.CENTER);
        tv.setPadding(0, (int) (16 * d), 0, (int) (24 * d));
        box.addView(tv);

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

        Button ok = new Button(this);
        ok.setText("Unlock");
        LinearLayout.LayoutParams okLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        okLp.topMargin = (int) (16 * d);
        box.addView(ok, okLp);

        Button cancel = new Button(this);
        cancel.setText("Cancel");
        box.addView(cancel, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        final Runnable submit = new Runnable() {
            @Override public void run() {
                if (Store.checkPassword(LockService.this, pw.getText().toString())) {
                    Store.unlock(key);
                    hideOverlay();
                    scheduleRelock(Store.remainingMs(key));
                } else {
                    leave(dns);
                }
            }
        };
        ok.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { submit.run(); }
        });
        cancel.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { leave(dns); }
        });
        pw.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override public boolean onEditorAction(TextView v, int id, KeyEvent ev) {
                submit.run();
                return true;
            }
        });

        root.addView(box, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER));

        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.OPAQUE);
        lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                | WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE;
        lp.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;

        try {
            wm.addView(root, lp);
            overlay = root;
        } catch (RuntimeException ex) {
            overlay = null;
            overlayKey = null;
            leave(dns); // could not cover it -> do not let it through
            return;
        }

        pw.requestFocus();
        handler.postDelayed(new Runnable() {
            @Override public void run() {
                InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
                imm.showSoftInput(pw, InputMethodManager.SHOW_IMPLICIT);
            }
        }, 250);
    }

    private void hideOverlay() {
        if (overlay != null) {
            try { wm.removeView(overlay); } catch (RuntimeException ignored) {}
            overlay = null;
            overlayKey = null;
        }
    }

    /**
     * Wrong password / cancel / back. For the Private DNS lock, first press Back
     * to close the DNS dialog so it isn't waiting there next time, then go Home.
     */
    private void leave(boolean closeDnsFirst) {
        hideOverlay();
        if (closeDnsFirst) {
            performGlobalAction(GLOBAL_ACTION_BACK);
            handler.postDelayed(new Runnable() {
                @Override public void run() { performGlobalAction(GLOBAL_ACTION_HOME); }
            }, 200);
        } else {
            performGlobalAction(GLOBAL_ACTION_HOME);
        }
    }
}
