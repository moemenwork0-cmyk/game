package com.simple.applock;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
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
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.HashSet;
import java.util.Set;

/**
 * Watches which app comes to the foreground. If it is locked (and not
 * temporarily unlocked) a full-screen password overlay is drawn over it.
 */
public class LockService extends AccessibilityService {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager wm;
    private View overlay;          // currently shown lock screen, or null
    private String overlayPkg;     // app the overlay is covering
    private String foregroundPkg;  // last app seen in the foreground
    private Set<String> appPkgs = new HashSet<>(); // launchable apps + home screens

    @Override
    protected void onServiceConnected() {
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        refreshAppList();
    }

    private void refreshAppList() {
        Set<String> s = new HashSet<>();
        PackageManager pm = getPackageManager();
        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        for (ResolveInfo ri : pm.queryIntentActivities(launcher, 0)) s.add(ri.activityInfo.packageName);
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        for (ResolveInfo ri : pm.queryIntentActivities(home, 0)) s.add(ri.activityInfo.packageName);
        s.remove(getPackageName());
        appPkgs = s;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        if (e.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
        if (e.getPackageName() == null) return;
        String pkg = e.getPackageName().toString();
        if (pkg.equals(getPackageName())) return; // our own lock screen / settings

        if (Store.isLocked(this, pkg)) {
            foregroundPkg = pkg;
            if (Store.remainingMs(pkg) > 0) {
                hideOverlay();
                scheduleRelock(pkg);
            } else {
                showOverlay(pkg);
            }
        } else if (appPkgs.contains(pkg) && !isNoise(pkg)) {
            // A different, unlocked app (or the home screen) is now in front.
            foregroundPkg = pkg;
            hideOverlay();
        }
        // Otherwise: keyboard, status bar, dialogs etc. -> ignore.
    }

    /** Packages whose windows pop up over other apps and should not clear the lock. */
    private boolean isNoise(String pkg) {
        if (pkg.equals("android") || pkg.contains("systemui")) return true;
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        for (android.view.inputmethod.InputMethodInfo i : imm.getEnabledInputMethodList()) {
            if (i.getPackageName().equals(pkg)) return true;
        }
        return false;
    }

    private final Runnable relockCheck = new Runnable() {
        @Override public void run() {
            String p = foregroundPkg;
            if (p != null && Store.isLocked(LockService.this, p) && Store.remainingMs(p) == 0) {
                showOverlay(p);
            }
        }
    };

    /** When the 2 minutes run out while the app is still open, lock it again. */
    private void scheduleRelock(String pkg) {
        handler.removeCallbacks(relockCheck);
        handler.postDelayed(relockCheck, Store.remainingMs(pkg) + 300);
    }

    @Override
    public void onInterrupt() {}

    @Override
    public void onDestroy() {
        hideOverlay();
        super.onDestroy();
    }

    // ---------------- overlay ----------------

    private void showOverlay(final String pkg) {
        if (overlay != null) {
            if (pkg.equals(overlayPkg)) return;
            hideOverlay();
        }
        refreshAppList(); // pick up newly installed apps
        overlayPkg = pkg;

        float d = getResources().getDisplayMetrics().density;
        PackageManager pm = getPackageManager();
        CharSequence label = pkg;
        Drawable icon = null;
        try {
            label = pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0));
            icon = pm.getApplicationIcon(pkg);
        } catch (PackageManager.NameNotFoundException ignored) {}

        // Root that turns the Back key into "go Home".
        FrameLayout root = new FrameLayout(this) {
            @Override public boolean dispatchKeyEvent(KeyEvent ev) {
                if (ev.getKeyCode() == KeyEvent.KEYCODE_BACK) {
                    if (ev.getAction() == KeyEvent.ACTION_UP) goHome();
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
        TextView title = new TextView(this);
        title.setText(label + " is locked");
        title.setTextColor(Color.WHITE);
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, (int) (16 * d), 0, (int) (24 * d));
        box.addView(title);

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
                    Store.unlock(pkg);
                    hideOverlay();
                    scheduleRelock(pkg);
                } else {
                    goHome();
                }
            }
        };
        ok.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { submit.run(); }
        });
        cancel.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { goHome(); }
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
            overlayPkg = null;
            goHome(); // could not cover the app -> do not let it through
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
            overlayPkg = null;
        }
    }

    private void goHome() {
        hideOverlay();
        performGlobalAction(GLOBAL_ACTION_HOME);
    }
}
