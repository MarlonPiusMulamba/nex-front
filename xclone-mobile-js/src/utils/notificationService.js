import axios from 'axios';
import config from '../config/index.js';
// We will dynamically import firebaseConfig to avoid build errors if file is missing, 
// but usually it's better to catch it in the method.

const VAPID_PUBLIC_KEY = 'BM4kNY416wmRy8ScGUy04HoAhqv_daS-_atWTLNC0T9GhKJy0SmQxTz8o6zpckex1NW-oSf4I6WWhavRNdZOUNU';

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
            // Check if we have an old legacy token (JSON format) and clear it to force re-registration
            const storedToken = localStorage.getItem('fcm_token');
            if (storedToken && storedToken.trim().startsWith('{')) {
                console.log('🧹 Clearing legacy Web Push token to force FCM upgrade');
                localStorage.removeItem('fcm_token');
                localStorage.removeItem('fcm_token_sent');
            }

            await this.requestWebPermission();
            // This part is crucial for FCM. It needs a service worker to handle messages.
            // The Firebase SDK will automatically register its own 'firebase-messaging-sw.js'
            // or use an existing one if configured correctly.
            // You might not need to call registerServiceWorker() directly here if Firebase handles it.
            // However, if you have custom logic in sw.js that needs to run, keep it.
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

    // Keep this if you have custom service worker logic, otherwise Firebase will manage its own.
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
            const permission = await Notification.requestPermission();
            console.log('🔔 Permission result:', permission);

            if (permission === 'granted') {
                try {
                    // Dynamically import Firebase SDK components
                    const { initializeApp } = await import('firebase/app');
                    const { getMessaging, getToken } = await import('firebase/messaging');

                    // Import your Firebase config
                    const { firebaseConfig } = await import('../config/firebase.js');

                    if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
                        console.warn('⚠️ Firebase Config not set in src/config/firebase.js. PWA notifications may fail.');
                        // If config is not set, we cannot initialize Firebase, so return.
                        return;
                    }

                    // Initialize Firebase App
                    const app = initializeApp(firebaseConfig);
                    const messaging = getMessaging(app);

                    // Get FCM registration token
                    // The VAPID_PUBLIC_KEY is essential here for FCM to work correctly.
                    // It should match the key configured in your Firebase project settings -> Cloud Messaging tab.
                    const currentToken = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY });

                    if (currentToken) {
                        console.log('✅ FCM Registration Token obtained:', currentToken);
                        // Register this FCM token with your backend
                        await this.registerToken(currentToken, 'fcm-web'); // Changed deviceType to 'fcm-web'

                        this.showWebNotification(
                            'Notifications Enabled!',
                            'You will now receive notifications for DMs, calls, and more.'
                        );
                    } else {
                        console.warn('⚠️ No FCM registration token available. Request permission to generate one.');
                    }

                } catch (error) {
                    console.error('❌ Error getting FCM token or initializing Firebase:', error);
                    // Fallback to standard web push if FCM fails, or handle the error appropriately
                    console.log('Falling back to raw Web Push subscription (FCM preferred)');
                    const registration = await navigator.serviceWorker.ready;
                    let subscription = await registration.pushManager.getSubscription();

                    if (!subscription) {
                        console.log('📡 Creating new push subscription via PushManager...');
                        subscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                        });
                    }
                    console.log('✅ Web Push Subscription obtained:', subscription);
                    const subJson = JSON.stringify(subscription);
                    await this.registerToken(subJson, 'web-push');
                }

            } else {
                console.warn('⚠️ Notification permission denied');
            }
        } catch (error) {
            console.error('❌ Error requesting web notification permission:', error);
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async initializeMobilePush() {
        // ... (rest of your initializeMobilePush method remains the same)
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
                // Create Notification Channels (Android)
                await PushNotifications.createChannel({
                    id: 'calls',
                    name: 'Incoming Calls',
                    description: 'Notifications for incoming video and voice calls',
                    importance: 5, // 5 = High (make sound and pop up)
                    visibility: 1, // 1 = Public
                    sound: 'call-ton.mp3', // Using the custom call sound file
                    vibration: true
                });

                await PushNotifications.createChannel({
                    id: 'messages',
                    name: 'Messages',
                    description: 'Notifications for new messages',
                    importance: 4, // 4 = Default (make sound)
                    visibility: 1,
                    sound: 'msg_ton.mp3',
                    vibration: true
                });

                // Register with FCM/APNs
                await PushNotifications.register();

                // Listen for registration
                PushNotifications.addListener('registration', async (token) => {
                    console.log('Push registration success, token:', token.value);
                    await this.registerToken(token.value, 'fcm-mobile'); // Changed deviceType to 'fcm-mobile'
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
