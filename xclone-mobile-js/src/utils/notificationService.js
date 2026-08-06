import axios from 'axios';
import config from '../config/index.js';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
// We will dynamically import firebaseConfig to avoid build errors if file is missing, 
// but usually it's better to catch it in the method.

const VAPID_PUBLIC_KEY = 'BM4kNY416wmRy8ScGUy04HoAhqv_daS-_atWTLNC0T9GhKJy0SmQxTz8o6zpckex1NW-oSf4I6WWhavRNdZOUNU';

class NotificationService {
    constructor() {
        this.audio = null;
        this.isInitialized = false;
        this.userId = null;
        if (typeof window !== 'undefined') {
            window.notificationService = this;
        }
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

        // Initialize mobile push if on a native platform (Android/iOS APK)
        const isNative = Capacitor.isNativePlatform();
        console.log('📱 Capacitor isNativePlatform:', isNative);

        if (isNative) {
            this.initializeMobilePush();
        }

        this.isInitialized = true;
        // Check for missed notices while app was offline/closed
        this.checkMissedNotices();
        setInterval(() => {
            if (typeof navigator !== 'undefined' && navigator.onLine) {
                localStorage.setItem('nexfi_last_online_time', String(Date.now()));
            }
        }, 10000);
    }

    // Keep this if you have custom service worker logic, otherwise Firebase will manage its own.
    async registerServiceWorker() {
        // Only register the cache-first sw.js in production to avoid stale dev bundles
        if (import.meta.env.PROD && 'serviceWorker' in navigator) {
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
                    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

                    // Import your Firebase config
                    const { firebaseConfig } = await import('../config/firebase.js');

                    if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
                        console.warn('⚠️ Firebase Config not set in src/config/firebase.js. PWA notifications may fail.');
                        return;
                    }

                    // Step 1: Register the Firebase Messaging service worker FIRST
                    // This is CRITICAL — FCM needs this specific worker to handle background pushes
                    let swRegistration = null;
                    if ('serviceWorker' in navigator) {
                        try {
                            swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                                scope: '/'
                            });
                            console.log('✅ Firebase Messaging SW registered:', swRegistration.scope);

                            // Wait for the SW to be ready
                            await navigator.serviceWorker.ready;
                            console.log('✅ Service Worker is ready');
                        } catch (swError) {
                            console.error('❌ Firebase Messaging SW registration failed:', swError);
                        }
                    }

                    // Step 2: Initialize Firebase App
                    const app = initializeApp(firebaseConfig);
                    const messaging = getMessaging(app);

                    // Step 3: Get FCM token, passing the SW registration so FCM binds to the correct worker
                    const tokenOptions = { vapidKey: VAPID_PUBLIC_KEY };
                    if (swRegistration) {
                        tokenOptions.serviceWorkerRegistration = swRegistration;
                    }

                    const currentToken = await getToken(messaging, tokenOptions);

                    if (currentToken) {
                        console.log('✅ FCM Registration Token obtained:', currentToken.substring(0, 20) + '...');
                        // Register this FCM token with the backend
                        await this.registerToken(currentToken, 'fcm-web');

                        // Only show the welcome notification on first registration
                        const wasRegistered = localStorage.getItem('fcm_token_registered');
                        if (!wasRegistered) {
                            this.showWebNotification(
                                'Notifications Enabled!',
                                'You will now receive notifications for DMs, calls, and more.'
                            );
                            localStorage.setItem('fcm_token_registered', 'true');
                        }
                    } else {
                        console.warn('⚠️ No FCM registration token available. Request permission to generate one.');
                    }

                    // Step 4: Handle foreground messages (when app is open)
                    onMessage(messaging, (payload) => {
                        console.log('📨 Foreground FCM message received:', payload);
                        const data = payload.data || {};
                        const notification = payload.notification || {};

                        const title = data.title || notification.title || 'NexFi';
                        const body = data.body || notification.body || data.message || 'New update';

                        // Play notification sound
                        this.playSound();

                        // Show notification (foreground messages don't auto-show)
                        this.showWebNotification(title, body);

                        // If it's a call, dispatch event so CallOverlay can handle it
                        if (data.type === 'call') {
                            window.dispatchEvent(new CustomEvent('call:incoming', {
                                detail: {
                                    call_id: data.call_id,
                                    caller_id: data.caller_id,
                                    caller_username: data.caller_username,
                                    media: data.media,
                                    status: 'ringing'
                                }
                            }));
                        }
                    });

                    // Step 5: Listen for messages from the service worker (ringtone control)
                    if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.addEventListener('message', (event) => {
                            if (event.data?.type === 'PLAY_RINGTONE') {
                                console.log('🔔 SW requested ringtone for call:', event.data.callId);
                                this.playSound();
                            } else if (event.data?.type === 'STOP_RINGTONE') {
                                console.log('🔇 SW requested ringtone stop for call:', event.data.callId);
                                if (this.audio) {
                                    this.audio.pause();
                                    this.audio.currentTime = 0;
                                }
                            }
                        });
                    }

                } catch (error) {
                    console.error('❌ Error getting FCM token or initializing Firebase:', error);
                    // Fallback: register sw.js for basic push support
                    console.log('Falling back to basic service worker registration');
                    try {
                        if (!import.meta.env.PROD) {
                            throw new Error('sw.js fallback skipped in dev to avoid stale caching');
                        }
                        const registration = await navigator.serviceWorker.register('/sw.js');
                        await navigator.serviceWorker.ready;
                        let subscription = await registration.pushManager.getSubscription();

                        if (!subscription) {
                            console.log('📡 Creating new push subscription via PushManager...');
                            subscription = await registration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                            });
                        }
                        console.log('✅ Web Push Subscription obtained (fallback)');
                        const subJson = JSON.stringify(subscription);
                        await this.registerToken(subJson, 'web-push');
                    } catch (fallbackError) {
                        console.error('❌ Fallback push registration also failed:', fallbackError);
                    }
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
        try {
            console.log('📱 Initializing mobile push & local notifications...');

            // 1. Create Notification Channels unconditionally (Android)
            const noticesChannel = {
                id: 'notices',
                name: 'Notice Board Announcements',
                description: 'Notifications for new official notices and announcements',
                importance: 5, // 5 = High/Max (sound and banner pop-up on screen)
                visibility: 1, // 1 = Public
                vibration: true
            };

            await PushNotifications.createChannel({
                id: 'calls',
                name: 'Incoming Calls',
                description: 'Notifications for incoming video and voice calls',
                importance: 5,
                visibility: 1,
                sound: 'call-ton.mp3',
                vibration: true
            }).catch(() => {});

            await PushNotifications.createChannel({
                id: 'messages',
                name: 'Messages',
                description: 'Notifications for new messages',
                importance: 4,
                visibility: 1,
                vibration: true
            }).catch(() => {});

            await PushNotifications.createChannel(noticesChannel).catch(() => {});
            if (LocalNotifications && LocalNotifications.createChannel) {
                await LocalNotifications.createChannel(noticesChannel).catch(() => {});
            }

            // 2. Attach Notification Event Listeners unconditionally
            PushNotifications.removeAllListeners().catch(() => {});

            PushNotifications.addListener('registration', async (token) => {
                console.log('Push registration success, token:', token.value);
                await this.registerToken(token.value, 'fcm-mobile');
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('Push registration error:', error);
            });

            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push notification received:', notification);
                this.playSound();
                LocalNotifications.schedule({
                    notifications: [{
                        title: notification.title || 'NexFi Notice',
                        body: notification.body || '',
                        id: Math.floor(Date.now() % 1000000),
                        schedule: { at: new Date(Date.now() + 100) },
                        channelId: 'notices',
                        extra: notification.data || notification.extra || {}
                    }]
                }).catch(() => {});
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                console.log('Push notification action performed:', action);
                const data = action.notification?.data || action.notification?.extra;
                if (data && data.org_slug) {
                    const targetPath = `/tabs/notices/${data.org_slug}`;
                    if (window.appRouter) {
                        window.appRouter.push(targetPath);
                    } else {
                        window.location.href = targetPath;
                    }
                }
            });

            if (LocalNotifications && LocalNotifications.addListener) {
                LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
                    console.log('📱 Local tray notification tapped:', action);
                    const extra = action.notification?.extra || action.notification?.data;
                    if (extra && extra.org_slug) {
                        const targetPath = `/tabs/notices/${extra.org_slug}`;
                        if (window.appRouter) {
                            window.appRouter.push(targetPath);
                        } else {
                            window.location.href = targetPath;
                        }
                    }
                });
            }

            // 3. Request permissions & trigger registration
            if (LocalNotifications && LocalNotifications.requestPermissions) {
                await LocalNotifications.requestPermissions().catch(() => {});
            }

            const permResult = await PushNotifications.requestPermissions();
            console.log('📱 Push permission result:', permResult);

            if (permResult.receive === 'granted') {
                await PushNotifications.register().catch(e => console.warn('Push register warn:', e));
            }
        } catch (error) {
            console.error('Error initializing mobile push:', error);
        }
    }


    async registerToken(token, deviceType, prefDeptId) {
        try {
            const apiUrl = config.api?.baseURL || config.baseURL;
            const currentPref = prefDeptId !== undefined ? prefDeptId : (localStorage.getItem('pref_dept_bugema') || null);
            await axios.post(`${apiUrl}/api/notifications/register-token`, {
                user_id: this.userId || localStorage.getItem('userId') || 0,
                token: token,
                device_type: deviceType,
                pref_dept_id: currentPref ? Number(currentPref) : null
            });
            console.log(`✓ ${deviceType} notification token registered (pref_dept_id: ${currentPref})`);
        } catch (error) {
            console.error('Error registering notification token:', error);
        }
    }

    async updateDeptPreference(prefDeptId) {
        const storedToken = localStorage.getItem('fcm_token') || this.token;
        if (storedToken) {
            await this.registerToken(storedToken, 'fcm-update', prefDeptId);
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
        try {
            if (!this.audio) {
                this.audio = new Audio('/msg-ton.mp3');
            }
            this.audio.currentTime = 0;
            this.audio.volume = 1.0;

            const playPromise = this.audio.play();

            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('✓ Notification sound played');
                    })
                    .catch(err => {
                        console.warn('Sound play blocked (interaction needed):', err);
                    });
            }

            if (Capacitor.isNativePlatform()) {
                Haptics.vibrate({ duration: 500 }).catch(() => {});
            } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate([300, 100, 300, 100, 300]);
            }
        } catch (err) {
            console.error('Error playing notification sound:', err);
        }
    }

    getPermissionStatus() {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    }

    async showWebNotification(title, body, icon = '/logo.png', extraData = {}) {
        console.log('📢 showWebNotification called:', { title, body, extraData });

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
            const targetUrl = extraData.url || window.location.origin;

            // Priority: Try using Service Worker registration (more reliable for tray)
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                if (registration && registration.showNotification) {
                    console.log('✅ Showing tray notification via Service Worker registration');
                    await registration.showNotification(title, {
                        body: body,
                        icon: icon,
                        badge: icon,
                        vibrate: [300, 100, 300, 100, 300],
                        requireInteraction: true,
                        tag: `nexfi-notice-${Date.now()}`,
                        renotify: true,
                        data: { ...extraData, url: targetUrl }
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
                vibrate: [300, 100, 300, 100, 300],
                data: { ...extraData, url: targetUrl }
            });
            this.playSound();

            notification.onclick = () => {
                window.focus();
                if (targetUrl && targetUrl !== '#') {
                    if (window.appRouter) {
                        window.appRouter.push(targetUrl);
                    } else {
                        window.location.href = targetUrl;
                    }
                }
                notification.close();
            };
        } catch (err) {
            console.error('❌ Error showing notification:', err);
            this.playSound();
        }
    }

    async triggerNoticeNotification(payload) {
        if (!payload) return;

        const orgName = payload.org_name || 'Bugema University';
        const deptName = payload.dept_name || payload.notice?.dept_name || 'Notice Board';
        const title = payload.title || payload.notice?.title || 'New Announcement';
        const rawBody = payload.body || payload.notice?.body || '';

        // Clean HTML tags and create brief intro snippet
        const cleanBody = rawBody.replace(/<[^>]*>/g, '').trim();
        const briefSnippet = cleanBody.length > 120 ? cleanBody.slice(0, 117) + '...' : cleanBody;

        const notifTitle = `📢 ${orgName} • ${deptName}`;
        const notifBody = briefSnippet ? `${title}\n${briefSnippet}` : title;
        const targetUrl = `/tabs/notices/${payload.org_slug || 'bugema'}`;

        console.log('🔔 Triggering Notice System Tray Notification:', { notifTitle, notifBody, targetUrl });

        // Play sound & Haptics vibration unconditionally
        this.playSound();

        const isNative = Capacitor.isNativePlatform();

        if (isNative) {
            // Schedule Local System Tray Notification on Android
            if (LocalNotifications && LocalNotifications.schedule) {
                try {
                    await LocalNotifications.schedule({
                        notifications: [{
                            title: notifTitle,
                            body: notifBody,
                            id: Math.floor(Date.now() % 1000000),
                            schedule: { at: new Date(Date.now() + 50) },
                            channelId: 'notices',
                            extra: {
                                url: targetUrl,
                                org_slug: payload.org_slug || 'bugema',
                                notice_id: payload.notice_id
                            }
                        }]
                    });
                    console.log('✅ Android System Tray Notification scheduled successfully');
                } catch (err) {
                    console.warn('LocalNotification schedule warning:', err);
                }
            }
            return;
        }

        // Web & Desktop: vibration + sound + tray pop-up
        if ('vibrate' in navigator) {
            navigator.vibrate([300, 100, 300, 100, 300]);
        }
        this.showWebNotification(notifTitle, notifBody, '/logo.png', {
            url: targetUrl,
            org_slug: payload.org_slug,
            notice_id: payload.notice_id
        });
    }

    async checkMissedNotices() {
        try {
            const lastOnline = localStorage.getItem('nexfi_last_online_time');
            const now = Date.now();
            localStorage.setItem('nexfi_last_online_time', String(now));

            if (!lastOnline) return;

            const timeDiff = now - parseInt(lastOnline, 10);
            // Only check if user was offline for at least 10 seconds
            if (timeDiff < 10000) return;

            console.log(`🔍 Checking missed notices since ${new Date(parseInt(lastOnline, 10)).toISOString()}...`);
            const apiUrl = config.api?.baseURL || config.baseURL;
            const res = await axios.get(`${apiUrl}/api/notifications/missed_notices`, {
                params: {
                    since: lastOnline,
                    org_slug: import.meta.env.VITE_STANDALONE_ORG || 'bugema'
                }
            });

            if (res.data && res.data.success && Array.isArray(res.data.notices) && res.data.notices.length > 0) {
                console.log(`📢 Found ${res.data.notices.length} missed notices posted while offline!`);
                for (const notice of res.data.notices) {
                    await this.triggerNoticeNotification({
                        org_name: notice.org_name || 'Bugema University',
                        dept_name: notice.dept_name || 'Notice Board',
                        title: notice.title,
                        body: notice.body,
                        org_slug: notice.org_slug || 'bugema',
                        notice_id: notice.id
                    });
                }
            }
        } catch (err) {
            console.warn('Error checking missed notices:', err);
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
