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

        // Handle deep-link / call action from FCM notification tap (when app was closed)
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Handle deep-link / call action when app is already running (singleTask brings to front)
        handleIncomingIntent(intent);
    }

    /**
     * Centralized handler for all intents that arrive from FCM notification taps
     * and from CallNotificationReceiver action buttons (Accept / Decline).
     *
     * Priority:
     *  1. call action (accept / decline) — bridged to JS immediately
     *  2. deepLink extra — passed to Vue Router
     */
    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;

        // ── 1. Handle Accept / Decline from notification action buttons ───────
        String action = intent.getStringExtra("action");
        if ("accept_call".equals(action)) {
            String callId         = intent.getStringExtra("call_id");
            String callerId       = intent.getStringExtra("caller_id");
            String callerUsername = intent.getStringExtra("caller_username");
            String media          = intent.getStringExtra("media");
            Log.i(TAG, "📞 Accept call action received: callId=" + callId);

            // Build the deep-link with autoAccept flag so CallOverlay auto-accepts
            String deepLink = "/?incomingCall=1&callId=" + safeStr(callId)
                + "&media=" + safeStr(media)
                + "&caller=" + safeStr(callerUsername)
                + "&callerId=" + safeStr(callerId)
                + "&autoAccept=1";
            deliverDeepLink(deepLink);
            return;
        }

        if ("decline_call".equals(action)) {
            String callId = intent.getStringExtra("call_id");
            Log.i(TAG, "❌ Decline call action received: callId=" + callId);
            // Tell JS to decline (dismiss overlay, signal server)
            deliverJsEvent("nexfi:declineCall", "{\"call_id\":\"" + safeStr(callId) + "\"}");
            return;
        }

        // ── 2. Handle deepLink extra (notice board, incoming call notification tap) ──
        String deepLink = intent.getStringExtra("deepLink");
        if (deepLink != null && !deepLink.isEmpty()) {
            Log.i(TAG, "FCM deep-link received: " + deepLink);
            deliverDeepLink(deepLink);
        }
    }

    /**
     * Navigate the Capacitor WebView to the given path using Vue Router.
     * Safe to call before the bridge is ready — it will be queued.
     */
    private void deliverDeepLink(final String path) {
        if (this.bridge == null) return;
        this.bridge.getWebView().post(() ->
            this.bridge.getWebView().evaluateJavascript(
                "window.appRouter && window.appRouter.push('" + escapeJs(path) + "');",
                null
            )
        );
    }

    /**
     * Dispatch a custom window event to JavaScript.
     * Used by decline_call to tell CallOverlay to hang up.
     */
    private void deliverJsEvent(final String eventName, final String jsonDetail) {
        if (this.bridge == null) return;
        this.bridge.getWebView().post(() ->
            this.bridge.getWebView().evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('" + eventName + "', { detail: " + jsonDetail + " }));",
                null
            )
        );
    }

    private String safeStr(String s) {
        return s != null ? s : "";
    }

    private String escapeJs(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("'", "\\'");
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

        AudioAttributes ringtoneAttr = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .build();

        AudioAttributes notifAttr = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .build();

        // ── Calls Channel — IMPORTANCE_HIGH = full-screen intent + ringtone ──
        NotificationChannel callsChannel = new NotificationChannel(
            "calls",
            "Incoming Calls",
            NotificationManager.IMPORTANCE_HIGH
        );
        callsChannel.setDescription("Incoming video and voice calls");
        callsChannel.enableVibration(true);
        callsChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500, 200, 500});
        callsChannel.setShowBadge(true);
        callsChannel.setSound(
            android.provider.Settings.System.DEFAULT_RINGTONE_URI, ringtoneAttr
        );

        // ── Notices Channel — IMPORTANCE_HIGH = heads-up banner ──────────────
        NotificationChannel noticesChannel = new NotificationChannel(
            "notices",
            "Notice Board Announcements",
            NotificationManager.IMPORTANCE_HIGH
        );
        noticesChannel.setDescription("New notices posted to your organisation's notice board");
        noticesChannel.enableVibration(true);
        noticesChannel.setVibrationPattern(new long[]{300, 100, 300, 100, 300});
        noticesChannel.setShowBadge(true);
        noticesChannel.setSound(
            android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, notifAttr
        );

        // ── Messages Channel ──────────────────────────────────────────────────
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
            android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, notifAttr
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
            android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, notifAttr
        );

        notificationManager.createNotificationChannel(callsChannel);
        notificationManager.createNotificationChannel(noticesChannel);
        notificationManager.createNotificationChannel(messagesChannel);
        notificationManager.createNotificationChannel(defaultChannel);
    }
}
