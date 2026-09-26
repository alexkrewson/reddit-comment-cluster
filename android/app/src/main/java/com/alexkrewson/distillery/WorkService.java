package com.alexkrewson.distillery;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Keeps the process at foreground priority while an analysis is in flight.
 *
 * Without this, switching apps mid-run lets Android freeze the process (the
 * cached-app freezer, aggressive from Android 14), the WebView's fetch to the
 * Worker stalls, and the run dies. Capacitor itself does NOT pause the WebView's
 * timers (KeepRunning defaults true) -- the OS does the damage.
 *
 * The type is shortService on purpose: it has no FOREGROUND_SERVICE_<TYPE>
 * permission, so it needs no Play Console foreground-service declaration, and
 * an analysis fits inside its ~3 minute budget. If a run ever outlasts it,
 * onTimeout stops the service and the run carries on unprotected -- the same as
 * before this existed, not worse.
 */
public class WorkService extends Service {
    static final String CHANNEL_WORKING = "working";
    static final String CHANNEL_DONE = "done";
    static final String EXTRA_LABEL = "label";
    private static final int ONGOING_ID = 1;

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(
            CHANNEL_WORKING, "Analysis in progress", NotificationManager.IMPORTANCE_LOW));
        nm.createNotificationChannel(new NotificationChannel(
            CHANNEL_DONE, "Analysis finished", NotificationManager.IMPORTANCE_DEFAULT));
    }

    static PendingIntent openAppIntent(Context ctx) {
        Intent open = new Intent(ctx, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ensureChannels(this);
        String label = intent != null ? intent.getStringExtra(EXTRA_LABEL) : null;
        Notification n = new NotificationCompat.Builder(this, CHANNEL_WORKING)
            .setSmallIcon(R.drawable.ic_stat_distillery)
            .setContentTitle("Distillery is working")
            .setContentText(label != null ? label : "Analysis in progress")
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(openAppIntent(this))
            .build();
        int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE : 0;
        ServiceCompat.startForeground(this, ONGOING_ID, n, type);
        return START_NOT_STICKY;
    }

    // Android 14 calls the one-arg form, 15+ the two-arg form. Either way the
    // service must stop within seconds or the system raises an ANR.
    @Override
    public void onTimeout(int startId) { stopSelf(); }

    @Override
    public void onTimeout(int startId, int fgsType) { stopSelf(); }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
