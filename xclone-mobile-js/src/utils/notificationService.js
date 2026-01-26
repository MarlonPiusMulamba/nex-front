// Notification Service for Web and Mobile Push Notifications
import axios from 'axios';
import config from '../config/index.js';

class NotificationService {
    constructor() {
        this.audio = null;
        this.isInitialized = false;
        this.userId = null;
    }

    async initialize(userId) {
        this.userId = userId;

        // Load notification sound with higher volume
        this.audio = new Audio('/msg-ton.mp3');
        this.audio.volume = 1.0; // Maximum volume
        this.audio.preload = 'auto'; // Preload for faster playback

        // Enable audio on first user interaction (required for mobile browsers)
        const enableAudio = () => {
            if (this.audio) {
                this.audio.play().then(() => {
                    this.audio.pause();
                    this.audio.currentTime = 0;
                    console.log('✓ Audio enabled for notifications');
                }).catch(() => { });
                // Remove listeners after first interaction
                document.removeEventListener('click', enableAudio);
                document.removeEventListener('touchstart', enableAudio);
            }
        };
        document.addEventListener('click', enableAudio, { once: true });
        document.addEventListener('touchstart', enableAudio, { once: true });

        // Check if we're in a browser environment
        const isSecure = typeof window !== 'undefined' && window.isSecureContext;
        console.log('🛡️  Secure Context:', isSecure);
        console.log('📢 Notification Supported:', (typeof window !== 'undefined' && 'Notification' in window));

        if (typeof window !== 'undefined' && 'Notification' in window) {
            await this.requestWebPermission();
            this.registerServiceWorker();
        } else if (typeof window !== 'undefined' && !isSecure) {
            console.warn('⚠️ Notifications disabled because this is not a secure context (HTTPS required)');
        }

        // Initialize mobile push if on a native platform
        const isNative = window.location.protocol === 'capacitor:' ||
            window.location.protocol === 'ionic:' ||
            typeof window.Capacitor !== 'undefined';

        if (isNative) {
            this.initializeMobilePush();
        }

        this.isInitialized = true;
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✓ Service Worker registered:', registration.scope);
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
            }
        }
    }

    async requestWebPermission() {
        try {
            console.log('🔔 Requesting notification permission...');
            console.log('Current permission:', Notification.permission);

            if (Notification.permission === 'granted') {
                console.log('✅ Permission already granted');
                const token = `web_${this.userId}_${Date.now()}`;
                await this.registerToken(token, 'web');
                return;
            }

            const permission = await Notification.requestPermission();
            console.log('🔔 Permission result:', permission);

            if (permission === 'granted') {
                console.log('✅ Permission granted! Registering token...');
                const token = `web_${this.userId}_${Date.now()}`;
                await this.registerToken(token, 'web');

                // Test notification to confirm it works
                console.log('🧪 Sending test notification...');
                this.showWebNotification(
                    'Notifications Enabled!',
                    'You will now receive notifications for DMs, mentions, and more.'
                );
            } else {
                console.warn('⚠️ Notification permission denied');
            }
        } catch (error) {
            console.error('❌ Error requesting notification permission:', error);
        }
    }

    async initializeMobilePush() {
        try {
            // Only load if Capacitor plugins are available
            let PushNotifications;
            let LocalNotifications;
            try {
                const pnModule = await import(/* @vite-ignore */ '@capacitor/push-notifications');
                PushNotifications = pnModule.PushNotifications;
                const lnModule = await import(/* @vite-ignore */ '@capacitor/local-notifications');
                LocalNotifications = lnModule.LocalNotifications;
            } catch (importError) {
                console.log('Push/Local notifications plugins not available');
                return;
            }

            // Request permission
            const permResult = await PushNotifications.requestPermissions();

            if (permResult.receive === 'granted') {
                // Register with FCM/APNs
                await PushNotifications.register();

                // Listen for registration
                PushNotifications.addListener('registration', async (token) => {
                    console.log('Push registration success, token:', token.value);
                    await this.registerToken(token.value, 'mobile');
                });

                // Listen for registration errors
                PushNotifications.addListener('registrationError', (error) => {
                    console.error('Push registration error:', error);
                });

                // Listen for push notifications received
                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    console.log('Push notification received:', notification);
                    this.playSound();

                    // Show a local notification for better visibility in foreground
                    LocalNotifications.schedule({
                        notifications: [{
                            title: notification.title || 'NexFi',
                            body: notification.body || '',
                            id: Date.now(),
                            schedule: { at: new Date(Date.now() + 100) },
                            sound: 'msg-ton.mp3',
                            attachments: notification.largeIcon ? [{ id: 'img', url: notification.largeIcon }] : []
                        }]
                    });
                });

                // Listen for notification taps
                PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                    console.log('Push notification action performed:', notification);
                });
            }
        } catch (error) {
            console.error('Error initializing mobile push:', error);
        }
    }


    async registerToken(token, deviceType) {
        try {
            const apiUrl = config.api?.baseURL || config.baseURL;
            await axios.post(`${apiUrl}/api/notifications/register-token`, {
                user_id: this.userId,
                token: token,
                device_type: deviceType
            });
            console.log(`✓ ${deviceType} notification token registered`);
        } catch (error) {
            console.error('Error registering notification token:', error);
        }
    }

    async removeToken(token) {
        try {
            const apiUrl = config.api?.baseURL || config.baseURL;
            await axios.post(`${apiUrl}/api/notifications/remove-token`, {
                user_id: this.userId,
                token: token
            });
            console.log('✓ Notification token removed');
        } catch (error) {
            console.error('Error removing notification token:', error);
        }
    }

    playSound() {
        if (this.audio) {
            try {
                // Reset and maximize volume
                this.audio.currentTime = 0;
                this.audio.volume = 1.0;

                // Play with promise handling for mobile browsers
                const playPromise = this.audio.play();

                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log('✓ Notification sound played');
                        })
                        .catch(err => {
                            console.warn('Sound play blocked (user interaction required):', err);
                            // On mobile browsers, sound might be blocked until user interaction
                        });
                }

                // Add vibration for mobile devices
                if ('vibrate' in navigator) {
                    navigator.vibrate([200, 100, 200, 100, 200]); // Strong vibration pattern
                }
            } catch (err) {
                console.error('Error playing notification sound:', err);
            }
        }
    }

    getPermissionStatus() {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    }

    async showWebNotification(title, body, icon = '/logo.png') {
        console.log('📢 showWebNotification called:', { title, body });

        if (!('Notification' in window)) {
            console.error('❌ Notifications not supported');
            this.playSound();
            return;
        }

        if (Notification.permission !== 'granted') {
            console.warn('⚠️ Notification permission not granted:', Notification.permission);
            this.playSound();
            return;
        }

        try {
            // Priority: Try using Service Worker registration (more reliable for tray)
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                if (registration) {
                    console.log('✅ Showing notification via Service Worker registration');
                    await registration.showNotification(title, {
                        body: body,
                        icon: icon,
                        badge: icon,
                        vibrate: [300, 100, 300, 100, 300],
                        requireInteraction: true,
                        tag: `nexfi-${Date.now()}`,
                        renotify: true,
                        data: { url: window.location.origin }
                    });
                    this.playSound();
                    return;
                }
            }

            // Fallback: Legacy Notification constructor
            console.log('✅ Showing notification via Legacy Constructor');
            const notification = new Notification(title, {
                body: body,
                icon: icon,
                requireInteraction: true,
                vibrate: [300, 100, 300, 100, 300]
            });
            this.playSound();

            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } catch (err) {
            console.error('❌ Error showing notification:', err);
            this.playSound();
        }
    }

    async showLocalNotification(data) {
        // For web, use Web Notifications API
        // For mobile with Capacitor, this would use Local Notifications (requires package installation)
        this.showWebNotification(data.title || 'New Notification', data.body || '');
    }

    // Simulate receiving a notification (for testing or real-time events via Socket.IO)
    handleIncomingNotification(notification) {
        console.log('📨 Incoming notification received:', notification);
        console.log('Notification service initialized:', this.isInitialized);
        console.log('User ID:', this.userId);

        this.showLocalNotification({
            title: notification.message || 'New Notification',
            body: notification.type || ''
        });
    }
}

export default new NotificationService();
