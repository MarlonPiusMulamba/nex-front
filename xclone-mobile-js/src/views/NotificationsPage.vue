<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Notifications</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="markAllRead" :disabled="loading || notifications.length === 0">
            Mark all read
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div v-if="loading" class="loading-container">
        <ion-spinner></ion-spinner>
      </div>

      <div v-else>
        <div v-if="notifications.length === 0" class="empty-state">
          <p>No notifications yet.</p>
        </div>

        <ion-list v-else>
          <ion-item
            v-for="n in notifications"
            :key="n.id"
            button
            @click="openNotification(n)"
          >
            <ion-avatar slot="start">
              <img :src="getImageUrl(n.actor_profile_pic)" alt="avatar" />
            </ion-avatar>

            <ion-label>
              <div class="notif-title">
                <span class="notif-message">{{ n.message || fallbackMessage(n) }}</span>
                <span v-if="!n.read" class="notif-dot"></span>
              </div>
              <div class="notif-time">{{ formatRelativeTime(n.created_at) }}</div>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>
    </ion-content>
  </ion-page>
</template>

<script>
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonButtons,
  IonButton,
  IonAvatar
} from '@ionic/vue';
import axios from 'axios';
import config from '@/config/index.js';

export default {
  name: 'NotificationsPage',
  components: {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonSpinner,
    IonButtons,
    IonButton,
    IonAvatar
  },
  data() {
    return {
      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL,
      notifications: [],
      loading: false,
      defaultAvatar:
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
    };
  },
  methods: {
    getImageUrl(imageData) {
      if (!imageData || imageData === '') return this.defaultAvatar;
      if (typeof imageData !== 'string') return this.defaultAvatar;
      if (imageData.startsWith('http')) return imageData;
      if (imageData.startsWith('data:image')) return imageData;
      if (imageData.startsWith('/static/')) return `${this.API_URL}${imageData}`;
      return `data:image/png;base64,${imageData}`;
    },

    fallbackMessage(n) {
      if (n?.type === 'follow') return `@${n.actor_username} followed you`;
      if (n?.type === 'mention') return `@${n.actor_username} mentioned you`;
      if (n?.type === 'new_post') return `@${n.actor_username} posted`;
      return 'Notification';
    },

    formatRelativeTime(timestamp) {
      try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return 'Just now';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return `${diffH}h ago`;
        const diffD = Math.floor(diffH / 24);
        if (diffD < 7) return `${diffD}d ago`;
        return date.toLocaleDateString();
      } catch {
        return '';
      }
    },

    async loadNotifications() {
      if (!this.userId) {
        this.$router.push('/login');
        return;
      }
      this.loading = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/notifications`, {
          params: { user_id: this.userId, limit: 50, offset: 0 }
        });
        this.notifications = res.data.notifications || [];
      } catch (e) {
        console.error('Load notifications error:', e);
        this.notifications = [];
      } finally {
        this.loading = false;
      }
    },

    async markRead(notificationId) {
      try {
        await axios.post(`${this.API_URL}/api/notifications/mark_read`, {
          user_id: this.userId,
          notification_id: notificationId
        });
        window.dispatchEvent(new Event('notifications-refresh'));
      } catch (e) {
        console.error('Mark read error:', e);
      }
    },

    async markAllRead() {
      try {
        await axios.post(`${this.API_URL}/api/notifications/mark_all_read`, {
          user_id: this.userId
        });
        await this.loadNotifications();
        window.dispatchEvent(new Event('notifications-refresh'));
      } catch (e) {
        console.error('Mark all read error:', e);
      }
    },

    async openNotification(n) {
      if (!n) return;
      if (!n.read) await this.markRead(n.id);

      if (n.type === 'mention' && n.post_id) {
        this.$router.push({ path: '/tabs/feed', query: { post_id: n.post_id } });
        return;
      }

      if ((n.type === 'follow' || n.type === 'new_post') && n.actor_username) {
        this.$router.push(`/tabs/profile/${n.actor_username}`);
        return;
      }

      if (n.post_id) {
        this.$router.push({ path: '/tabs/feed', query: { post_id: n.post_id } });
      }
    }
  },
  mounted() {
    this.loadNotifications();
    window.addEventListener('notifications-refresh', this.loadNotifications);
  },
  beforeUnmount() {
    window.removeEventListener('notifications-refresh', this.loadNotifications);
  }
};
</script>

<style scoped>
.loading-container {
  display: flex;
  justify-content: center;
  padding: 18px 0;
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: var(--ion-color-medium, #536471);
}

.notif-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.notif-message {
  font-weight: 700;
  color: var(--ion-text-color, #0f1419);
}

.notif-time {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ion-color-medium, #536471);
}

.notif-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #daa520;
}
</style>
