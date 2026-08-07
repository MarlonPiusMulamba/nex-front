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
        this.audioContext = null;
        this.isInitialized = false;
        this.userId = null;
        if (typeof window !== 'undefined') {
            window.notificationService = this;
        }
    }

    async initialize(userId) {
        this.userId = userId;

        // Preload default notice audio
        this.audio = new Audio('/msg-ton.mp3');
        this.audio.volume = 1.0;
        this.audio.preload = 'auto';

        // Enable Web Audio & HTML5 audio on first user interaction (click, touch, keydown)
        const enableAudio = () => {
            try {
                if (!this.audioContext && (window.AudioContext || window.webkitAudioContext)) {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    this.audioContext = new AudioCtx();
                }
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
            } catch (e) {
                console.warn('AudioContext init note:', e);
            }

            if (this.audio) {
                this.audio.play().then(() => {
                    this.audio.pause();
                    this.audio.currentTime = 0;
                    console.log('✓ HTML5 Audio & AudioContext unlocked for notifications');
                }).catch(() => { });
            }

            document.removeEventListener('click', enableAudio);
            document.removeEventListener('touchstart', enableAudio);
            document.removeEventListener('keydown', enableAudio);
        };

        document.addEventListener('click', enableAudio, { once: true });
        document.addEventListener('touchstart', enableAudio, { once: true });
        document.addEventListener('keydown', enableAudio, { once: true });

        // Check if we're in a browser environment
        const isSecure = typeof window !== 'undefined' && window.isSecureContext;
        console.log('🛡️ Secure Context:', isSecure);
        console.log('📢 Notification Supported:', (typeof window !== 'undefined' && 'Notification' in window));

        if (typeof window !== 'undefined' && 'Notification' in window) {
            // Clear legacy token format if present
            const storedToken = localStorage.getItem('fcm_token');
            if (storedToken && storedToken.trim().startsWith('{')) {
                console.log('🧹 Clearing legacy Web Push token to force FCM upgrade');
                localStorage.removeItem('fcm_token');
                localStorage.removeItem('fcm_token_sent');
            }

            await this.requestWebPermission();
        } else if (typeof window !== 'undefined' && !isSecure) {
            console.warn('⚠️ Notifications disabled because this is not a secure context (HTTPS required)');
        }

        // Initialize mobile push if on native platform (Android APK)
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

    // Web Audio API Synthesizer fallback if HTML5 Audio is blocked or missing
    playSynthBeep(type = 'notice') {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;

            if (!this.audioContext) {
                this.audioContext = new AudioCtx();
            }

            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const ctx = this.audioContext;
            const now = ctx.currentTime;

            if (type === 'call') {
                // Dual-tone ringing chime
                [523.25, 659.25, 783.99].forEach((freq, index) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + index * 0.15);

                    gain.gain.setValueAtTime(0, now + index * 0.15);
                    gain.gain.linearRampToValueAtTime(0.2, now + index * 0.15 + 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.15 + 0.3);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(now + index * 0.15);
                    osc.stop(now + index * 0.15 + 0.35);
                });
            } else if (type === 'message') {
                // Subtle pop/chirp chime
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);

                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 0.16);
            } else {
                // Two-tone announcement chime (Notice)
                [587.33, 880].forEach((freq, index) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + index * 0.12);

                    gain.gain.setValueAtTime(0, now + index * 0.12);
                    gain.gain.linearRampToValueAtTime(0.25, now + index * 0.12 + 0.03);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.25);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(now + index * 0.12);
                    osc.stop(now + index * 0.12 + 0.28);
                });
            }
            console.log(`✓ AudioContext synthesized sound played (${type})`);
        } catch (err) {
            console.warn('Web Audio synth playback warning:', err);
        }
    }

    // Play notification sound with sound clip + synth fallback & vibration
    playSound(soundType = 'notice') {
        try {
            let soundFile = '/msg-ton.mp3';
            if (soundType === 'call') {
                soundFile = '/call-ton.mp3';
            } else if (soundType === 'message' || soundType === 'dm') {
                soundFile = '/notify.mp3';
            }

            const audioToPlay = new Audio(soundFile);
            audioToPlay.volume = 1.0;

            const playPromise = audioToPlay.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log(`✓ Notification sound played (${soundFile})`);
                }).catch(err => {
                    console.warn(`Sound file play blocked (${soundFile}), falling back to synth tone:`, err);
                    this.playSynthBeep(soundType);
                });
            } else {
                this.playSynthBeep(soundType);
            }

            // Trigger Vibration / Haptics
            this.vibrate(soundType);
        } catch (err) {
            console.error('Error playing notification sound:', err);
            this.playSynthBeep(soundType);
            this.vibrate(soundType);
        }
    }

    vibrate(patternType = 'notice') {
        try {
            let pattern = [300, 100, 300, 100, 300];
            if (patternType === 'call') {
                pattern = [500, 200, 500, 200, 500, 200, 500];
            } else if (patternType === 'message') {
                pattern = [200, 80, 200];
            }

            if (Capacitor.isNativePlatform()) {
                if (patternType === 'call') {
                    Haptics.vibrate({ duration: 1000 }).catch(() => {});
                } else {
                    Haptics.vibrate({ duration: 500 }).catch(() => {});
                }
            } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(pattern);
            }
        } catch (err) {
            console.warn('Vibration error:', err);
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

    async showWebNotification(title, body, icon = '/logo.png', extraData = {}, soundType = 'notice') {
        console.log('📢 showWebNotification called:', { title, body, extraData, soundType });

        if (!('Notification' in window)) {
            console.error('❌ Notifications not supported in window context');
            this.playSound(soundType);
            return;
        }

        if (Notification.permission !== 'granted') {
            console.warn('⚠️ Notification permission not granted:', Notification.permission);
            this.playSound(soundType);
            return;
        }

        try {
            const targetUrl = extraData.url || window.location.origin;
            const vibePattern = soundType === 'call' ? [500, 200, 500, 200, 500] : (soundType === 'message' ? [200, 80, 200] : [300, 100, 300, 100, 300]);

            // Priority: Try using Service Worker registration (more reliable for tray & PWA background)
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                if (registration && registration.showNotification) {
                    console.log('✅ Showing tray notification via Service Worker registration');
                    await registration.showNotification(title, {
                        body: body,
                        icon: icon,
                        badge: icon,
                        vibrate: vibePattern,
                        requireInteraction: soundType === 'call',
                        tag: `nexfi-${soundType}-${Date.now()}`,
                        renotify: true,
                        data: { ...extraData, url: targetUrl }
                    });
                    this.playSound(soundType);
                    // Phoenix-style auto-dismiss ~3s (keep calls until answered)
                    if (soundType !== 'call') {
                        setTimeout(() => {
                            registration.getNotifications().then(ns => ns.forEach(n => n.close()));
                        }, 3200);
                    }
                    return;
                }
            }

            // Fallback: Legacy Notification constructor
            console.log('✅ Showing notification via Legacy Notification constructor');
            const notification = new Notification(title, {
                body: body,
                icon: icon,
                requireInteraction: soundType === 'call',
                vibrate: vibePattern,
                data: { ...extraData, url: targetUrl }
            });
            this.playSound(soundType);

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
            // Phoenix-style auto-dismiss ~3s (keep calls until answered)
            if (soundType !== 'call') {
                setTimeout(() => notification.close(), 3200);
            }
        } catch (err) {
            console.error('❌ Error showing web notification:', err);
            this.playSound(soundType);
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
        this.playSound('notice');

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

        // Web & PWA: vibration + sound + tray pop-up
        this.showWebNotification(notifTitle, notifBody, '/logo.png', {
            url: targetUrl,
            org_slug: payload.org_slug,
            notice_id: payload.notice_id
        }, 'notice');
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
        const soundType = data.soundType || data.type || 'message';
        const title = data.title || 'New Notification';
        const body = data.body || data.message || '';
        const url = data.url || '/tabs/feed';

        const isNative = Capacitor.isNativePlatform();
        if (isNative && LocalNotifications && LocalNotifications.schedule) {
            try {
                await LocalNotifications.schedule({
                    notifications: [{
                        title: title,
                        body: body,
                        id: Math.floor(Date.now() % 1000000),
                        schedule: { at: new Date(Date.now() + 50) },
                        channelId: soundType === 'call' ? 'calls' : (soundType === 'message' ? 'messages' : 'notices'),
                        extra: { url, ...data }
                    }]
                });
                this.playSound(soundType);
                return;
            } catch (err) {
                console.warn('LocalNotification schedule error:', err);
            }
        }

        this.showWebNotification(title, body, '/logo.png', { url, ...data }, soundType);
    }

    // Handle real-time incoming notification events (DMs, mentions, notices, calls)
    handleIncomingNotification(notification) {
        console.log('📨 Incoming notification received:', notification);
        const title = notification.title || (notification.from_username ? `💬 Message from ${notification.from_username}` : 'New Notification');
        const body = notification.message || notification.body || notification.text || '';
        const soundType = notification.type === 'call' ? 'call' : (notification.type === 'message' || notification.type === 'dm' ? 'message' : 'notice');

        this.showLocalNotification({
            title: title,
            body: body,
            soundType: soundType,
            url: notification.url || (notification.type === 'message' ? '/messages' : '/tabs/feed')
        });
    }
}

export default new NotificationService();
