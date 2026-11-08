package com.simple.applock;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

import android.view.View;
import android.widget.*;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowToast;
import java.util.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33, manifest = Config.NONE, qualifiers = "w1080dp-h2400dp-mdpi")
public class MainActivityTest {
    @Before public void reset() throws Exception {
        Store.clearUnlocks();
        LockServiceTest.setStatic(Store.class, "wrongInARow", 0);
        LockServiceTest.setStatic(Store.class, "lockedOutUntil", 0L);
        LockServiceTest.setStatic(Store.class, "blockedCache", null);
    }

    List<EditText> edits(View v) { List<EditText> l = new ArrayList<>(); collect(v, EditText.class, l); return l; }
    <T extends View> void collect(View v, Class<T> c, List<T> out) {
        if (c.isInstance(v)) out.add(c.cast(v));
        if (v instanceof ListView) { ListView lv = (ListView) v; for (int i = 0; i < lv.getAdapter().getCount(); i++) {
            View child = lv.getAdapter().getView(i, null, lv); if (child != null) collect(child, c, out); } return; }
        if (v instanceof android.view.ViewGroup) { android.view.ViewGroup g = (android.view.ViewGroup) v;
            for (int i = 0; i < g.getChildCount(); i++) collect(g.getChildAt(i), c, out); }
    }
    Button button(View v, String text) { List<Button> l = new ArrayList<>(); collect(v, Button.class, l);
        for (Button b : l) if (b.getText().toString().equals(text)) return b; return null; }
    CheckBox check(View v, String text) { List<CheckBox> l = new ArrayList<>(); collect(v, CheckBox.class, l);
        for (CheckBox b : l) if (b.getText().toString().equals(text)) return b; return null; }
    boolean hasText(View v, String needle) { List<TextView> l = new ArrayList<>(); collect(v, TextView.class, l);
        for (TextView t : l) if (t.getText().toString().contains(needle)) return true; return false; }

    @Test public void firstLaunch_setPassword_thenMainScreen_thenAsksPasswordNextTime() {
        ActivityController<MainActivity> c = Robolectric.buildActivity(MainActivity.class).setup();
        MainActivity a = c.get();
        View v = a.findViewById(android.R.id.content);
        assertTrue(hasText(v, "Welcome"));
        List<EditText> e = edits(v);
        e.get(0).setText("12"); e.get(1).setText("12");
        button(v, "Save password").performClick();
        assertEquals("Use at least 4 characters", ShadowToast.getTextOfLatestToast());
        e.get(0).setText("5555"); e.get(1).setText("5556");
        button(v, "Save password").performClick();
        assertEquals("Passwords do not match", ShadowToast.getTextOfLatestToast());
        e.get(1).setText("5555");
        button(v, "Save password").performClick();
        v = a.findViewById(android.R.id.content);
        assertTrue(hasText(v, "Website blocker"));
        // leave and come back -> password needed
        c.pause().stop().restart().start().resume();
        v = a.findViewById(android.R.id.content);
        assertNotNull(button(v, "Unlock"));
        assertFalse(hasText(v, "Website blocker"));
    }

    @Test public void login_wrongThenRight_andCooldown() {
        Store.setPassword(RuntimeEnvironment.getApplication(), "1234");
        MainActivity a = Robolectric.buildActivity(MainActivity.class).setup().get();
        View v = a.findViewById(android.R.id.content);
        EditText p = edits(v).get(0);
        for (int i = 0; i < 5; i++) { p.setText("0000"); button(v, "Unlock").performClick(); }
        p.setText("1234"); button(v, "Unlock").performClick();
        assertTrue(ShadowToast.getTextOfLatestToast().startsWith("Too many wrong tries"));
        shadowOf(android.os.Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(31));
        p.setText("1234"); button(v, "Unlock").performClick();
        assertTrue(hasText(a.findViewById(android.R.id.content), "Website blocker"));
    }

    @Test public void siteCheckboxes_savePreference() {
        Store.setPassword(RuntimeEnvironment.getApplication(), "1234");
        MainActivity a = Robolectric.buildActivity(MainActivity.class).setup().get();
        View v = a.findViewById(android.R.id.content);
        edits(v).get(0).setText("1234"); button(v, "Unlock").performClick();
        v = a.findViewById(android.R.id.content);
        for (String[] s : Domains.SITES) {
            CheckBox cb = check(v, "Block " + s[1]);
            assertNotNull("checkbox for " + s[1], cb);
            assertTrue("blocked by default: " + s[1], cb.isChecked());
        }
        check(v, "Block Facebook").performClick();
        assertFalse(Store.siteBlocked(a, "facebook"));
        assertFalse(Store.isHostBlocked(a, "facebook.com"));
        assertTrue(Store.isHostBlocked(a, "instagram.com"));
        assertFalse("no VPN / internet wording left", hasText(v, "VPN"));
    }
}
