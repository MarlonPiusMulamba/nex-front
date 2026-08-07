<template>
  <ion-app :class="theme">
    <div v-if="isOffline" class="offline-banner">
      <ion-icon :icon="cloudOfflineOutline"></ion-icon>
      <span style="margin-left: 8px;">Offline Mode - Using cached data</span>
    </div>
    
    <!-- 🟢 WhatsApp-Style Floating In-App Toast Banner -->
    <transition name="slide-down">
      <div v-if="toast.visible" class="whatsapp-toast" @click="handleToastClick">
        <div class="toast-avatar">
          <img :src="toast.icon || '/bugema-logo.png'" alt="Icon" @error="e => e.target.src = '/bugema-logo.png'" />
        </div>
        <div class="toast-content">
          <div class="toast-header">
            <span class="toast-title">{{ toast.title }}</span>
            <span class="toast-time">Just now</span>
          </div>
          <div class="toast-body">{{ toast.body }}</div>
        </div>
        <button class="toast-close" @click.stop="hideToast">✕</button>
      </div>
    </transition>

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
      cloudOfflineOutline,
      toast: {
        visible: false,
        title: '',
        body: '',
        icon: '/bugema-logo.png',
        url: '',
        timer: null
      }
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
    },
    showToast(detail) {
      if (this.toast.timer) clearTimeout(this.toast.timer);
      this.toast.title = detail.title || 'NexFi';
      this.toast.body = detail.body || '';
      this.toast.icon = detail.icon || '/bugema-logo.png';
      this.toast.url = detail.url || '';
      this.toast.visible = true;

      // Auto-hide after 5 seconds (WhatsApp style)
      this.toast.timer = setTimeout(() => {
        this.hideToast();
      }, 5000);
    },
    hideToast() {
      this.toast.visible = false;
      if (this.toast.timer) clearTimeout(this.toast.timer);
    },
    handleToastClick() {
      if (this.toast.url) {
        if (this.$router) {
          this.$router.push(this.toast.url);
        } else {
          window.location.href = this.toast.url;
        }
      }
      this.hideToast();
    }
  },
  async mounted() {
    console.log('✅ App mounted successfully');

    window.addEventListener('toast:show', (e) => {
      if (e && e.detail) {
        this.showToast(e.detail);
      }
    });
    
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
            title: `💬 ${payload.from_username || 'New Message'}`,
            message: payload.text || 'Sent you a direct message',
            type: 'message',
            url: '/messages'
          });
        }
      });

      socket.on('notification:new', (payload) => {
        notificationService.handleIncomingNotification({
          title: payload.title || 'New Notification',
          message: payload.message || 'You have a new update',
          type: payload.type || 'general',
          url: payload.url || '/tabs/notifications'
        });
      });

      socket.on('notice:new', (payload) => {
        console.log('📢 App received global notice:new event:', payload);
        notificationService.triggerNoticeNotification(payload);
      });

      socket.on('call:incoming', (payload) => {
        console.log('📞 App received call:incoming event:', payload);
        const currentUserId = localStorage.getItem('userId');
        if (payload && (payload.target_user_id == currentUserId || payload.to_user_id == currentUserId)) {
          notificationService.showWebNotification(
            `📞 Incoming Call from ${payload.caller_username || 'Someone'}`,
            `Incoming ${payload.media || 'voice'} call...`,
            '/logo.png',
            { url: `/?incomingCall=1&callId=${payload.call_id}`, ...payload },
            'call'
          );
        }
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

/* 🟢 WhatsApp-Style Floating Top Banner Notification */
.whatsapp-toast {
  position: fixed;
  top: 14px;
  left: 12px;
  right: 12px;
  max-width: 480px;
  margin: 0 auto;
  background: var(--ion-card-background, #ffffff);
  color: var(--ion-card-text, #111827);
  border: 1px solid var(--ion-border-color, #e5e7eb);
  border-radius: 16px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.28), 0 8px 10px -6px rgba(0, 0, 0, 0.12);
  z-index: 999999;
  cursor: pointer;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.slide-down-enter-active, .slide-down-leave-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease;
}
.slide-down-enter-from, .slide-down-leave-to {
  transform: translateY(-130%);
  opacity: 0;
}

.toast-avatar img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid var(--ion-border-color, #e5e7eb);
  flex-shrink: 0;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.toast-title {
  font-weight: 700;
  font-size: 14px;
  color: var(--ion-text-color, #111827);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-time {
  font-size: 11px;
  color: var(--ion-color-medium, #6b7280);
  margin-left: 6px;
  flex-shrink: 0;
}

.toast-body {
  font-size: 13px;
  color: var(--ion-color-medium, #4b5563);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-close {
  background: none;
  border: none;
  color: var(--ion-color-medium, #9ca3af);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}

.toast-close:hover {
  color: var(--ion-text-color, #111827);
}
</style>
