package com.abyssracer.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.res.AssetManager;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/** Hosts the game: a full-screen WebView that serves the bundled web build from the APK assets. */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        web.setBackgroundColor(0xff000000);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.addJavascriptInterface(new Bridge(this), "AbyssNative");
        web.setWebViewClient(new AssetClient(getAssets()));
        setContentView(web);
        hideSystemUi();
        web.loadUrl("https://" + HOST + "/index.html");
    }

    private void hideSystemUi() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.evaluateJavascript("window.dispatchEvent(new Event('nativepause'))", null);
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.evaluateJavascript("window.dispatchEvent(new Event('nativeresume'))", null);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.dispatchEvent(new Event('nativeback'))", null);
    }

    /** Serves https://appassets.androidplatform.net/* from assets/www so ES modules, fetch and WASM work. */
    static class AssetClient extends WebViewClient {
        private static final Map<String, String> MIME = new HashMap<>();
        static {
            MIME.put("html", "text/html"); MIME.put("js", "text/javascript"); MIME.put("mjs", "text/javascript");
            MIME.put("css", "text/css"); MIME.put("json", "application/json"); MIME.put("wasm", "application/wasm");
            MIME.put("png", "image/png"); MIME.put("jpg", "image/jpeg"); MIME.put("jpeg", "image/jpeg");
            MIME.put("webp", "image/webp"); MIME.put("glb", "model/gltf-binary"); MIME.put("bin", "application/octet-stream");
            MIME.put("ogg", "audio/ogg"); MIME.put("mp3", "audio/mpeg"); MIME.put("wav", "audio/wav");
            MIME.put("woff2", "font/woff2"); MIME.put("svg", "image/svg+xml");
        }
        private final AssetManager assets;
        AssetClient(AssetManager a) { assets = a; }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            if (!HOST.equals(req.getUrl().getHost())) return null;
            String path = req.getUrl().getPath();
            if (path == null || path.equals("/")) path = "/index.html";
            String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
            String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
            try {
                InputStream in = assets.open("www" + path);
                WebResourceResponse r = new WebResourceResponse(mime, mime.startsWith("text") ? "utf-8" : null, in);
                Map<String, String> h = new HashMap<>();
                h.put("Access-Control-Allow-Origin", "*");
                h.put("Cache-Control", "no-cache");
                r.setResponseHeaders(h);
                return r;
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
            }
        }
    }

    /** Small native bridge: haptics for crashes and kerbs. */
    static class Bridge {
        private final Vibrator vib;
        Bridge(Context c) { vib = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE); }

        @JavascriptInterface
        public void vibrate(int ms, int amplitude) {
            if (vib == null || !vib.hasVibrator()) return;
            int a = Math.max(1, Math.min(255, amplitude));
            if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createOneShot(Math.max(1, ms), a));
            else vib.vibrate(ms);
        }
    }
}
