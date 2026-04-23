package com.joyning.tradereview;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        ReminderScheduler.showReminderNotification(context);
        ReminderScheduler.scheduleDailyReminder(context);
    }
}
