package com.opencode.mapgen;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.GZIPInputStream;

public class MainActivity extends Activity {
    private static final String START_URL = "file:///android_asset/web/index.html";
    private static final String VERSION = "0.2.11";
    private static final int REQUEST_GEO = 41;
    private static final int REQUEST_STORAGE = 42;

    private WebView web;
    private final ExecutorService networkPool = Executors.newFixedThreadPool(4);
    private final ExecutorService writePool = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private Toast lastToast;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(16, 21, 20));
        getWindow().setNavigationBarColor(Color.rgb(16, 21, 20));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(16, 21, 20));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(16, 21, 20));
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setBlockNetworkLoads(false);
        settings.setBlockNetworkImage(false);
        settings.setLoadsImagesAutomatically(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " 3DmapsAPK/" + VERSION);

        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openIfExternal(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openIfExternal(Uri.parse(url));
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin,
                                                           GeolocationPermissions.Callback callback) {
                if (Build.VERSION.SDK_INT >= 23
                        && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        != PackageManager.PERMISSION_GRANTED) {
                    geoCallback = callback;
                    geoOrigin = origin;
                    requestPermissions(new String[]{
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                    }, REQUEST_GEO);
                } else {
                    callback.invoke(origin, true, false);
                }
            }
        });

        if (Build.VERSION.SDK_INT < 29
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},
                    REQUEST_STORAGE);
        }

        web.loadUrl(START_URL);
    }

    private boolean openIfExternal(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (scheme.equals("file")) {
            return false;
        }
        if (scheme.equals("http") || scheme.equals("https")) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {
            }
            return true;
        }
        if (scheme.equals("mailto") || scheme.equals("tel")) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {
            }
            return true;
        }
        return true;
    }

    private void callJs(String name, String id, boolean ok, int status, String data) {
        if (web == null) return;
        String js = "window.Native&&window.Native." + name + "("
                + JSONObject.quote(id) + ","
                + (ok ? "true" : "false") + ","
                + status + ","
                + JSONObject.quote(data) + ");";
        mainHandler.post(() -> {
            if (web != null) web.evaluateJavascript(js, null);
        });
    }

    private void toast(String text) {
        mainHandler.post(() -> {
            if (lastToast != null) lastToast.cancel();
            lastToast = Toast.makeText(this, text, Toast.LENGTH_LONG);
            lastToast.show();
        });
    }

    private static byte[] readAll(InputStream input) throws IOException {
        if (input == null) return new byte[0];
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = in.read(buffer)) >= 0) {
                if (read > 0) out.write(buffer, 0, read);
            }
            return out.toByteArray();
        }
    }

    private static String snippet(byte[] data) {
        String text = new String(data == null ? new byte[0] : data, StandardCharsets.UTF_8);
        text = text.replaceAll("\\s+", " ").trim();
        return text.length() > 220 ? text.substring(0, 220) + "..." : text;
    }

    private static final class Response {
        final int code;
        final byte[] data;

        Response(int code, byte[] data) {
            this.code = code;
            this.data = data;
        }
    }

    private Response http(String url, String method, String body, String contentType) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        try {
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(120000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("User-Agent",
                    "3Dmaps/" + VERSION + " (Android; offline map generator)");
            connection.setRequestProperty("Accept-Encoding", "gzip");
            connection.setRequestMethod(method == null || method.isEmpty() ? "GET" : method);
            if (body != null && !body.isEmpty()) {
                connection.setDoOutput(true);
                if (contentType != null && !contentType.isEmpty()) {
                    connection.setRequestProperty("Content-Type", contentType);
                }
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(bytes);
                }
            }
            int code = connection.getResponseCode();
            InputStream stream = code >= 400
                    ? connection.getErrorStream() : connection.getInputStream();
            String encoding = connection.getContentEncoding();
            if (stream != null && encoding != null
                    && encoding.toLowerCase(Locale.ROOT).contains("gzip")) {
                stream = new GZIPInputStream(stream);
            }
            byte[] data = readAll(stream);
            if (code < 200 || code >= 300) {
                String text = snippet(data);
                throw new IOException("HTTP " + code + (text.isEmpty() ? "" : ": " + text));
            }
            return new Response(code, data);
        } finally {
            connection.disconnect();
        }
    }

    private static String safePath(String path) {
        String value = path == null ? "file" : path.replace('\\', '/');
        StringBuilder result = new StringBuilder();
        for (String part : value.split("/")) {
            if (part.isEmpty() || part.equals(".") || part.equals("..")) continue;
            if (result.length() > 0) result.append('/');
            result.append(part);
        }
        return result.length() == 0 ? "file" : result.toString();
    }

    private static void writeFile(File base, String directory, String fileName,
                                  byte[] bytes) throws IOException {
        File targetDir = directory.isEmpty() ? new File(base, "3Dmaps")
                : new File(new File(base, "3Dmaps"), directory);
        if (!targetDir.exists() && !targetDir.mkdirs()) {
            throw new IOException("Не удалось создать каталог");
        }
        File target = new File(targetDir, fileName);
        try (FileOutputStream out = new FileOutputStream(target)) {
            out.write(bytes);
        }
    }

    private String saveToDownloads(String path, String mime, byte[] bytes) throws IOException {
        String relative = safePath(path);
        int slash = relative.lastIndexOf('/');
        String directory = slash > 0 ? relative.substring(0, slash) : "";
        String fileName = slash >= 0 ? relative.substring(slash + 1) : relative;
        String type = mime == null || mime.isEmpty() ? "application/octet-stream" : mime;

        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver resolver = getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, type);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + "/3Dmaps/"
                            + (directory.isEmpty() ? "" : directory + "/"));
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("MediaStore не создал файл");
            try {
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new IOException("Не удалось открыть файл");
                    out.write(bytes);
                }
                ContentValues done = new ContentValues();
                done.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, done, null, null);
            } catch (Exception exc) {
                resolver.delete(uri, null, null);
                throw exc;
            }
            return "Download/3Dmaps/" + relative;
        }

        boolean canWritePublic = Build.VERSION.SDK_INT < 23
                || checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED;
        if (canWritePublic) {
            try {
                writeFile(Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS), directory, fileName, bytes);
                return "Download/3Dmaps/" + relative;
            } catch (IOException | SecurityException ignored) {
            }
        }

        File privateBase = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (privateBase == null) privateBase = new File(getFilesDir(), "Download");
        writeFile(privateBase, directory, fileName, bytes);
        return "Android/data/" + getPackageName() + "/files/Download/3Dmaps/" + relative;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQUEST_GEO && geoCallback != null) {
            boolean granted = false;
            for (int result : results) {
                if (result == PackageManager.PERMISSION_GRANTED) granted = true;
            }
            geoCallback.invoke(geoOrigin, granted, false);
            geoCallback = null;
            geoOrigin = null;
        } else if (requestCode == REQUEST_STORAGE) {
            boolean granted = results.length > 0
                    && results[0] == PackageManager.PERMISSION_GRANTED;
            if (!granted) toast("Файлы будут сохраняться в папку приложения");
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("Android");
            web.destroy();
            web = null;
        }
        networkPool.shutdownNow();
        writePool.shutdownNow();
        super.onDestroy();
    }

    private class Bridge {
        @JavascriptInterface
        public String version() {
            return VERSION;
        }

        @JavascriptInterface
        public void fetch(String id, String url, String method, String body,
                          String contentType, boolean binary) {
            networkPool.execute(() -> {
                try {
                    Response response = http(url, method, body, contentType);
                    if (response.code < 200 || response.code >= 300) {
                        callJs("onError", id, false, response.code, "HTTP " + response.code);
                    } else if (binary) {
                        callJs("onBinary", id, true, response.code,
                                Base64.encodeToString(response.data, Base64.NO_WRAP));
                    } else {
                        callJs("onText", id, true, response.code,
                                new String(response.data, StandardCharsets.UTF_8));
                    }
                } catch (Exception exc) {
                    callJs("onError", id, false, 0,
                            exc.getMessage() == null ? exc.toString() : exc.getMessage());
                }
            });
        }

        @JavascriptInterface
        public void saveFile(String path, String mime, String base64) {
            writePool.execute(() -> {
                try {
                    byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                    String saved = saveToDownloads(path, mime, bytes);
                    toast("Сохранено: " + saved);
                } catch (Exception exc) {
                    toast("Ошибка сохранения: " + exc.getMessage());
                }
            });
        }
    }
}
