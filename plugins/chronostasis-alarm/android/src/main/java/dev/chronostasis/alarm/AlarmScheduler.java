package dev.chronostasis.alarm;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class AlarmScheduler {
    static final String PREFS = "chronostasis_alarms";
    static final String CHANNEL = "chronostasis-alarm";
    private static final String ACTION = "dev.chronostasis.alarm.FIRE";

    private AlarmScheduler() {}

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Wecker", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Weckt, bis du am Ziel bist. Umgeht den lautlosen Modus nicht.");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 350, 150, 350});
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), attrs);
        manager.createNotificationChannel(channel);
    }

    static int replaceAll(Context context, JSONArray alarms) throws JSONException {
        ensureChannel(context);
        cancelAll(context);
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return 0;
        JSONArray stored = new JSONArray();
        int scheduled = 0;
        long now = System.currentTimeMillis();
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject item = alarms.getJSONObject(i);
            int id = item.getInt("id");
            long at = item.getLong("at");
            if (at < now - 5000) continue;
            String title = item.optString("title", "Chronostasis");
            String body = item.optString("body", "");
            scheduleOne(context, manager, id, at, title, body);
            JSONObject copy = new JSONObject();
            copy.put("id", id);
            copy.put("at", at);
            copy.put("title", title);
            copy.put("body", body);
            stored.put(copy);
            scheduled += 1;
        }
        prefs(context).edit().putString("alarms", stored.toString()).apply();
        return scheduled;
    }

    static void restore(Context context) {
        try {
            JSONArray stored = new JSONArray(prefs(context).getString("alarms", "[]"));
            replaceAll(context, stored);
        } catch (JSONException ignored) {
            cancelAll(context);
        }
    }

    static void cancelAll(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        NotificationManager notifications = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        try {
            JSONArray stored = new JSONArray(prefs(context).getString("alarms", "[]"));
            for (int i = 0; i < stored.length(); i++) {
                int id = stored.getJSONObject(i).getInt("id");
                if (manager != null) manager.cancel(broadcast(context, id));
                if (notifications != null) notifications.cancel(id);
            }
        } catch (JSONException ignored) {
            /* drop the stored list below */
        }
        prefs(context).edit().remove("alarms").apply();
    }

    static void deliver(Context context, int id, String title, String body) {
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock lock = null;
        if (power != null) {
            lock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "chronostasis:alarm");
            lock.acquire(15_000L);
        }
        try {
            ensureChannel(context);
            PendingIntent open = launch(context, id);
            int icon = context.getResources().getIdentifier("ic_stat_chronostasis", "drawable", context.getPackageName());
            if (icon == 0) icon = android.R.drawable.ic_lock_idle_alarm;
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(open)
                .setFullScreenIntent(open, true)
                .setWhen(System.currentTimeMillis());
            NotificationManager notifications = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notifications != null) notifications.notify(id, builder.build());
        } finally {
            if (lock != null && lock.isHeld()) lock.release();
        }
    }

    private static void scheduleOne(Context context, AlarmManager manager, int id, long at, String title, String body) {
        Intent fire = new Intent(context, AlarmReceiver.class);
        fire.setAction(ACTION);
        fire.putExtra("id", id);
        fire.putExtra("title", title);
        fire.putExtra("body", body);
        PendingIntent operation = PendingIntent.getBroadcast(context, id, fire, flags());
        manager.setAlarmClock(new AlarmManager.AlarmClockInfo(at, launch(context, id)), operation);
    }

    private static PendingIntent broadcast(Context context, int id) {
        Intent fire = new Intent(context, AlarmReceiver.class);
        fire.setAction(ACTION);
        fire.putExtra("id", id);
        return PendingIntent.getBroadcast(context, id, fire, flags());
    }

    private static PendingIntent launch(Context context, int id) {
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch == null) launch = new Intent();
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launch.putExtra("chronostasisAlarm", id);
        return PendingIntent.getActivity(context, id + 100000, launch, flags());
    }

    private static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
