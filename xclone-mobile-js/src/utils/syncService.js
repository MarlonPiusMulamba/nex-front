/**
 * syncService.js — NexFi Eventual Consistency Sync
 *
 * Watches for internet connectivity restoration and
 * uploads any locally-stored (or LAN-delivered) messages
 * to the backend, then marks them 'synced'.
 */

import { getUnsyncedMessages, markMessageSynced } from './offlineDb.js';
import api from './api.js';

let _isSyncing = false;
let _syncInterval = null;
let _onSyncCallback = null;

/**
 * Start watching for connectivity.
 * Call this once on app boot (e.g. in main.js or App.vue mounted).
 */
export function startSyncWatcher(onSyncCallback) {
    _onSyncCallback = onSyncCallback || null;

    // Immediate attempt
    window.addEventListener('online', _onOnline);

    // Periodic heartbeat every 30 seconds (catches cases where
    // the 'online' event fires before the backend is reachable)
    _syncInterval = setInterval(() => {
        if (navigator.onLine) _syncMessages();
    }, 30_000);

    // Attempt on start (in case we're already online)
    if (navigator.onLine) {
        setTimeout(_syncMessages, 3000); // slight delay on boot
    }

    console.log('[Sync] Watcher started');
}

export function stopSyncWatcher() {
    window.removeEventListener('online', _onOnline);
    if (_syncInterval) clearInterval(_syncInterval);
    console.log('[Sync] Watcher stopped');
}

// ─────────────────────────────────────────────
//  Main sync routine
// ─────────────────────────────────────────────
async function _syncMessages() {
    if (_isSyncing) return;
    _isSyncing = true;

    try {
        const unsynced = await getUnsyncedMessages();
        if (!unsynced.length) return;

        console.log(`[Sync] Found ${unsynced.length} unsynced messages. Uploading...`);

        let syncedCount = 0;
        for (const msg of unsynced) {
            try {
                const payload = {
                    from_user_id: msg.from_user_id,
                    to_user_id: msg.to_user_id,
                    text: msg.text || '',
                    image: msg.image || null,
                    voice: msg.voice || null,
                    mood: msg.mood || null,
                    local_id: msg.id,         // dedup key on backend
                    timestamp: msg.timestamp, // preserve original timestamp
                };

                const res = await api.post('/api/messages/sync', payload);
                if (res.success) {
                    await markMessageSynced(msg.id, res.message_id);
                    syncedCount++;
                }
            } catch (msgErr) {
                console.warn('[Sync] Failed to sync message', msg.id, msgErr);
                // Continue to next message — don't block the whole batch
            }
        }

        if (syncedCount > 0) {
            console.log(`[Sync] ✅ Synced ${syncedCount} messages to backend`);
            if (_onSyncCallback) _onSyncCallback(syncedCount);
        }
    } catch (err) {
        console.error('[Sync] Sync error:', err);
    } finally {
        _isSyncing = false;
    }
}

function _onOnline() {
    console.log('[Sync] Internet restored — triggering sync');
    setTimeout(_syncMessages, 1500); // short delay for connection to stabilise
}

// Manual trigger (e.g. call from app.vue pull-to-refresh)
export function triggerSync() {
    return _syncMessages();
}
