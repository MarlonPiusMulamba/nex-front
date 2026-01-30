// NexFi Service Worker for Push Notifications
self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');
    let data = { title: 'NexFi Notification', body: 'You have a new update.' };

    if (event.data) {
        try {
            data = event.data.json();
            // FCM data is usually in data.data or data.notification
            if (data.data) {
                data = { ...data.notification, ...data.data };
            }
        } catch (e) {
            data = { title: 'NexFi', body: event.data.text() };
        }
    }

    const isCall = data.type === 'call';

    const options = {
        body: data.body || data.message || 'New update from NexFi',
        icon: '/favicon.png',
        badge: '/favicon.png',
        vibrate: isCall ? [500, 200, 500, 200, 500, 200, 500, 200, 500] : [300, 100, 300],
        requireInteraction: isCall ? true : false,
        data: data.click_action || data.url || '/',
        tag: isCall ? 'nexfi-call' : (data.tag || 'nexfi-push'),
        renotify: true,
        actions: isCall ? [
            { action: 'accept', title: '✅ Join Call', icon: '/favicon.png' },
            { action: 'decline', title: '❌ Decline', icon: '/favicon.png' }
        ] : []
    };

    event.waitUntil(self.registration.showNotification(data.title || 'NexFi', options));
});

self.addEventListener('notificationclick', function (event) {
    console.log('[Service Worker] Notification click Received.', event.action);
    event.notification.close();

    let targetUrl = event.notification.data || '/';

    if (event.action === 'accept') {
        // Ensure the URL has the necessary parameters to open the call overlay
        if (!targetUrl.includes('incomingCall=1')) {
            targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'incomingCall=1';
        }
    } else if (event.action === 'decline') {
        // Just close and do nothing else
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// Required for PWA installability
self.addEventListener('fetch', function (event) {
    // Only handle same-origin requests to avoid CORS issues
    if (event.request.url.startsWith(self.location.origin)) {
        event.respondWith(
            fetch(event.request)
                .catch(function (error) {
                    console.log('[Service Worker] Fetch failed; returning offline page instead.', error);
                    // Return a basic response instead of failing completely
                    // This prevents the white screen issue
                    return new Response('Network error occurred', {
                        status: 408,
                        statusText: 'Network error occurred',
                        headers: new Headers({
                            'Content-Type': 'text/plain'
                        })
                    });
                })
        );
    }
    // For cross-origin requests, let the browser handle them normally
});

