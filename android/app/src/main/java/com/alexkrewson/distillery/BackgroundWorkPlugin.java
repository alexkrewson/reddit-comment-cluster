package com.alexkrewson.distillery;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * begin() when a run starts, end() when it finishes. See WorkService for why.
 * end() posts a "finished" notification only when the app is not on screen --
 * someone watching the result appear does not need to be told it appeared.
 */
@CapacitorPlugin(
    name = "BackgroundWork",
    permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
)
public class BackgroundWorkPlugin extends Plugin {
    private int doneId = 100;

    @PluginMethod
    public void begin(PluginCall call) {
        // Ask for notification permission (Android 13+) on the first run, when
        // the user can see why. A refusal is fine: the service still keeps the
        // run alive, it just cannot announce the finish.
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") == PermissionState.PROMPT) {
            requestPermissionForAlias("notifications", call, "afterPermission");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) { startService(call); }

    private void startService(PluginCall call) {
        try {
            Intent i = new Intent(getContext(), WorkService.class)
                .putExtra(WorkService.EXTRA_LABEL, call.getString("label"));
            ContextCompat.startForegroundService(getContext(), i);
            call.resolve();
        } catch (Exception e) {
            // Starting a foreground service from the background is refused on
            // Android 12+. Not fatal: the run proceeds, just unprotected.
            call.reject("Could not start background service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void end(PluginCall call) {
        getContext().stopService(new Intent(getContext(), WorkService.class));

        boolean onScreen = getActivity() != null
            && getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED);
        boolean allowed = Build.VERSION.SDK_INT < 33
            || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
        String title = call.getString("title");
        JSObject ret = new JSObject();
        ret.put("notified", false);
        if (!onScreen && allowed && title != null) {
            WorkService.ensureChannels(getContext());
            NotificationCompat.Builder b = new NotificationCompat.Builder(getContext(), WorkService.CHANNEL_DONE)
                .setSmallIcon(R.drawable.ic_stat_distillery)
                .setContentTitle(title)
                .setContentText(call.getString("body", ""))
                .setAutoCancel(true)
                .setContentIntent(WorkService.openAppIntent(getContext()));
            NotificationManagerCompat.from(getContext()).notify(doneId++, b.build());
            ret.put("notified", true);
        }
        call.resolve(ret);
    }
}
