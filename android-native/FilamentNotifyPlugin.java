package com.filamenthub.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

// Meldungen aufs Handy: Berechtigung anfragen (Android 13+), Meldung zeigen, Android-Einstellungen öffnen.
@CapacitorPlugin(
    name = "FilamentNotify",
    permissions = { @Permission(strings = { "android.permission.POST_NOTIFICATIONS" }, alias = "notifications") }
)
public class FilamentNotifyPlugin extends Plugin {
    private static final String CHANNEL = "filamenthub_alerts";

    private boolean enabled() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    private JSObject statusObject() {
        JSObject r = new JSObject();
        r.put("granted", enabled());
        return r;
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusObject());
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (enabled()) {
            call.resolve(statusObject());
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permissionResult");
        } else {
            call.resolve(statusObject());
        }
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        call.resolve(statusObject());
    }

    @PluginMethod
    public void show(PluginCall call) {
        try {
            if (!enabled()) {
                JSObject r = new JSObject();
                r.put("shown", false);
                call.resolve(r);
                return;
            }
            Context ctx = getContext();
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
                    NotificationChannel ch = new NotificationChannel(CHANNEL, "FilamentHub Meldungen", NotificationManager.IMPORTANCE_HIGH);
                    nm.createNotificationChannel(ch);
                }
            }
            String title = call.getString("title", "FilamentHub");
            String body = call.getString("body", "");
            String tag = call.getString("tag", "fh");
            Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
            PendingIntent pi = null;
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                pi = PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            }
            int icon = ctx.getApplicationInfo().icon;
            if (icon == 0) icon = android.R.drawable.ic_dialog_info;
            NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);
            if (pi != null) b.setContentIntent(pi);
            NotificationManagerCompat.from(ctx).notify(tag.hashCode(), b.build());
            JSObject r = new JSObject();
            r.put("shown", true);
            call.resolve(r);
        } catch (SecurityException e) {
            JSObject r = new JSObject();
            r.put("shown", false);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
