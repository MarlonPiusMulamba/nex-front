<template>
  <ion-app :class="theme">
    <div v-if="isOffline" class="offline-banner">
      <ion-icon :icon="cloudOfflineOutline"></ion-icon>
      <span style="margin-left: 8px;">Offline Mode - Using cached data</span>
    </div>
    <ion-router-outlet />
    <CallOverlay />
  </ion-app>
</template>

<script>
import { IonApp, IonRouterOutlet, IonIcon } from '@ionic/vue';
import { cloudOfflineOutline } from 'ionicons/icons';
import CallOverlay from './components/CallOverlay.vue';
import notificationService from './utils/notificationService.js';

export default {
  name: 'App',
  components: {
    IonApp,
    IonRouterOutlet,
    IonIcon,
    CallOverlay
  },
  data() {
    return {
      theme: 'light',
      isOffline: !navigator.onLine,
      cloudOfflineOutline
    };
  },
  methods: {
    playNotificationSound() {
      notificationService.playSound();
    },
    applyTheme(nextTheme) {
      const t = nextTheme === 'dark' ? 'dark' : 'light';
      this.theme = t;
      try {
        localStorage.setItem('theme', t);
      } catch (_) {}

      // Keep the root element in sync for :root.light / :root.dark CSS
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(t);

      window.dispatchEvent(new CustomEvent('themeChanged', { detail: t }));
    },
    toggleTheme() {
      this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
    },
    updateOnlineStatus() {
      this.isOffline = !navigator.onLine;
      console.log('📡 Network status changed. Offline:', this.isOffline);
    }
  },
  async mounted() {
    console.log('✅ App mounted successfully');
    
    // Initialize notification service if user is logged in
    const userId = localStorage.getItem('userId');
    if (userId) {
      try {
        await notificationService.initialize(userId);
        console.log('✓ Notification service initialized');
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    }

    // Global Socket Listeners for notifications
    const socket = this.$socket;
    if (socket) {
      socket.on('dm:new_message', (payload) => {
        const currentUserId = localStorage.getItem('userId');
        if (payload && payload.to_user_id == currentUserId) {
          notificationService.handleIncomingNotification({
            title: 'New Message',
            message: `${payload.from_username || 'Someone'} sent you a message`,
            type: 'message'
          });
        }
      });

      socket.on('notification:new', (payload) => {
        notificationService.handleIncomingNotification({
          title: 'New Notification',
          message: payload.message || 'You have a new notification',
          type: payload.type || 'general'
        });
      });
    }

    // Default to light theme unless user explicitly chose dark before
    let saved = null;
    try {
      saved = localStorage.getItem('theme');
    } catch (_) {}
    this.applyTheme(saved === 'dark' ? 'dark' : 'light');

    // Network status listeners
    window.addEventListener('online', this.updateOnlineStatus);
    window.addEventListener('offline', this.updateOnlineStatus);
  },
  beforeUnmount() {
    window.removeEventListener('online', this.updateOnlineStatus);
    window.removeEventListener('offline', this.updateOnlineStatus);
  },
  errorCaptured(err, instance, info) {
    console.error('❌ App Error:', err, info);
    alert(`Error: ${err.message}`);
    return false;
  }
};
</script>

<style>
:root.light {
  --ion-background-color: #ffffff;
  --ion-text-color: #000000;
  --ion-card-background: #f8f9fa;
  --ion-card-text: #000000;
  --ion-input-background: #ffffff;
  --ion-input-text: #000000;
  --ion-toolbar-background: #ffffff;
  --ion-toolbar-text: #000000;
  --ion-tab-bar-background: #ffffff;
  --ion-tab-bar-text: #555555;
  --ion-tab-bar-hover: #daa520;
  --ion-border-color: #e0e0e0;
  --ion-avatar-background: #c7c7c7;
}

:root.dark {
  --ion-background-color: #0b0f14;
  --ion-text-color: #e5e7eb;
  --ion-card-background: #111827;
  --ion-card-text: #e5e7eb;
  --ion-color-light: #111827;
  --ion-color-light-rgb: 17,24,39;
  --ion-color-medium: #9ca3af;
  --ion-color-medium-rgb: 156,163,175;
  --ion-input-background: #111827;
  --ion-input-text: #e5e7eb;
  --ion-toolbar-background: #0b0f14;
  --ion-toolbar-text: #e5e7eb;
  --ion-tab-bar-background: #0b0f14;
  --ion-tab-bar-text: #9ca3af;
  --ion-tab-bar-hover: #ffd700;
  --ion-border-color: #1f2937;
  --ion-avatar-background: #374151;
}

.offline-banner {
  background: var(--ion-color-warning, #ffc409);
  color: #000;
  text-align: center;
  padding: 8px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  z-index: 9999;
}
</style>
