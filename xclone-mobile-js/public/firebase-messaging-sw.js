// Firebase Messaging Service Worker
// This file MUST be at the root scope (/firebase-messaging-sw.js) for FCM to deliver background pushes.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase (must match your app's config)
firebase.initializeApp({
    apiKey: "AIzaSyCSf2PJ8-cMcLJF4d3-7ymxWDSv8DJ73Kg",
    authDomain: "nexfi-5cedf.firebaseapp.com",
    projectId: "nexfi-5cedf",
    storageBucket: "nexfi-5cedf.firebasestorage.app",
    messagingSenderId: "60010292286",
    appId: "1:60010292286:web:91a8b4181f2aa794e65d6f",
    measurementId: "G-LMJ85K03F2"
});

const messaging = firebase.messaging();

// Handle background messages (when app is closed or in background)
messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Background message received:', payload);

    // FCM data-only messages put everything in payload.data
    const data = payload.data || {};
    const notification = payload.notification || {};

    const title = data.title || notification.title || 'NexFi';
    const body = data.body || notification.body || data.message || 'You have a new update';

    const isCall = data.type === 'call';
    const isMissedCall = data.type === 'missed_call';

    const options = {
        body: body,
        icon: '/favicon.png',
        badge: '/favicon.png',
        vibrate: isCall ? [500, 200, 500, 200, 500, 200, 500, 200, 500] : [300, 100, 300],
        requireInteraction: isCall,
        data: {
            url: data.click_action || data.url || '/',
            type: data.type,
            call_id: data.call_id,
            caller_username: data.caller_username,
            caller_id: data.caller_id,
            media: data.media,
            from_user_id: data.from_user_id,
            from_username: data.from_username
        },
        tag: isCall ? 'nexfi-call' : (isMissedCall ? 'nexfi-missed-call' : (data.tag || 'nexfi-push')),
        renotify: true,
        silent: false,
        actions: isCall ? [
            { action: 'accept', title: '✅ Accept Call', icon: '/favicon.png' },
            { action: 'decline', title: '❌ Decline', icon: '/favicon.png' }
        ] : []
    };

    // For calls, broadcast to any open clients to play ringtone
    if (isCall) {
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'PLAY_RINGTONE',
                    callId: data.call_id
                });
            });
        });
    }

    return self.registration.showNotification(title, options);
});

// Handle notification clicks
self.addEventListener('notificationclick', function (event) {
    console.log('[firebase-messaging-sw.js] Notification click:', event.action);
    event.notification.close();

    // Stop ringtone if it's a call notification
    if (event.notification.data && event.notification.data.type === 'call') {
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'STOP_RINGTONE',
                    callId: event.notification.data.call_id
                });
            });
        });
    }

    let targetUrl = event.notification.data?.url || '/';

    if (event.action === 'accept') {
        // Build URL with call parameters to open the call UI
        const callData = event.notification.data;
        targetUrl = `/?incomingCall=1&callId=${callData.call_id}&media=${callData.media}&caller=${callData.caller_username}&callerId=${callData.caller_id || ''}`;
    } else if (event.action === 'decline') {
        // Just close the notification, don't open the app
        return;
    } else if (event.notification.data?.type === 'message') {
        // For message notifications, navigate to DMs
        targetUrl = `/messages`;
    }

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // If app is already open, focus and navigate
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if ('focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            // Open new window if app not open
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
