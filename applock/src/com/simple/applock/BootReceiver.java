package com.simple.applock;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.VpnService;

/** Turns the website blocker back on after a restart. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        if (Store.blockerOn(c) && VpnService.prepare(c) == null) {
            try { BlockerVpn.start(c); } catch (RuntimeException ignored) {}
        }
    }
}
