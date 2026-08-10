package org.xclone.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * MyFirebaseMessagingService
 *
 * This is the CRITICAL class that makes background push notifications work.
 * When the app is closed or in the background, Android OS delivers FCM messages
 * directly to this service — bypassing the WebView and JavaScript entirely.
 *
 * For INCOMING CALLS specifically, we:
 * 1. Post a IMPORTANCE_MAX notification with setFullScreenIntent() so Android
 *    shows the full-screen call UI on locked/dark screens (like WhatsApp).
 * 2. Add "Accept" and "Decline" action buttons via PendingIntent → CallNotificationReceiver.
 * 3. Set CATEGORY_CALL so the system treats this as a phone call and
 *    bypasses Do Not Disturb if the user has allowed call notifications through.
 *
 * Without this class, FCM messages are silently dropped when the app is not open.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "NexFiFCM";
    private static final String CHANNEL_ID_NOTICES  = "notices";
    private static final String CHANNEL_ID_MESSAGES = "messages";
    private static final String CHANNEL_ID_CALLS    = "calls";

    // Fixed ID for the incoming-call notification so we can cancel it from the receiver
    static final int CALL_NOTIF_ID = 9001;

    // Thread-safe notification ID counter for non-call notifications
    private static final AtomicInteger notificationIdCounter = new AtomicInteger(1000);

    // ─────────────────────────────────────────────────────────────────────────
    // onNewToken — called when the FCM registration token is refreshed.
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.i(TAG, "FCM token refreshed: " + token.substring(0, Math.min(20, token.length())) + "...");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // onMessageReceived — fires in ALL app states: open, background, AND killed.
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.i(TAG, "FCM message received from: " + remoteMessage.getFrom());

        String title = null;
        String body  = null;

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body  = remoteMessage.getNotification().getBody();
        }

        Map<String, String> data = remoteMessage.getData();
        if (data != null && !data.isEmpty()) {
            if (title == null || title.isEmpty()) title = data.get("title");
            if (body  == null || body.isEmpty())  body  = data.get("body");
            Log.d(TAG, "Data payload — title: " + title + ", type: " + data.get("type"));
        }

        if (title == null || title.isEmpty()) title = "NexFi";
        if (body  == null || body.isEmpty())  body  = "You have a new notification";

        String type = (data != null) ? data.getOrDefault("type", "notice") : "notice";

        if ("call".equals(type)) {
            // Show a WhatsApp-style full-screen incoming call notification
            showCallNotification(title, body, data);
        } else {
            String channelId = getChannelForType(type);
            showSystemNotification(title, body, channelId, data);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // showCallNotification — full-screen intent + Accept/Decline buttons
    // ─────────────────────────────────────────────────────────────────────────
    private void showCallNotification(String title, String body, Map<String, String> data) {
        ensureChannelsExist();

        String callId         = (data != null) ? data.getOrDefault("call_id", "")          : "";
        String callerId       = (data != null) ? data.getOrDefault("caller_id", "")        : "";
        String callerUsername = (data != null) ? data.getOrDefault("caller_username", "")  : "";
        String media          = (data != null) ? data.getOrDefault("media", "voice")       : "voice";

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // ── Full-screen Intent (opens app / call screen when phone is locked) ──
        Intent fullScreenIntent = new Intent(this, MainActivity.class);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreenIntent.putExtra("deepLink",
            "/?incomingCall=1&callId=" + callId
            + "&media=" + media
            + "&caller=" + callerUsername
            + "&callerId=" + callerId
        );
        fullScreenIntent.putExtra("call_id", callId);
        fullScreenIntent.putExtra("caller_id", callerId);
        fullScreenIntent.putExtra("caller_username", callerUsername);
        fullScreenIntent.putExtra("media", media);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this, CALL_NOTIF_ID, fullScreenIntent, flags
        );

        // ── ACCEPT action button ──
        Intent acceptIntent = new Intent(CallNotificationReceiver.ACTION_ACCEPT);
        acceptIntent.setClass(this, CallNotificationReceiver.class);
        acceptIntent.putExtra("call_id", callId);
        acceptIntent.putExtra("caller_id", callerId);
        acceptIntent.putExtra("caller_username", callerUsername);
        acceptIntent.putExtra("media", media);
        acceptIntent.putExtra("notif_id", CALL_NOTIF_ID);
        PendingIntent acceptPendingIntent = PendingIntent.getBroadcast(
            this, CALL_NOTIF_ID + 1, acceptIntent, flags
        );

        // ── DECLINE action button ──
        Intent declineIntent = new Intent(CallNotificationReceiver.ACTION_DECLINE);
        declineIntent.setClass(this, CallNotificationReceiver.class);
        declineIntent.putExtra("call_id", callId);
        declineIntent.putExtra("notif_id", CALL_NOTIF_ID);
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
            this, CALL_NOTIF_ID + 2, declineIntent, flags
        );

        int smallIconRes = getSmallIcon();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID_CALLS)
            .setSmallIcon(smallIconRes)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVibrate(new long[]{0, 500, 200, 500, 200, 500, 200, 500})
            .setAutoCancel(true)
            .setOngoing(true)          // Keeps the notification visible until dismissed
            .setTimeoutAfter(60_000)   // Auto-dismiss after 60 s (missed call)
            .setContentIntent(fullScreenPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)  // ← The key for lock-screen!
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            // Accept (green phone icon)
            .addAction(android.R.drawable.ic_menu_call, "✅ Accept", acceptPendingIntent)
            // Decline (red close icon)
            .addAction(android.R.drawable.ic_delete, "❌ Decline", declinePendingIntent);

        NotificationManager manager =
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(CALL_NOTIF_ID, builder.build());
        Log.i(TAG, "📞 Full-screen call notification posted (callId=" + callId + ")");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // showSystemNotification — standard tray notification for non-call types
    // ─────────────────────────────────────────────────────────────────────────
    private void showSystemNotification(String title, String body, String channelId,
                                        Map<String, String> data) {
        ensureChannelsExist();

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                intent.putExtra(entry.getKey(), entry.getValue());
            }
        }

        String orgSlug = (data != null) ? data.getOrDefault("org_slug", "bugema") : "bugema";
        intent.putExtra("deepLink", "/tabs/notices/" + orgSlug);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        int notifId = notificationIdCounter.getAndIncrement();
        if (notifId > 1_999_999) notificationIdCounter.set(1000);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, notifId, intent, flags
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(getSmallIcon())
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI)
            .setVibrate(new long[]{0, 300, 100, 300, 100, 300})
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        NotificationManager manager =
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(notifId, builder.build());
        Log.i(TAG, "System tray notification posted (id=" + notifId + ", channel=" + channelId + ")");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ensureChannelsExist — creates notification channels if not yet registered.
    // Safe to call repeatedly (Android ignores duplicates).
    // ─────────────────────────────────────────────────────────────────────────
    private void ensureChannelsExist() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager =
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

        AudioAttributes audioAttr = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE) // RINGTONE for calls!
            .build();

        // Calls channel — IMPORTANCE_MAX + CATEGORY_CALL = full-screen + DND bypass
        if (manager.getNotificationChannel(CHANNEL_ID_CALLS) == null) {
            NotificationChannel callChannel = new NotificationChannel(
                CHANNEL_ID_CALLS,
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            );
            callChannel.setDescription("Incoming video and voice calls");
            callChannel.enableVibration(true);
            callChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500, 200, 500});
            callChannel.setShowBadge(true);
            callChannel.setSound(
                android.provider.Settings.System.DEFAULT_RINGTONE_URI, audioAttr);
            manager.createNotificationChannel(callChannel);
        }

        AudioAttributes notifAttr = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .build();

        // Notices channel
        if (manager.getNotificationChannel(CHANNEL_ID_NOTICES) == null) {
            NotificationChannel noticesChannel = new NotificationChannel(
                CHANNEL_ID_NOTICES,
                "Notice Board Announcements",
                NotificationManager.IMPORTANCE_HIGH
            );
            noticesChannel.setDescription("New notices posted to your organisation's board");
            noticesChannel.enableVibration(true);
            noticesChannel.setVibrationPattern(new long[]{300, 100, 300, 100, 300});
            noticesChannel.setShowBadge(true);
            noticesChannel.setSound(
                android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, notifAttr);
            manager.createNotificationChannel(noticesChannel);
        }

        // Messages channel
        if (manager.getNotificationChannel(CHANNEL_ID_MESSAGES) == null) {
            NotificationChannel msgChannel = new NotificationChannel(
                CHANNEL_ID_MESSAGES,
                "Messages",
                NotificationManager.IMPORTANCE_HIGH
            );
            msgChannel.setDescription("Direct messages");
            msgChannel.enableVibration(true);
            msgChannel.setVibrationPattern(new long[]{200, 100, 200});
            msgChannel.setShowBadge(true);
            msgChannel.setSound(
                android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, notifAttr);
            manager.createNotificationChannel(msgChannel);
        }
    }

    private int getSmallIcon() {
        try {
            int res = getResources().getIdentifier(
                "ic_stat_icon_config_sample", "drawable", getPackageName());
            if (res == 0) {
                res = getResources().getIdentifier("ic_launcher", "mipmap", getPackageName());
            }
            if (res == 0) {
                res = android.R.drawable.ic_dialog_info;
            }
            return res;
        } catch (Exception e) {
            return android.R.drawable.ic_dialog_info;
        }
    }

    /** Map FCM message type → notification channel ID */
    private String getChannelForType(String type) {
        if (type == null) return CHANNEL_ID_NOTICES;
        switch (type) {
            case "message": return CHANNEL_ID_MESSAGES;
            case "call":
            case "missed_call": return CHANNEL_ID_CALLS;
            default: return CHANNEL_ID_NOTICES;
        }
    }
}
