package org.xclone.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * CallNotificationReceiver
 *
 * Handles taps on the "Accept" and "Decline" action buttons that appear on
 * the incoming-call heads-up / lock-screen notification. This receiver is
 * called even when the app process is killed.
 *
 * - Accept → launches MainActivity with ACTION_ACCEPT_CALL extras
 * - Decline → dismisses the notification and sends a decline event to MainActivity
 *             (if it happens to be running)
 */
public class CallNotificationReceiver extends BroadcastReceiver {

    private static final String TAG = "NexFiCallReceiver";

    public static final String ACTION_ACCEPT  = "org.xclone.app.ACTION_ACCEPT_CALL";
    public static final String ACTION_DECLINE = "org.xclone.app.ACTION_DECLINE_CALL";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action  = intent.getAction();
        String callId  = intent.getStringExtra("call_id");
        String callerId = intent.getStringExtra("caller_id");
        String callerUsername = intent.getStringExtra("caller_username");
        String media   = intent.getStringExtra("media");
        int    notifId = intent.getIntExtra("notif_id", 9001);

        // Dismiss the incoming-call notification immediately
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(notifId);
        }

        Log.i(TAG, "CallNotificationReceiver.onReceive: action=" + action + " callId=" + callId);

        if (ACTION_ACCEPT.equals(action)) {
            // Launch MainActivity, bringing the app to the foreground with accept extras
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            launchIntent.putExtra("action", "accept_call");
            launchIntent.putExtra("call_id", callId);
            launchIntent.putExtra("caller_id", callerId);
            launchIntent.putExtra("caller_username", callerUsername);
            launchIntent.putExtra("media", media);
            // Deep-link to call screen
            launchIntent.putExtra("deepLink",
                "/?incomingCall=1&callId=" + callId
                + "&media=" + media
                + "&caller=" + callerUsername
                + "&callerId=" + callerId
                + "&autoAccept=1"
            );
            context.startActivity(launchIntent);

        } else if (ACTION_DECLINE.equals(action)) {
            // Send decline action to an already-running MainActivity (if alive)
            // This uses an Intent broadcast that MainActivity listens for locally.
            Intent declineIntent = new Intent(context, MainActivity.class);
            declineIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            declineIntent.putExtra("action", "decline_call");
            declineIntent.putExtra("call_id", callId);
            context.startActivity(declineIntent);
        }
    }
}
