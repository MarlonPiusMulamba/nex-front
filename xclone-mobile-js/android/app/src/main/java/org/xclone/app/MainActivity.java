package org.xclone.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Create notification channels for Android 8.0+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            createNotificationChannels();
        }
    }
    
    private void createNotificationChannels() {
        NotificationManager notificationManager = getSystemService(NotificationManager.class);
        
        // High Priority Channel (DMs, Mentions) - Heads-up notifications
        NotificationChannel highPriorityChannel = new NotificationChannel(
            "nexfi_high_priority",
            "Important Notifications",
            NotificationManager.IMPORTANCE_HIGH
        );
        highPriorityChannel.setDescription("Direct messages, mentions, and important alerts");
        highPriorityChannel.enableVibration(true);
        highPriorityChannel.setVibrationPattern(new long[]{300, 100, 300, 100, 300});
        highPriorityChannel.setShowBadge(true);
        
        // Use system default notification sound (louder and respects user settings)
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .build();
        highPriorityChannel.setSound(
            android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
            audioAttributes
        );
        
        // Default Channel (General notifications)
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
        
        // Register channels
        notificationManager.createNotificationChannel(highPriorityChannel);
        notificationManager.createNotificationChannel(defaultChannel);
    }
}
