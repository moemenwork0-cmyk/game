package com.simple.applock;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Website blocker. A local "VPN" that only carries DNS: the phone is told to
 * use 10.111.222.1 as its DNS server, and only that address is routed into
 * this app. Lookups for blocked sites get "does not exist"; everything else
 * is forwarded to the real DNS server. All other traffic never touches us.
 */
public class BlockerVpn extends VpnService {

    static final String ACTION_STOP = "com.simple.applock.STOP_BLOCKER";
    private static final String VPN_DNS = "10.111.222.1";
    private static final String VPN_ADDR = "10.111.222.2";
    private static final String CHANNEL = "blocker";

    static volatile boolean running = false;

    private ParcelFileDescriptor tun;
    private Thread reader;
    private ExecutorService pool;
    private volatile List<InetAddress> upstream = new ArrayList<>();

    static void start(Context c) {
        c.startForegroundService(new Intent(c, BlockerVpn.class));
    }

    static void stop(Context c) {
        c.startService(new Intent(c, BlockerVpn.class).setAction(ACTION_STOP));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(1, notification());
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            shutdown();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (tun == null) {
            try {
                establish();
            } catch (Exception e) {
                shutdown();
                stopSelf();
                return START_NOT_STICKY;
            }
        }
        return START_STICKY;
    }

    private Notification notification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(
                CHANNEL, "Website blocker", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentTitle("Website blocker is on")
                .setContentIntent(open)
                .setOngoing(true)
                .build();
    }

    private void establish() throws Exception {
        upstream = findUpstreamDns();
        upstreamAt = android.os.SystemClock.elapsedRealtime();
        Builder b = new Builder()
                .setSession("App Lock - website blocker")
                .addAddress(VPN_ADDR, 32)
                .addDnsServer(VPN_DNS)
                .addRoute(VPN_DNS, 32)
                .setBlocking(true);
        b.addDisallowedApplication(getPackageName()); // our own forwarding goes direct
        tun = b.establish();
        if (tun == null) throw new IllegalStateException("VPN permission not granted");
        running = true;
        pool = Executors.newFixedThreadPool(4);
        reader = new Thread(new Runnable() {
            @Override public void run() { readLoop(); }
        }, "dns-reader");
        reader.start();
    }

    /** The real network's DNS servers (asked before our VPN comes up), with fallbacks. */
    private List<InetAddress> findUpstreamDns() {
        List<InetAddress> out = new ArrayList<>();
        try {
            ConnectivityManager cm = getSystemService(ConnectivityManager.class);
            for (Network n : cm.getAllNetworks()) {
                android.net.NetworkCapabilities nc = cm.getNetworkCapabilities(n);
                if (nc == null || nc.hasTransport(android.net.NetworkCapabilities.TRANSPORT_VPN)) continue;
                LinkProperties lp = cm.getLinkProperties(n);
                if (lp == null) continue;
                for (InetAddress a : lp.getDnsServers()) {
                    if (!a.getHostAddress().equals(VPN_DNS) && !out.contains(a)) out.add(a);
                }
            }
        } catch (RuntimeException ignored) {}
        try {
            out.add(InetAddress.getByName("1.1.1.1"));
            out.add(InetAddress.getByName("8.8.8.8"));
        } catch (Exception ignored) {}
        return out;
    }

    private void readLoop() {
        FileInputStream in = new FileInputStream(tun.getFileDescriptor());
        final FileOutputStream out = new FileOutputStream(tun.getFileDescriptor());
        byte[] buf = new byte[32767];
        while (running) {
            int len;
            try {
                len = in.read(buf);
            } catch (IOException e) {
                break;
            }
            if (len <= 0) continue;
            final byte[] pkt = java.util.Arrays.copyOf(buf, len);
            try {
                handlePacket(pkt, out);
            } catch (RuntimeException ignored) {
                // malformed packet - drop it
            }
        }
    }

    /** Only IPv4/UDP to port 53 reaches us (that's the only route we add). */
    private void handlePacket(final byte[] p, final FileOutputStream out) {
        if (p.length < 28 || (p[0] >> 4) != 4) return;
        int ihl = (p[0] & 0x0f) * 4;
        if (p[9] != 17 || p.length < ihl + 8) return; // UDP only
        int dstPort = u16(p, ihl + 2);
        if (dstPort != 53) return;
        final int dnsOff = ihl + 8;
        final byte[] query = java.util.Arrays.copyOfRange(p, dnsOff, p.length);
        String host = questionName(query);

        if (host != null && Store.isHostBlocked(this, host)) {
            writeReply(p, ihl, nxdomain(query), out);
            return;
        }
        pool.execute(new Runnable() {
            @Override public void run() {
                byte[] answer = forward(query);
                if (answer != null) writeReply(p, ihl, answer, out);
            }
        });
    }

    private volatile long upstreamAt = 0;

    private byte[] forward(byte[] query) {
        // Wi-Fi <-> mobile data changes the real DNS servers; re-read them now and then.
        long now = android.os.SystemClock.elapsedRealtime();
        if (now - upstreamAt > 15000) {
            upstreamAt = now;
            upstream = findUpstreamDns();
        }
        for (InetAddress server : upstream) {
            DatagramSocket s = null;
            try {
                s = new DatagramSocket();
                protect(s);
                s.setSoTimeout(2500);
                s.send(new DatagramPacket(query, query.length, new InetSocketAddress(server, 53)));
                byte[] buf = new byte[4096];
                DatagramPacket resp = new DatagramPacket(buf, buf.length);
                s.receive(resp);
                return java.util.Arrays.copyOf(buf, resp.getLength());
            } catch (IOException e) {
                // try the next server
            } finally {
                if (s != null) s.close();
            }
        }
        return null;
    }

    // ---------------- DNS helpers ----------------

    /** Name in the first question, e.g. "www.facebook.com". */
    private static String questionName(byte[] q) {
        if (q.length < 12 || u16(q, 4) < 1) return null;
        StringBuilder sb = new StringBuilder();
        int i = 12;
        while (i < q.length) {
            int len = q[i] & 0xff;
            if (len == 0) return sb.toString();
            if ((len & 0xc0) != 0 || i + 1 + len > q.length) return null;
            if (sb.length() > 0) sb.append('.');
            for (int k = 0; k < len; k++) sb.append((char) (q[i + 1 + k] & 0xff));
            i += 1 + len;
        }
        return null;
    }

    /** Reply "no such domain" carrying the original question. */
    private static byte[] nxdomain(byte[] q) {
        int end = 12;
        while (end < q.length && (q[end] & 0xff) != 0) end += 1 + (q[end] & 0xff);
        end = Math.min(end + 1 + 4, q.length); // zero byte + QTYPE + QCLASS
        byte[] r = java.util.Arrays.copyOf(q, end);
        r[2] = (byte) (0x80 | (q[2] & 0x79));  // QR=1, keep opcode + RD
        r[3] = (byte) (0x80 | 3);              // RA=1, RCODE=3 (NXDOMAIN)
        r[4] = 0; r[5] = 1;                    // QDCOUNT=1
        r[6] = r[7] = r[8] = r[9] = r[10] = r[11] = 0;
        return r;
    }

    /** Wrap a DNS answer in IPv4/UDP going back to the asker, and write it to the tunnel. */
    private void writeReply(byte[] req, int ihl, byte[] dns, FileOutputStream out) {
        int total = 20 + 8 + dns.length;
        byte[] r = new byte[total];
        r[0] = 0x45;
        r[2] = (byte) (total >> 8); r[3] = (byte) total;
        r[6] = 0x40;          // don't fragment
        r[8] = 64;            // TTL
        r[9] = 17;            // UDP
        System.arraycopy(req, 16, r, 12, 4); // src = original dst
        System.arraycopy(req, 12, r, 16, 4); // dst = original src
        int cs = checksum(r, 0, 20);
        r[10] = (byte) (cs >> 8); r[11] = (byte) cs;
        // UDP header: ports swapped, checksum 0 (allowed for IPv4)
        r[20] = req[ihl + 2]; r[21] = req[ihl + 3];
        r[22] = req[ihl];     r[23] = req[ihl + 1];
        int ulen = 8 + dns.length;
        r[24] = (byte) (ulen >> 8); r[25] = (byte) ulen;
        System.arraycopy(dns, 0, r, 28, dns.length);
        synchronized (out) {
            try { out.write(r); } catch (IOException ignored) {}
        }
    }

    private static int checksum(byte[] b, int off, int len) {
        long sum = 0;
        for (int i = off; i < off + len; i += 2) sum += ((b[i] & 0xff) << 8) | (b[i + 1] & 0xff);
        while ((sum >> 16) != 0) sum = (sum & 0xffff) + (sum >> 16);
        return (int) (~sum & 0xffff);
    }

    private static int u16(byte[] b, int i) {
        return ((b[i] & 0xff) << 8) | (b[i + 1] & 0xff);
    }

    // ---------------- lifecycle ----------------

    private void shutdown() {
        running = false;
        if (pool != null) pool.shutdownNow();
        pool = null;
        if (tun != null) {
            try { tun.close(); } catch (IOException ignored) {}
        }
        tun = null;
        if (reader != null) reader.interrupt();
        reader = null;
    }

    @Override
    public void onRevoke() {
        shutdown();
        stopSelf();
        super.onRevoke();
    }

    @Override
    public void onDestroy() {
        shutdown();
        super.onDestroy();
    }
}
