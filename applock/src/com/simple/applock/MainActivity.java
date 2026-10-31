package com.simple.applock;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.CompoundButton;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class MainActivity extends Activity {

    private boolean authed = false;
    private float d;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        d = getResources().getDisplayMetrics().density;
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!Store.hasPassword(this)) showSetup();
        else if (!authed) showLogin();
        else showMain();
    }

    @Override
    protected void onStop() {
        super.onStop();
        authed = false; // ask for the password again next time
    }

    // ---------------- screens ----------------

    private LinearLayout column() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        int p = (int) (24 * d);
        l.setPadding(p, p, p, p);
        return l;
    }

    private EditText passwordField(String hint) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setSingleLine(true);
        e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        return e;
    }

    private TextView text(String s, int sizeSp) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sizeSp);
        t.setPadding(0, 0, 0, (int) (12 * d));
        return t;
    }

    private void showSetup() {
        LinearLayout l = column();
        l.setGravity(Gravity.CENTER_VERTICAL);
        l.addView(text("Welcome to App Lock", 24));
        l.addView(text("Choose a password. It unlocks your locked apps and this app itself.", 16));
        final EditText p1 = passwordField("New password");
        final EditText p2 = passwordField("Repeat password");
        l.addView(p1);
        l.addView(p2);
        Button save = new Button(this);
        save.setText("Save password");
        l.addView(save);
        save.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                String a = p1.getText().toString(), b = p2.getText().toString();
                if (a.length() < 4) { toast("Use at least 4 characters"); return; }
                if (!a.equals(b)) { toast("Passwords do not match"); return; }
                Store.setPassword(MainActivity.this, a);
                authed = true;
                showMain();
            }
        });
        setContentView(l);
    }

    private void showLogin() {
        LinearLayout l = column();
        l.setGravity(Gravity.CENTER_VERTICAL);
        l.addView(text("App Lock", 24));
        final EditText p = passwordField("Password");
        l.addView(p);
        Button ok = new Button(this);
        ok.setText("Unlock");
        l.addView(ok);
        ok.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (Store.checkPassword(MainActivity.this, p.getText().toString())) {
                    authed = true;
                    showMain();
                } else {
                    toast("Wrong password");
                    p.setText("");
                }
            }
        });
        setContentView(l);
    }

    private void showMain() {
        LinearLayout l = column();

        boolean on = serviceEnabled();
        String msg;
        boolean good = false;
        if (!on) {
            msg = "Protection is OFF - tap Accessibility and turn on \"App Lock\".";
        } else if (!LockService.running) {
            msg = "Accessibility is ON but Android is NOT running the service.\n"
                    + "Fix: Accessibility -> App Lock -> turn OFF, then ON again. "
                    + "Also allow App Lock in Battery -> App launch (manage manually).";
        } else {
            good = true;
            String seen = LockService.lastSeenPkg;
            msg = "Protection is ON and running.\nEvents received: " + LockService.eventCount
                    + "\nLast app on top: " + (seen == null ? "none yet" : seen);
        }
        TextView status = text(msg, 15);
        status.setTextColor(good ? 0xFF4CAF50 : 0xFFFF5252);
        l.addView(status);

        LinearLayout row = new LinearLayout(this);
        Button acc = new Button(this);
        acc.setText("Accessibility");
        Button pw = new Button(this);
        pw.setText("Change password");
        LinearLayout.LayoutParams half = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        row.addView(acc, half);
        row.addView(pw, half);
        l.addView(row);
        acc.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openAccessibilitySettings(); }
        });
        pw.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { changePassword(); }
        });

        TextView hdr = text("Tick the apps to lock:", 16);
        hdr.setPadding(0, (int) (16 * d), 0, (int) (8 * d));
        l.addView(hdr);

        ListView list = new ListView(this);
        list.setAdapter(new AppAdapter(this, loadApps()));
        l.addView(list, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(l);
    }

    // ---------------- actions ----------------

    private void openAccessibilitySettings() {
        // Settings is always locked; let the user straight in since they just unlocked us.
        for (String p : Store.alwaysLocked(this)) {
            if (p.contains("settings")) Store.unlock(p);
        }
        Store.unlock("com.android.settings");
        startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
    }

    private void changePassword() {
        LinearLayout l = column();
        final EditText p1 = passwordField("New password");
        final EditText p2 = passwordField("Repeat new password");
        l.addView(p1);
        l.addView(p2);
        new AlertDialog.Builder(this)
                .setTitle("Change password")
                .setView(l)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Save", new DialogInterface.OnClickListener() {
                    @Override public void onClick(DialogInterface dlg, int w) {
                        String a = p1.getText().toString(), b = p2.getText().toString();
                        if (a.length() < 4) toast("Use at least 4 characters - not changed");
                        else if (!a.equals(b)) toast("Passwords do not match - not changed");
                        else { Store.setPassword(MainActivity.this, a); toast("Password changed"); }
                    }
                })
                .show();
    }

    private boolean serviceEnabled() {
        String s = Settings.Secure.getString(getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (s == null) return false;
        ComponentName me = new ComponentName(this, LockService.class);
        TextUtils.SimpleStringSplitter sp = new TextUtils.SimpleStringSplitter(':');
        sp.setString(s);
        for (String part : sp) {
            ComponentName c = ComponentName.unflattenFromString(part);
            if (me.equals(c)) return true;
        }
        return false;
    }

    private void toast(String s) {
        Toast.makeText(this, s, Toast.LENGTH_SHORT).show();
    }

    // ---------------- app list ----------------

    static final class App {
        String pkg; CharSequence label; Drawable icon; boolean forced;
    }

    private List<App> loadApps() {
        PackageManager pm = getPackageManager();
        Set<String> forced = Store.alwaysLocked(this);
        Set<String> seen = new HashSet<>();
        List<App> forcedApps = new ArrayList<>(), apps = new ArrayList<>();

        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        for (ResolveInfo ri : pm.queryIntentActivities(launcher, 0)) {
            String p = ri.activityInfo.packageName;
            if (p.equals(getPackageName()) || !seen.add(p)) continue;
            App a = new App();
            a.pkg = p;
            a.label = ri.activityInfo.applicationInfo.loadLabel(pm);
            a.forced = forced.contains(p);
            (a.forced ? forcedApps : apps).add(a);
        }
        // Always-locked system packages that have no launcher icon (e.g. package installer).
        for (String p : forced) {
            if (!seen.add(p)) continue;
            try {
                App a = new App();
                a.pkg = p;
                a.label = pm.getApplicationLabel(pm.getApplicationInfo(p, 0));
                a.forced = true;
                forcedApps.add(a);
            } catch (PackageManager.NameNotFoundException ignored) {}
        }
        Comparator<App> byName = new Comparator<App>() {
            @Override public int compare(App x, App y) {
                return x.label.toString().compareToIgnoreCase(y.label.toString());
            }
        };
        Collections.sort(forcedApps, byName);
        Collections.sort(apps, byName);
        forcedApps.addAll(apps);
        return forcedApps;
    }

    private static final class AppAdapter extends BaseAdapter {
        private final MainActivity act;
        private final List<App> apps;
        private final Set<String> locked;

        AppAdapter(MainActivity act, List<App> apps) {
            this.act = act;
            this.apps = apps;
            this.locked = Store.lockedUserApps(act);
        }

        @Override public int getCount() { return apps.size(); }
        @Override public Object getItem(int i) { return apps.get(i); }
        @Override public long getItemId(int i) { return i; }

        @Override
        public View getView(int i, View v, ViewGroup parent) {
            CheckBox cb = v instanceof CheckBox ? (CheckBox) v : new CheckBox(act);
            final App a = apps.get(i);
            int pad = (int) (8 * act.d);
            cb.setPadding(pad, pad, pad, pad);
            cb.setOnCheckedChangeListener(null);
            cb.setText(a.forced ? a.label + "  (always locked)" : a.label);
            cb.setChecked(a.forced || locked.contains(a.pkg));
            cb.setEnabled(!a.forced);
            if (a.icon == null) {
                try { a.icon = act.getPackageManager().getApplicationIcon(a.pkg); }
                catch (PackageManager.NameNotFoundException e) { a.icon = null; }
            }
            if (a.icon != null) {
                int s = (int) (36 * act.d);
                a.icon.setBounds(0, 0, s, s);
                cb.setCompoundDrawablePadding(pad);
            }
            cb.setCompoundDrawables(a.icon, null, null, null);
            cb.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
                @Override public void onCheckedChanged(CompoundButton btn, boolean checked) {
                    if (a.forced) return;
                    if (checked) locked.add(a.pkg); else locked.remove(a.pkg);
                    Store.setLocked(act, a.pkg, checked);
                }
            });
            return cb;
        }
    }
}
