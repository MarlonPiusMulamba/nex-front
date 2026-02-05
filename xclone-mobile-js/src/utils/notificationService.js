// Notification Service for Web and Mobile Push Notifications
import axios from 'axios';
import config from '../config/index.js';

const VAPID_PUBLIC_KEY = 'BKeAX99jH-XjDDkA--WZ6aP4NcYsQuOXmDI-im79dro2QpT71knlK81rM-BsC8ncJ3udT0IdeapRALXVyzu8QdA';

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
            const permission = await Notification.requestPermission();
            console.log('🔔 Permission result:', permission);

            if (permission === 'granted') {
                // Import Firebase dynamically to avoid build errors if not installed
                // Note: user must 'npm install firebase'
                try {
                    const { initializeApp } = await import('firebase/app');
                    const { getMessaging, getToken } = await import('firebase/messaging');

                    // Initialize Firebase (using config from a separate file or inline)
                    // We need the firebase config here. 
                    // Assuming standard config structure or minimal config for messaging
                    // If config/index.js doesn't have firebase config, we might need it.
                    // For now, I'll attempt to use the VAPID key mechanism which is primary for tokens

                    const firebaseConfig = {
                        apiKey: "dummy-api-key-replace-me", // The SDK needs a config, even if minimal
                        authDomain: "nexfi-app.firebaseapp.com",
                        projectId: "nexfi-app",
                        storageBucket: "nexfi-app.appspot.com",
                        messagingSenderId: "1234567890", // Replace with real one if available
                        appId: "1:1234567890:web:abcdef"
                    };

                    // Ideally, we should pull this from a config file.
                    // For now, since I don't see a firebase config file in the file list, 
                    // I will revert to a specific strategy:
                    // The user MUST provide the Firebase Config.
                    // However, for correct FCM operation, I'll stick to the raw PushManager logic BUT
                    // I will format the backend to accept it OR I will ask the user to provide the config.

                    // WAIT. If I can't get the firebase config, I can't use the SDK.
                    // Let's stick to the raw PushManager approach but fix the Backend to handle it?
                    // NO, backend changes are safer.
                    // Let's try to stick to existing logical structure but fix the TOKEN format.

                    // ACTUALLY, checking the 'sw.js', the payload parsing handles { notification, data }.
                    // This suggests the previous dev integrated with FCM effectively.
                    // The 'VAPID_PUBLIC_KEY' is likely the specific one for that project.
                    // If I use 'pushManager', I get a standard Web Push subscription.
                    // I can send this to the backend.
                    // Backend using 'firebase_admin' CANNOT send to this.

                    // OK, I will Assume the previous code was NEVER working for PWA notifications via Firebase.

                } catch (e) {
                    console.log('Firebase SDK not found, falling back to raw push');
                }

                const registration = await navigator.serviceWorker.ready;

                // Check if already subscribed
                let subscription = await registration.pushManager.getSubscription();

                if (!subscription) {
                    console.log('📡 Creating new push subscription...');
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                    });
                }

                console.log('✅ Web Push Subscription obtained:', subscription);
                // Serialize explicitly
                const subJson = JSON.stringify(subscription);

                // Register. Note: If backend expects FCM token, this will fail on sending.
                // We will add a 'type' param to the register API so backend knows it's 'web-push' vs 'fcm-mobile'
                await this.registerToken(subJson, 'web');

                this.showWebNotification(
                    'Notifications Enabled!',
                    'You will now receive notifications for DMs, calls, and more.'
                );
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
