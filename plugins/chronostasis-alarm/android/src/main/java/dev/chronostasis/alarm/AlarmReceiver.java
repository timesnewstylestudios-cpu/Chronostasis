package dev.chronostasis.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        int id = intent.getIntExtra("id", 0);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        if (title == null || title.isEmpty()) title = "Chronostasis";
        if (body == null) body = "";
        AlarmScheduler.deliver(context, id, title, body);
    }
}
