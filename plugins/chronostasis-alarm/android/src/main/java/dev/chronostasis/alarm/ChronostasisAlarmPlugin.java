package dev.chronostasis.alarm;

import android.app.Activity;
import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ChronostasisAlarm")
public class ChronostasisAlarmPlugin extends Plugin {
    @Override
    public void load() {
        AlarmScheduler.ensureChannel(getContext());
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        Context context = getContext();
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        JSObject result = new JSObject();
        result.put("supported", true);
        if (manager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
            result.put("scheduled", 0);
            result.put("needsExact", true);
            call.resolve(result);
            return;
        }
        try {
            JSArray alarms = call.getArray("alarms");
            if (alarms == null) alarms = new JSArray();
            int scheduled = AlarmScheduler.replaceAll(context, alarms);
            result.put("scheduled", scheduled);
            result.put("needsExact", false);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        AlarmScheduler.cancelAll(getContext());
        JSObject result = new JSObject();
        result.put("supported", true);
        call.resolve(result);
    }

    @PluginMethod
    public void canExact(PluginCall call) {
        AlarmManager manager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        boolean granted = manager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms();
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            resolveSupported(call, false);
            return;
        }
        Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        launch(intent, call);
    }

    @PluginMethod
    public void openFullScreenSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < 34) {
            resolveSupported(call, false);
            return;
        }
        Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        launch(intent, call);
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        launch(intent, call);
    }

    private void resolveSupported(PluginCall call, boolean supported) {
        JSObject result = new JSObject();
        result.put("supported", supported);
        call.resolve(result);
    }

    private void launch(Intent intent, PluginCall call) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Activity activity = getActivity();
        Runnable open = () -> {
            try {
                if (activity != null) activity.startActivity(intent);
                else getContext().startActivity(intent);
                resolveSupported(call, true);
            } catch (Exception error) {
                call.reject(error.getMessage());
            }
        };
        if (activity != null) activity.runOnUiThread(open);
        else open.run();
    }
}
