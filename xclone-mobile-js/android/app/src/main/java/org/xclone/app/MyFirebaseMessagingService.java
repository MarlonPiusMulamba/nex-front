package org.xclone.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
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
 * Without this class, FCM messages are silently dropped when the app is not open.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "NexFiFCM";
    private static final String CHANNEL_ID_NOTICES = "notices";
    private static final String CHANNEL_ID_MESSAGES = "messages";
    private static final String CHANNEL_ID_CALLS = "calls";

    // Thread-safe notification ID counter (avoids collisions on rapid notices)
    private static final AtomicInteger notificationIdCounter = new AtomicInteger(1000);

    // ─────────────────────────────────────────────────────────────────────────
    // onNewToken — called when the FCM registration token is refreshed.
    // We log it here; the JavaScript layer re-registers with the backend on
    // next app open via PushNotifications.addListener('registration', ...).
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.i(TAG, "FCM token refreshed: " + token.substring(0, Math.min(20, token.length())) + "...");
        // Token is re-registered by Capacitor PushNotifications plugin on next app launch.
    }

    // ─────────────────────────────────────────────────────────────────────────
    // onMessageReceived — fires when the app is OPEN or in the BACKGROUND.
    // When the app is CLOSED (killed), FCM with a `notification` payload shows
    // automatically; for data-only payloads this method is needed.
    // We always build the notification manually to guarantee consistent behavior.
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.i(TAG, "FCM message received from: " + remoteMessage.getFrom());

        // Extract notification data
        String title = null;
        String body = null;

        // Priority 1: notification payload (standard FCM)
        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
            Log.d(TAG, "Notification payload — title: " + title + ", body: " + body);
        }

        // Priority 2: data payload (our backend sends this for flexibility)
        Map<String, String> data = remoteMessage.getData();
        if (data != null && !data.isEmpty()) {
            if (title == null) title = data.get("title");
            if (body == null) body = data.get("body");
            Log.d(TAG, "Data payload type: " + data.get("type") + ", org_slug: " + data.get("org_slug"));
        }

        // Fallback defaults
        if (title == null || title.isEmpty()) title = "NexFi Notice Board";
        if (body == null || body.isEmpty()) body = "You have a new notification";

        // Determine channel and notification type
        String type = (data != null) ? data.getOrDefault("type", "notice") : "notice";
        String channelId = getChannelForType(type);

        // Build and show the system tray notification
        showSystemNotification(title, body, channelId, data);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // showSystemNotification — posts a notification to the Android system tray.
    // Tapping it opens MainActivity (the app) and passes the data as extras so
    // the JavaScript router can navigate to the right page.
    // ─────────────────────────────────────────────────────────────────────────
    private void showSystemNotification(String title, String body, String channelId,
                                        Map<String, String> data) {
        // Ensure channel exists (safe to call multiple times)
        ensureChannelsExist();

        // Intent that opens the app when the notification is tapped
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        // Pass FCM data to the app so JS can navigate to the right page
        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                intent.putExtra(entry.getKey(), entry.getValue());
            }
        }

        // Deep-link path for the notice board (e.g. /tabs/notices/bugema)
        String orgSlug = (data != null) ? data.getOrDefault("org_slug", "bugema") : "bugema";
        intent.putExtra("deepLink", "/tabs/notices/" + orgSlug);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                notificationIdCounter.get(),
                intent,
                flags
        );

        // Choose the small icon — use the app's default notification icon
        // (ic_stat_icon_config_sample is the Capacitor default; falls back to app icon)
        int smallIconRes;
        try {
            smallIconRes = getResources().getIdentifier(
                    "ic_stat_icon_config_sample", "drawable", getPackageName());
            if (smallIconRes == 0) {
                smallIconRes = getResources().getIdentifier(
                        "ic_launcher", "mipmap", getPackageName());
            }
            if (smallIconRes == 0) {
                smallIconRes = android.R.drawable.ic_dialog_info;
            }
        } catch (Exception e) {
            smallIconRes = android.R.drawable.ic_dialog_info;
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(smallIconRes)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_EVENT)
                .setDefaults(NotificationCompat.DEFAULT_ALL)   // sound + vibration
                .setAutoCancel(true)                            // dismiss on tap
                .setContentIntent(pendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        NotificationManager manager =
                (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

        int notifId = notificationIdCounter.getAndIncrement();
        // Roll over after 1 million to avoid overflow
        if (notifId > 1_999_999) notificationIdCounter.set(1000);

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
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

        // Notices channel — IMPORTANCE_MAX = instant heads-up banner on screen + sound + vibration
        if (manager.getNotificationChannel(CHANNEL_ID_NOTICES) == null) {
            NotificationChannel noticesChannel = new NotificationChannel(
                    CHANNEL_ID_NOTICES,
                    "Notice Board Announcements",
                    NotificationManager.IMPORTANCE_MAX
            );
            noticesChannel.setDescription("New notices posted to your organisation's board");
            noticesChannel.enableVibration(true);
            noticesChannel.setVibrationPattern(new long[]{300, 100, 300, 100, 300});
            noticesChannel.setShowBadge(true);
            noticesChannel.setSound(
                    android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, audioAttr);
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
            msgChannel.setShowBadge(true);
            msgChannel.setSound(
                    android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, audioAttr);
            manager.createNotificationChannel(msgChannel);
        }

        // Calls channel — max importance
        if (manager.getNotificationChannel(CHANNEL_ID_CALLS) == null) {
            NotificationChannel callChannel = new NotificationChannel(
                    CHANNEL_ID_CALLS,
                    "Incoming Calls",
                    NotificationManager.IMPORTANCE_MAX
            );
            callChannel.setDescription("Incoming video and voice calls");
            callChannel.enableVibration(true);
            callChannel.setVibrationPattern(new long[]{500, 200, 500, 200, 500});
            callChannel.setShowBadge(true);
            callChannel.setSound(
                    android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, audioAttr);
            manager.createNotificationChannel(callChannel);
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
