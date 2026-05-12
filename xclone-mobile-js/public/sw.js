// NexFi Service Worker for Push Notifications
// Handle background messages from FCM
self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');
    let data = { title: 'NexFi Notification', body: 'You have a new update.' };

    if (event.data) {
        try {
            const payload = event.data.json();
            console.log('[Service Worker] Push payload:', payload);

            // FCM sends data in different formats
            // Format 1: { notification: {...}, data: {...} }
            // Format 2: { data: {...} } (data-only message)
            if (payload.notification) {
                data.title = payload.notification.title || data.title;
                data.body = payload.notification.body || data.body;
            }

            if (payload.data) {
                // Merge data fields
                data = { ...data, ...payload.data };

                // If title/body are in data, use them
                if (payload.data.title) data.title = payload.data.title;
                if (payload.data.body) data.body = payload.data.body;
            }
        } catch (e) {
            console.error('[Service Worker] Failed to parse push data:', e);
            data = { title: 'NexFi', body: event.data.text() };
        }
    }

    const isCall = data.type === 'call';
    const isMissedCall = data.type === 'missed_call';

    const options = {
        body: data.body || data.message || 'New update from NexFi',
        icon: '/favicon.png',
        badge: '/favicon.png',
        vibrate: isCall ? [500, 200, 500, 200, 500, 200, 500, 200, 500] : [300, 100, 300],
        requireInteraction: isCall ? true : false,
        data: {
            url: data.click_action || data.url || '/',
            type: data.type,
            call_id: data.call_id,
            caller_username: data.caller_username,
            media: data.media
        },
        tag: isCall ? 'nexfi-call' : (isMissedCall ? 'nexfi-missed-call' : (data.tag || 'nexfi-push')),
        renotify: true,
        silent: false,
        sound: isCall ? '/call-ton.mp3' : '/notification.mp3', // Try to play custom sound
        actions: isCall ? [
            { action: 'accept', title: '✅ Join Call', icon: '/favicon.png' },
            { action: 'decline', title: '❌ Decline', icon: '/favicon.png' }
        ] : []
    };

    // For calls, play ringtone continuously
    if (isCall) {
        // Store call info for ringtone management
        self.currentCallId = data.call_id;

        // Broadcast to all clients to play ringtone
        event.waitUntil(
            self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'PLAY_RINGTONE',
                        callId: data.call_id
                    });
                });
            })
        );
    }

    event.waitUntil(self.registration.showNotification(data.title || 'NexFi', options));
});

self.addEventListener('notificationclick', function (event) {
    console.log('[Service Worker] Notification click Received.', event.action);
    event.notification.close();

    // Stop ringtone if it's a call
    if (event.notification.data && event.notification.data.type === 'call') {
        // Broadcast to all clients to stop ringtone
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
        // Build URL with call parameters
        const callData = event.notification.data;
        targetUrl = `/?incomingCall=1&callId=${callData.call_id}&media=${callData.media}&caller=${callData.caller_username}&callerId=${callData.caller_id || ''}`;
    } else if (event.action === 'decline') {
        // Just close and do nothing else
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // Check if app is already open
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if ('focus' in client) {
                    // Navigate existing window to target URL
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            // Open new window if app not open
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

const CACHE_NAME = 'nexfi-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.png',
    '/logo.png',
    '/call-ton.mp3',
    '/msg-ton.mp3',
    '/notify.mp3'
];

// Install Event - Cache Core Assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing Service Worker...', event);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching App Shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Event - Cleanup Old Caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating Service Worker...', event);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => self.clients.claim())
    );
});

// Fetch Event - Cache-First Strategy for Assets, Network-First for API
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip API calls and Socket.io requests (handled by offlineDb / Socket.io fallback)
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io') || event.request.method !== 'GET') {
        return;
    }

    // Cache-first strategy for everything else (HTML, JS, CSS, Images)
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached response if found
                if (response) {
                    return response;
                }

                // Otherwise fetch from network and cache dynamically
                return fetch(event.request).then(
                    (networkResponse) => {
                        // Don't cache invalid responses or non-basic requests (like browser extensions)
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        // Clone the response because it's a stream and can only be consumed once
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    }
                ).catch(() => {
                    // If network fails and we don't have it in cache, return the offline fallback
                    console.log('[Service Worker] Fetch failed; offline and not cached.', event.request.url);
                    // For document requests, we could return a specific offline page if we had one
                    // return caches.match('/offline.html');
                    return new Response('Network error occurred (Offline)', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: new Headers({ 'Content-Type': 'text/plain' })
                    });
                });
            })
    );
});

