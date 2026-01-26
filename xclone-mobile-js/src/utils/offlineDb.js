import Dexie from 'dexie';

export const db = new Dexie('NexFiOfflineDB');

// Define database schema
// Increased version to 10 to ensure upgrade from any previous states
db.version(10).stores({
    posts: 'post_id, timestamp, username',
    profiles: 'user_id, username',
    conversations: 'user_id, username',
    messages: 'id, [from_user_id+to_user_id], timestamp',
    notifications: 'id, created_at',
    trending: 'topic, type',
    suggestedUsers: 'user_id, username',
    appState: 'key' // For storing simple flags like 'isOffline'
});

/**
 * Utility to save posts to offline storage
 * @param {Array} posts 
 */
export async function savePostsOffline(posts) {
    if (!posts || !Array.isArray(posts)) return;
    try {
        await db.posts.bulkPut(posts);
        // Keep only the last 100 posts to save space
        const count = await db.posts.count();
        if (count > 100) {
            const allPosts = await db.posts.orderBy('timestamp').toArray();
            const toDelete = allPosts.slice(0, count - 100).map(p => p.post_id);
            await db.posts.bulkDelete(toDelete);
        }
    } catch (error) {
        console.error('Error saving posts offline:', error);
    }
}

/**
 * Utility to get posts from offline storage
 */
export async function getOfflinePosts() {
    try {
        return await db.posts.orderBy('timestamp').reverse().toArray();
    } catch (error) {
        console.error('Error getting offline posts:', error);
        return [];
    }
}

/**
 * Save user profile offline
 */
export async function saveProfileOffline(profile) {
    if (!profile) return;
    try {
        await db.profiles.put(profile);
    } catch (error) {
        console.error('Error saving profile offline:', error);
    }
}

/**
 * Get profile from offline storage
 */
export async function getOfflineProfile(username) {
    try {
        return await db.profiles.where('username').equalsIgnoreCase(username).first();
    } catch (error) {
        console.error('Error getting offline profile:', error);
        return null;
    }
}

/**
 * Save messages offline
 */
export async function saveMessagesOffline(messages) {
    if (!messages || !Array.isArray(messages)) return;
    try {
        await db.messages.bulkPut(messages);
    } catch (error) {
        console.error('Error saving messages offline:', error);
    }
}

/**
 * Get messages from offline storage
 */
export async function getOfflineMessages(userId1, userId2) {
    try {
        // Get messages where either user is sender/receiver
        return await db.messages
            .filter(m =>
                (String(m.from_user_id) === String(userId1) && String(m.to_user_id) === String(userId2)) ||
                (String(m.from_user_id) === String(userId2) && String(m.to_user_id) === String(userId1))
            )
            .sortBy('timestamp');
    } catch (error) {
        console.error('Error getting offline messages:', error);
        return [];
    }
}

/**
 * Save conversations offline
 */
export async function saveConversationsOffline(conversations) {
    if (!conversations || !Array.isArray(conversations)) return;
    try {
        await db.conversations.bulkPut(conversations);
    } catch (error) {
        console.error('Error saving conversations offline:', error);
    }
}

/**
 * Get conversations from offline storage
 */
export async function getOfflineConversations() {
    try {
        return await db.conversations.toArray();
    } catch (error) {
        console.error('Error getting offline conversations:', error);
        return [];
    }
}

/**
 * Save trending topics offline
 */
export async function saveTrendingOffline(topics) {
    if (!topics || !Array.isArray(topics)) return;
    try {
        await db.trending.clear();
        await db.trending.bulkPut(topics);
    } catch (error) {
        console.error('Error saving trending offline:', error);
    }
}

/**
 * Get trending topics from offline storage
 */
export async function getOfflineTrending() {
    try {
        return await db.trending.toArray();
    } catch (error) {
        console.error('Error getting offline trending:', error);
        return [];
    }
}

/**
 * Save suggested users offline
 */
export async function saveSuggestedOffline(users) {
    if (!users || !Array.isArray(users)) return;
    try {
        await db.suggestedUsers.clear();
        await db.suggestedUsers.bulkPut(users);
    } catch (error) {
        console.error('Error saving suggested users offline:', error);
    }
}

/**
 * Get suggested users from offline storage
 */
export async function getOfflineSuggested() {
    try {
        return await db.suggestedUsers.toArray();
    } catch (error) {
        console.error('Error getting offline suggestions:', error);
        return [];
    }
}

/**
 * Save notifications offline
 */
export async function saveNotificationsOffline(notifications) {
    if (!notifications || !Array.isArray(notifications)) return;
    try {
        await db.notifications.bulkPut(notifications);
        // Keep only the last 100 notifications
        const count = await db.notifications.count();
        if (count > 100) {
            const allNotifs = await db.notifications.orderBy('created_at').toArray();
            const toDelete = allNotifs.slice(0, count - 100).map(n => n.id);
            await db.notifications.bulkDelete(toDelete);
        }
    } catch (error) {
        console.error('Error saving notifications offline:', error);
    }
}

/**
 * Get notifications from offline storage
 */
export async function getOfflineNotifications() {
    try {
        return await db.notifications.orderBy('created_at').reverse().toArray();
    } catch (error) {
        console.error('Error getting offline notifications:', error);
        return [];
    }
}

/**
 * Check if we are currently offline
 * This is a helper that can be used consistently across components
 */
export function isNetworkOffline() {
    return !navigator.onLine;
}

export default db;
