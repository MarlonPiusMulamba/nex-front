// NexFi Service Worker for Push Notifications
self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');
    let data = { title: 'NexFi Notification', body: 'You have a new update.' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'NexFi', body: event.data.text() };
        }
    }

    const options = {
        body: data.body,
        icon: '/favicon.png',
        badge: '/favicon.png',
        vibrate: [300, 100, 300, 100, 300],
        requireInteraction: true,
        data: data.url || '/',
        tag: data.tag || 'nexfi-push',
        renotify: true
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function (event) {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close();

    event.waitUntil(
        clients.openWindow(event.notification.data || '/')
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

