package com.joyning.tradereview;

import android.webkit.JavascriptInterface;

public final class TradeDisciplineBridge {
    private final MainActivity activity;

    TradeDisciplineBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean isNativeApp() {
        return true;
    }

    @JavascriptInterface
    public String getNotificationPermissionState() {
        return activity.getNotificationPermissionState();
    }

    @JavascriptInterface
    public String requestNotificationPermission() {
        return activity.requestNotificationPermissionFromWeb();
    }

    @JavascriptInterface
    public void updateAccountSize(String accountSize) {
        ReminderScheduler.storeAccountSize(activity, accountSize);
    }

    @JavascriptInterface
    public String exportMarkdown(String filename, String content) {
        return ReminderScheduler.exportMarkdown(activity, filename, content);
    }
}
