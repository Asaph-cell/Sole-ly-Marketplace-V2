// Service Worker for Push Notifications
// This handles incoming push messages and displays notifications

self.addEventListener('push', function (event) {
    console.log('[SW] Push received:', event);

    let data = {
        title: 'New Order!',
        body: 'You have a new order waiting for confirmation.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        url: '/vendor/orders'
    };

    try {
        if (event.data) {
            data = { ...data, ...event.data.json() };
        }
    } catch (e) {
        console.error('[SW] Error parsing push data:', e);
    }

    const options = {
        body: data.body,
        icon: data.icon || '/pwa-192x192.png',
        badge: data.badge || '/pwa-192x192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: data.tag || 'sole-ly-notification',
        renotify: true,
        requireInteraction: true, // Keep notification visible until user interacts
        data: {
            url: data.url || '/vendor/orders',
            orderId: data.orderId
        },
        actions: [
            {
                action: 'view',
                title: '👀 View Order'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };

    event.waitUntil(
        Promise.all([
            self.registration.showNotification(data.title, options),
            // Update PWA app badge (shows number on app icon like WhatsApp)
            updateAppBadge()
        ])
    );
});

// Update PWA badge with actual unread notification count
async function updateAppBadge() {
    try {
        if ('setAppBadge' in navigator) {
            // Get current badge count from IndexedDB
            const db = await openBadgeDB();
            const count = await getBadgeCount(db);
            const newCount = count + 1;
            await setBadgeCount(db, newCount);

            await navigator.setAppBadge(newCount);
            console.log('[SW] App badge set to:', newCount);
        }
    } catch (error) {
        console.log('[SW] Error setting app badge:', error);
        // Fallback to showing 1
        try {
            await navigator.setAppBadge(1);
        } catch (e) { }
    }
}

// IndexedDB helpers for badge count persistence
function openBadgeDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SolelyBadgeDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('badge')) {
                db.createObjectStore('badge');
            }
        };
    });
}

function getBadgeCount(db) {
    return new Promise((resolve) => {
        try {
            const tx = db.transaction('badge', 'readonly');
            const store = tx.objectStore('badge');
            const request = store.get('count');
            request.onsuccess = () => resolve(request.result || 0);
            request.onerror = () => resolve(0);
        } catch (e) {
            resolve(0);
        }
    });
}

function setBadgeCount(db, count) {
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction('badge', 'readwrite');
            const store = tx.objectStore('badge');
            const request = store.put(count, 'count');
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        } catch (e) {
            reject(e);
        }
    });
}

// Handle notification click
self.addEventListener('notificationclick', function (event) {
    console.log('[SW] Notification clicked:', event);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const urlToOpen = event.notification.data?.url || '/vendor/orders';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (clientList) {
                // Check if there's already an open window
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                // No open window, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Handle subscription change (e.g., browser refreshed the push subscription)
self.addEventListener('pushsubscriptionchange', function (event) {
    console.log('[SW] Push subscription changed');
    // The frontend will handle re-subscribing on next page load
});
