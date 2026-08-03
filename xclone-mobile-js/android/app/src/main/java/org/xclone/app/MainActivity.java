package org.xclone.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.content.Intent;
import android.util.Log;

import android.webkit.SslErrorHandler;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.http.SslError;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "NexFiMain";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Create notification channels for Android 8.0+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            createNotificationChannels();
        }

        // Handle deep-link from FCM notification tap (when app was closed)
        handleFcmDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Handle deep-link when app is already running (singleTask brings it to front)
        handleFcmDeepLink(intent);
    }

    /**
     * When a tray notification is tapped, MyFirebaseMessagingService puts the
     * deep-link path into the Intent extras. We forward it to the Capacitor
     * bridge so Vue Router can navigate to the right page.
     */
    private void handleFcmDeepLink(Intent intent) {
        if (intent == null) return;
        String deepLink = intent.getStringExtra("deepLink");
        if (deepLink != null && !deepLink.isEmpty()) {
            Log.i(TAG, "FCM deep-link received: " + deepLink);
            // Deliver to JS via Capacitor bridge once it's ready
            final String path = deepLink;
            if (this.bridge != null) {
                this.bridge.getWebView().post(() ->
                    this.bridge.getWebView().evaluateJavascript(
                        "window.appRouter && window.appRouter.push('" + path + "');",
                        null
                    )
                );
            }
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        // Ensure WebView accepts SSL certificates (e.g. university / custom SSL chains)
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().setWebViewClient(new com.getcapacitor.BridgeWebViewClient(this.bridge) {
                    @Override
                    public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                        // Trust certificate and proceed
                        handler.proceed();
                    }
                });
            }
        } catch (Exception e) {
            // Ignore if bridge not yet attached
        }
    }

    private void createNotificationChannels() {
        NotificationManager notificationManager = getSystemService(NotificationManager.class);

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .build();

        // ── Notices Channel — IMPORTANCE_MAX = heads-up banner on screen ────
        NotificationChannel noticesChannel = new NotificationChannel(
            "notices",
            "Notice Board Announcements",
            NotificationManager.IMPORTANCE_MAX
        );
        noticesChannel.setDescription("New notices posted to your organisation's notice board");
        noticesChannel.enableVibration(true);
        noticesChannel.setVibrationPattern(new long[]{300, 100, 300, 100, 300});
        noticesChannel.setShowBadge(true);
        noticesChannel.setSound(
            android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
            audioAttributes
        );

        // ── Messages Channel — IMPORTANCE_HIGH ────────────────────────────────
        NotificationChannel messagesChannel = new NotificationChannel(
            "messages",
            "Messages",
            NotificationManager.IMPORTANCE_HIGH
        );
        messagesChannel.setDescription("Direct messages from other users");
        messagesChannel.enableVibration(true);
        messagesChannel.setVibrationPattern(new long[]{200, 100, 200});
        messagesChannel.setShowBadge(true);
        messagesChannel.setSound(
            android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
            audioAttributes
        );

        // ── Calls Channel — IMPORTANCE_MAX = full-screen intent ───────────────
        NotificationChannel callsChannel = new NotificationChannel(
            "calls",
            "Incoming Calls",
            NotificationManager.IMPORTANCE_MAX
        );
        callsChannel.setDescription("Incoming video and voice calls");
        callsChannel.enableVibration(true);
        callsChannel.setVibrationPattern(new long[]{500, 200, 500, 200, 500});
        callsChannel.setShowBadge(true);
        callsChannel.setSound(
            android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
            audioAttributes
        );

        // ── High Priority Channel (legacy / general) ──────────────────────────
        NotificationChannel highPriorityChannel = new NotificationChannel(
            "nexfi_high_priority",
            "Important Notifications",
            NotificationManager.IMPORTANCE_HIGH
        );
        highPriorityChannel.setDescription("Direct messages, mentions, and important alerts");
        highPriorityChannel.enableVibration(true);
        highPriorityChannel.setVibrationPattern(new long[]{300, 100, 300, 100, 300});
        highPriorityChannel.setShowBadge(true);
        highPriorityChannel.setSound(
            android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
            audioAttributes
        );

        // ── Default Channel ───────────────────────────────────────────────────
        NotificationChannel defaultChannel = new NotificationChannel(
            "nexfi_notifications",
            "NexFi Notifications",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        defaultChannel.setDescription("General app notifications");
        defaultChannel.enableVibration(true);
        defaultChannel.setVibrationPattern(new long[]{200, 100, 200});
        defaultChannel.setSound(
            android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
            audioAttributes
        );

        // Register all channels
        notificationManager.createNotificationChannel(noticesChannel);
        notificationManager.createNotificationChannel(messagesChannel);
        notificationManager.createNotificationChannel(callsChannel);
        notificationManager.createNotificationChannel(highPriorityChannel);
        notificationManager.createNotificationChannel(defaultChannel);
    }
}
