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
import { setTheme, applyThemeToBody, i18nState } from './utils/i18n.js';

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
      theme: i18nState.theme || 'light',
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
      setTheme(t);
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
    
    // Initialize notification service for all users (logged-in or guest)
    const userId = localStorage.getItem('userId') || '1';
    try {
      await notificationService.initialize(userId);
      console.log('✓ Notification service initialized');
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }

    window.appRouter = this.$router;

    // Global Socket Listeners for notifications
    const socket = this.$socketService?.socket || this.$socket;
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

      socket.on('notice:new', (payload) => {
        console.log('📢 App received global notice:new event:', payload);
        notificationService.triggerNoticeNotification(payload);
      });
    }

    // Theme listener and initial application
    let saved = null;
    try {
      saved = localStorage.getItem('pref_theme') || localStorage.getItem('theme');
    } catch (_) {}
    const initialT = saved === 'dark' ? 'dark' : 'light';
    this.theme = initialT;
    applyThemeToBody(initialT);

    window.addEventListener('themeChanged', (e) => {
      if (e && e.detail) {
        this.theme = e.detail;
      }
    });

    // Initialize LAN P2P Service globally
    const lanSocket = this.$socketService?.socket || this.$socket || null;
    const currentUsername = localStorage.getItem('username') || userId;
    if (userId && lanSocket) {
      const { default: lanService } = await import('./utils/lanService.js');
      const { autoDiscoverAndConnect } = await import('./utils/lanSignaling.js');
      
      lanService.init(lanSocket, userId, currentUsername);
      
      // Initial discovery burst
      autoDiscoverAndConnect(lanService);
      
      // Global listeners for LAN events
      lanService.onMessage((msg) => {
        // If not on DM page, show notification
        if (this.$route.path !== '/tabs/dm') {
          notificationService.handleIncomingNotification({
            title: `LAN Message: ${msg.username || msg.from_user_id}`,
            message: msg.text || '📸 Shared a media file',
            type: 'message'
          });
        }
      });
      
      console.log('✓ Global LAN Service initialized');
    }

    // Service Worker Message Listener for Background Actions
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Received message from SW:', event.data);
        if (event.data && event.data.type === 'PLAY_RINGTONE') {
           // We can trigger the CallOverlay to play sound via a global event bus or direct access
           // For now, let's use a simpler approach: check if CallOverlay is active
           // Ideally, CallOverlay should pick this up via the 'incomingCall' query param check logic, 
           // but early ringtone playback helps.
           // However, iOS/Chrome might block audio without user interaction.
           // We will rely on the notification sound itself for the first alert, 
           // and this listener effectively pre-warms the app logic if it was in background (but running).
           console.log('🔔 SW says PLAY RINGTONE');
        } else if (event.data && event.data.type === 'STOP_RINGTONE') {
           console.log('🔕 SW says STOP RINGTONE');
           // Dispatch event to stop ringtone in components
           window.dispatchEvent(new CustomEvent('stop-ringtone'));
        }
      });
    }

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

/* 🌐 Global Clickable Blue Links for Posts, Notices, Comments, and Messages */
.post-link,
.notice-link,
.notice-text a,
.post-text a,
.post-content a,
.msg-text a,
.comment-text a,
.notice-snippet a,
.notice-detail-body a {
  color: #2563eb !important;
  text-decoration: underline !important;
  font-weight: 600 !important;
  word-break: break-all;
  overflow-wrap: anywhere;
  cursor: pointer;
  transition: color 0.15s ease, text-decoration 0.15s ease;
}

.post-link:hover,
.notice-link:hover,
.notice-text a:hover,
.post-text a:hover,
.post-content a:hover,
.msg-text a:hover,
.comment-text a:hover,
.notice-snippet a:hover,
.notice-detail-body a:hover {
  color: #1d4ed8 !important;
  text-decoration: underline !important;
}

.post-link:focus,
.notice-link:focus,
.notice-text a:focus,
.post-text a:focus {
  outline: 2px auto #2563eb;
  outline-offset: 2px;
}
</style>
