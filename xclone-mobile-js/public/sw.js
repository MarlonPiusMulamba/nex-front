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
    // Basic fetch handler to satisfy browser requirements
    event.respondWith(fetch(event.request));
});
