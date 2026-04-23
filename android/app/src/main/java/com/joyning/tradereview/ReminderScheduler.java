package com.joyning.tradereview;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;

public final class ReminderScheduler {
    public static final String PREFS_NAME = "trade_discipline_native";

    private static final String CHANNEL_ID = "daily-review";
    private static final String PREF_ACCOUNT_SIZE = "account_size";
    private static final String PREF_NOTIFICATION_REQUESTED = "notification_requested";
    private static final int DEFAULT_ACCOUNT_SIZE = 1000;
    private static final int REMINDER_REQUEST_CODE = 9001;
    private static final int NOTIFICATION_ID = 9002;

    private ReminderScheduler() {
    }

    public static void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.review_channel_name),
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(context.getString(R.string.review_channel_description));
        manager.createNotificationChannel(channel);
    }

    public static void scheduleDailyReminder(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            return;
        }

        PendingIntent pendingIntent = reminderPendingIntent(context);
        alarmManager.cancel(pendingIntent);

        long triggerAtMillis = nextReminderTimeMillis();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
        } else {
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
        }
    }

    public static void showReminderNotification(Context context) {
        if (!canPostNotifications(context)) {
            return;
        }

        ensureNotificationChannel(context);

        int accountSize = getStoredAccountSize(context);
        int positionLimit = Math.round(accountSize * 0.1f);
        int lossLimit = Math.round(positionLimit * 0.1f);
        int lockedProfit = Math.round(positionLimit * 0.15f);

        String body = "单笔 <= " + positionLimit + "u，止损约 " + lossLimit + "u，+30% 卖一半先落袋约 " + lockedProfit + "u，禁止追涨加仓。";

        Intent openAppIntent = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent contentIntent = PendingIntent.getActivity(
                context,
                NOTIFICATION_ID,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(context.getString(R.string.review_notification_title))
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(contentIntent);

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
    }

    public static void markNotificationPermissionRequested(Context context) {
        prefs(context).edit().putBoolean(PREF_NOTIFICATION_REQUESTED, true).apply();
    }

    public static boolean wasNotificationPermissionRequested(Context context) {
        return prefs(context).getBoolean(PREF_NOTIFICATION_REQUESTED, false);
    }

    public static void storeAccountSize(Context context, String rawValue) {
        if (context == null) {
            return;
        }

        int parsed = DEFAULT_ACCOUNT_SIZE;
        try {
            parsed = Math.max(0, Integer.parseInt(rawValue.trim()));
        } catch (Exception ignored) {
            parsed = DEFAULT_ACCOUNT_SIZE;
        }

        prefs(context).edit().putInt(PREF_ACCOUNT_SIZE, parsed).apply();
    }

    public static int getStoredAccountSize(Context context) {
        return prefs(context).getInt(PREF_ACCOUNT_SIZE, DEFAULT_ACCOUNT_SIZE);
    }

    public static String exportMarkdown(Context context, String suggestedName, String content) {
        String safeName = sanitizeFilename(suggestedName);
        String markdown = content == null ? "" : content;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                values.put(MediaStore.Downloads.MIME_TYPE, "text/markdown");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/TradeReview");

                Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    return "导出失败：无法创建文件";
                }

                try (OutputStream outputStream = context.getContentResolver().openOutputStream(uri)) {
                    if (outputStream == null) {
                        return "导出失败：无法写入文件";
                    }
                    outputStream.write(markdown.getBytes(StandardCharsets.UTF_8));
                }

                return "已导出到 下载/TradeReview";
            }

            File externalRoot = context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
            if (externalRoot == null) {
                return "导出失败：应用文档目录不可用";
            }

            File baseDir = new File(externalRoot, "TradeReview");
            if (!baseDir.exists() && !baseDir.mkdirs()) {
                return "导出失败：无法创建目录";
            }

            File file = new File(baseDir, safeName);
            try (FileOutputStream outputStream = new FileOutputStream(file)) {
                outputStream.write(markdown.getBytes(StandardCharsets.UTF_8));
            }

            return "已导出到 应用文档/TradeReview";
        } catch (Exception exception) {
            return "导出失败：" + exception.getMessage();
        }
    }

    private static long nextReminderTimeMillis() {
        Calendar calendar = Calendar.getInstance();
        calendar.set(Calendar.HOUR_OF_DAY, 9);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);

        if (calendar.getTimeInMillis() <= System.currentTimeMillis()) {
            calendar.add(Calendar.DAY_OF_YEAR, 1);
        }

        return calendar.getTimeInMillis();
    }

    private static PendingIntent reminderPendingIntent(Context context) {
        Intent intent = new Intent(context, ReminderReceiver.class);
        return PendingIntent.getBroadcast(
                context,
                REMINDER_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static boolean canPostNotifications(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static String sanitizeFilename(String suggestedName) {
        String fallback = "trade-review.md";
        if (suggestedName == null || suggestedName.trim().isEmpty()) {
            return fallback;
        }

        String normalized = suggestedName
                .trim()
                .replaceAll("[\\\\/:*?\"<>|]", "_")
                .replaceAll("\\s+", "_");

        if (!normalized.endsWith(".md")) {
            normalized = normalized + ".md";
        }

        return normalized.isEmpty() ? fallback : normalized;
    }
}
