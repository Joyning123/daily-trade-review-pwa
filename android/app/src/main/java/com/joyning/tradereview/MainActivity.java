package com.joyning.tradereview;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

public final class MainActivity extends AppCompatActivity {
    private static final String HOME_URL = "https://appassets.androidplatform.net/assets/web/index.html";

    private WebView webView;
    private ActivityResultLauncher<String> notificationPermissionLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        notificationPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                isGranted -> {
                    if (isGranted) {
                        ReminderScheduler.scheduleDailyReminder(this);
                        toast(getString(R.string.notification_enabled));
                    } else {
                        toast(getString(R.string.notification_denied));
                    }
                    pushNotificationStateToWeb();
                }
        );

        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.web_view);

        ReminderScheduler.ensureNotificationChannel(this);
        ReminderScheduler.scheduleDailyReminder(this);
        configureWebView();

        if (savedInstanceState == null) {
            webView.loadUrl(HOME_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        pushNotificationStateToWeb();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        boolean isDebuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(isDebuggable);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.addJavascriptInterface(new TradeDisciplineBridge(this), "TradeDisciplineAndroid");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClientCompat() {
            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isInternalUri(uri)) {
                    return false;
                }

                openExternalUri(uri);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                pushNotificationStateToWeb();
            }
        });
    }

    private boolean isInternalUri(Uri uri) {
        return "appassets.androidplatform.net".equals(uri.getHost());
    }

    private void openExternalUri(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            toast(getString(R.string.external_open_failed));
        }
    }

    public String getNotificationPermissionState() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return "granted";
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return "granted";
        }

        return ReminderScheduler.wasNotificationPermissionRequested(this) ? "denied" : "default";
    }

    public String requestNotificationPermissionFromWeb() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            ReminderScheduler.scheduleDailyReminder(this);
            return "granted";
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            ReminderScheduler.scheduleDailyReminder(this);
            return "granted";
        }

        if (ReminderScheduler.wasNotificationPermissionRequested(this)) {
            openNotificationSettings();
            return "settings";
        }

        ReminderScheduler.markNotificationPermissionRequested(this);
        runOnUiThread(() -> notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS));
        return "prompt";
    }

    private void openNotificationSettings() {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
        startActivity(intent);
    }

    private void pushNotificationStateToWeb() {
        if (webView == null) {
            return;
        }

        String script = "window.dispatchEvent(new CustomEvent('trade-discipline-android-permission', { detail: { state: '" +
                escapeForJavascript(getNotificationPermissionState()) +
                "' } }));";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private String escapeForJavascript(String value) {
        return value.replace("\\", "\\\\").replace("'", "\\'");
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }

        super.onBackPressed();
    }
}
