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
        if (!askingVpn) authed = false; // ask for the password again next time
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
        LinearLayout root = column();
        root.setPadding(root.getPaddingLeft(), root.getPaddingTop(), root.getPaddingRight(), 0);

        // Everything above the app list scrolls together with it (list header).
        LinearLayout h = new LinearLayout(this);
        h.setOrientation(LinearLayout.VERTICAL);

        // ---- App lock status ----
        boolean on = serviceEnabled();
        String msg;
        boolean good = false;
        if (!on) {
            msg = "App lock is OFF - tap Accessibility and turn on \"App Lock\".";
        } else if (!LockService.running) {
            msg = "Accessibility is ON but Android is NOT running the service.\n"
                    + "Fix: Accessibility -> App Lock -> turn OFF, then ON again. "
                    + "Also allow App Lock in Battery -> App launch (manage manually).";
        } else {
            good = true;
            String seen = LockService.lastSeenPkg;
            msg = "App lock is ON and running.\nLast app on top: " + (seen == null ? "none yet" : seen);
        }
        TextView status = text(msg, 15);
        status.setTextColor(good ? 0xFF4CAF50 : 0xFFFF5252);
        h.addView(status);

        LinearLayout row = new LinearLayout(this);
        Button acc = new Button(this);
        acc.setText("Accessibility");
        Button pw = new Button(this);
        pw.setText("Change password");
        LinearLayout.LayoutParams half = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        row.addView(acc, half);
        row.addView(pw, half);
        h.addView(row);
        acc.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openAccessibilitySettings(); }
        });
        pw.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { changePassword(); }
        });

        // ---- Website blocker ----
        TextView wb = text("Website blocker", 20);
        wb.setPadding(0, (int) (24 * d), 0, (int) (4 * d));
        h.addView(wb);

        boolean blockerOn = Store.blockerOn(this);
        String bmsg;
        int bcol = 0xFFFF5252;
        if (!blockerOn) {
            bmsg = "OFF";
        } else if (!BlockerVpn.running) {
            bmsg = "Should be ON but the blocker is not running - tap \"Turn blocker ON\" again.";
        } else {
            bmsg = "ON - ticked sites won't open in any browser.";
            bcol = 0xFF4CAF50;
        }
        if (blockerOn && on && !LockService.running) {
            bmsg += "\n(The address-bar check needs the App Lock accessibility service too.)";
        }
        String pdns = strictPrivateDns();
        if (blockerOn && pdns != null) {
            bmsg += "\nNote: Private DNS is set to \"" + pdns + "\". That skips the blocker's DNS "
                    + "filter, so only the browser address-bar check protects you. "
                    + "Set Private DNS to Automatic or Off for full blocking.";
            bcol = 0xFFFFB300;
        }
        TextView bstatus = text(bmsg, 15);
        bstatus.setTextColor(bcol);
        h.addView(bstatus);

        Button toggle = new Button(this);
        toggle.setText(blockerOn ? "Turn blocker OFF" : "Turn blocker ON");
        h.addView(toggle);
        final boolean wasOn = blockerOn && BlockerVpn.running;
        toggle.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (wasOn) {
                    Store.setBlockerOn(MainActivity.this, false);
                    BlockerVpn.stop(MainActivity.this);
                    showMainSoon();
                } else {
                    startBlocker();
                }
            }
        });

        for (final String[] site : Store.SITES) {
            CheckBox cb = new CheckBox(this);
            cb.setText("Block " + site[1]);
            cb.setTextSize(16);
            cb.setChecked(Store.siteBlocked(this, site[0]));
            cb.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
                @Override public void onCheckedChanged(CompoundButton b, boolean checked) {
                    Store.setSiteBlocked(MainActivity.this, site[0], checked);
                }
            });
            h.addView(cb);
        }

        // ---- App list ----
        TextView hdr = text("Tick the apps to lock:", 20);
        hdr.setPadding(0, (int) (24 * d), 0, (int) (8 * d));
        h.addView(hdr);

        ListView list = new ListView(this);
        list.addHeaderView(h, null, false);
        list.setAdapter(new AppAdapter(this, loadApps()));
        root.addView(list, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
    }

    private static final int REQ_VPN = 7;
    private boolean askingVpn = false;

    private void startBlocker() {
        Intent consent = android.net.VpnService.prepare(this);
        if (consent != null) {
            askingVpn = true; // don't ask for our password again after the system dialog
            startActivityForResult(consent, REQ_VPN);
        } else {
            onActivityResult(REQ_VPN, RESULT_OK, null);
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_VPN) return;
        askingVpn = false;
        if (res == RESULT_OK) {
            Store.setBlockerOn(this, true);
            BlockerVpn.start(this);
        } else {
            toast("The blocker needs the VPN permission to work");
        }
        showMainSoon();
    }

    /** Re-draw after the VPN had a moment to start/stop. */
    private void showMainSoon() {
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override public void run() { if (authed) showMain(); }
        }, 700);
    }

    /** Hostname if Private DNS is in "hostname" (strict) mode on the real network, else null. */
    private String strictPrivateDns() {
        try {
            android.net.ConnectivityManager cm = getSystemService(android.net.ConnectivityManager.class);
            for (android.net.Network n : cm.getAllNetworks()) {
                android.net.NetworkCapabilities nc = cm.getNetworkCapabilities(n);
                if (nc == null || nc.hasTransport(android.net.NetworkCapabilities.TRANSPORT_VPN)) continue;
                android.net.LinkProperties lp = cm.getLinkProperties(n);
                if (lp != null && lp.getPrivateDnsServerName() != null) return lp.getPrivateDnsServerName();
            }
        } catch (RuntimeException ignored) {}
        return null;
    }

    // ---------------- actions ----------------

    private void openAccessibilitySettings() {
        // If Settings is locked, let the user straight in since they just unlocked us.
        for (String p : Store.settingsPackages(this)) Store.unlock(p);
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
        String pkg; CharSequence label; Drawable icon;
    }

    private List<App> loadApps() {
        PackageManager pm = getPackageManager();
        Set<String> seen = new HashSet<>();
        List<App> apps = new ArrayList<>();

        Set<String> pkgs = new java.util.LinkedHashSet<>();
        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        for (ResolveInfo ri : pm.queryIntentActivities(launcher, 0)) pkgs.add(ri.activityInfo.packageName);
        // Useful system packages without a launcher icon.
        pkgs.addAll(Store.settingsPackages(this));
        pkgs.addAll(Store.installerPackages(this));

        for (String p : pkgs) {
            if (p.equals(getPackageName()) || !seen.add(p)) continue;
            try {
                App a = new App();
                a.pkg = p;
                a.label = pm.getApplicationLabel(pm.getApplicationInfo(p, 0));
                apps.add(a);
            } catch (PackageManager.NameNotFoundException ignored) {}
        }
        Collections.sort(apps, new Comparator<App>() {
            @Override public int compare(App x, App y) {
                return x.label.toString().compareToIgnoreCase(y.label.toString());
            }
        });
        return apps;
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
            cb.setText(a.label);
            cb.setChecked(locked.contains(a.pkg));
            cb.setEnabled(true);
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
                    if (checked) locked.add(a.pkg); else locked.remove(a.pkg);
                    Store.setLocked(act, a.pkg, checked);
                }
            });
            return cb;
        }
    }
}
