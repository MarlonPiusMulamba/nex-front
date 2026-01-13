<template>
  <ion-page>
    <div class="desktop-layout">
      <!-- Left Sidebar (Desktop/Tablet only) -->
      <aside class="left-sidebar desktop-only">
        <!-- Logo -->
        <div class="sidebar-logo">
          <img src="/logo.png" alt="NexFi" class="sidebar-logo-img" />
        </div>

        <!-- Navigation -->
        <nav class="sidebar-nav">
          <router-link to="/tabs/feed" class="nav-item">
            <ion-icon :icon="home" class="nav-icon"></ion-icon>
            <span class="nav-label">Home</span>
          </router-link>

          <router-link to="/tabs/follow" class="nav-item">
            <ion-icon :icon="search" class="nav-icon"></ion-icon>
            <span class="nav-label">Search</span>
          </router-link>

          <router-link to="/tabs/dm" class="nav-item">
            <ion-icon :icon="mail" class="nav-icon"></ion-icon>
            <span class="nav-label">Messages</span>
            <span v-if="unreadCount > 0" class="nav-badge">{{ unreadCount }}</span>
          </router-link>

          <router-link to="/tabs/notifications" class="nav-item">
            <ion-icon :icon="notificationsOutline" class="nav-icon"></ion-icon>
            <span class="nav-label">Alerts</span>
            <span v-if="unreadNotifCount > 0" class="nav-badge">{{ unreadNotifCount }}</span>
          </router-link>

          <router-link to="/tabs/profile" class="nav-item">
            <ion-icon :icon="person" class="nav-icon"></ion-icon>
            <span class="nav-label">Profile</span>
          </router-link>

          <!-- Logout Button (Desktop only) -->
          <div class="nav-item logout-item" @click="logout">
            <ion-icon :icon="logOutOutline" class="nav-icon"></ion-icon>
            <span class="nav-label">Logout</span>
          </div>

          <!-- Post Button (Desktop only) -->
          <button class="sidebar-post-button" @click="triggerGlobalPost">
            Post
          </button>
        </nav>

        <!-- Profile Button -->
        <div class="sidebar-profile" @click="goToProfile">
          <img :src="userAvatar || defaultAvatar" class="sidebar-profile-avatar" alt="Profile" />
          <div class="sidebar-profile-info">
            <div class="sidebar-profile-name">{{ username || 'User' }}</div>
            <div class="sidebar-profile-handle">@{{ username || 'user' }}</div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <ion-tabs>
          <ion-router-outlet></ion-router-outlet>
          
          <!-- Bottom Tab Bar (Mobile only) -->
          <ion-tab-bar slot="bottom" class="mobile-tab-bar mobile-only">
            <ion-tab-button tab="feed" href="/tabs/feed">
              <ion-icon :icon="home"></ion-icon>
              <ion-label>Home</ion-label>
            </ion-tab-button>
            
            <ion-tab-button tab="follow" href="/tabs/follow">
              <ion-icon :icon="search"></ion-icon>
              <ion-label>Search</ion-label>
            </ion-tab-button>
            
            <ion-tab-button tab="dm" href="/tabs/dm">
              <ion-icon :icon="mail"></ion-icon>
              <ion-badge v-if="unreadCount > 0" class="dm-badge">{{ unreadCount }}</ion-badge>
              <ion-label>DM</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="notifications" href="/tabs/notifications">
              <ion-icon :icon="notificationsOutline"></ion-icon>
              <ion-badge v-if="unreadNotifCount > 0" class="notif-badge">{{ unreadNotifCount }}</ion-badge>
              <ion-label>Alerts</ion-label>
            </ion-tab-button>
            
            <ion-tab-button tab="profile" href="/tabs/profile">
              <ion-icon :icon="person"></ion-icon>
              <ion-label>Profile</ion-label>
            </ion-tab-button>
          </ion-tab-bar>
        </ion-tabs>
      </main>

      <!-- Right Sidebar (Desktop only) -->
      <aside class="right-sidebar desktop-only">
        <TrendingWidget />
        <SuggestedUsersWidget />
      </aside>
    </div>
  </ion-page>
</template>

<script>

import { 
  IonPage, IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, 
  IonIcon, IonLabel, IonBadge 
} from '@ionic/vue';
import { home, search, mail, person, notificationsOutline, logoTwitter, logOutOutline } from 'ionicons/icons';
import axios from 'axios';
import config from '@/config/index.js';
import TrendingWidget from '@/components/TrendingWidget.vue';
import SuggestedUsersWidget from '@/components/SuggestedUsersWidget.vue';

export default {
  name: 'TabsPage',
  components: { 
    IonPage, IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, 
    IonIcon, IonLabel, IonBadge,
    TrendingWidget,
    SuggestedUsersWidget
  },
  data() {
    return {
      home, 
      search, 
      mail, 
      notificationsOutline,
      person,
      logoTwitter,
      logOutOutline,
      unreadCount: 0,
      prevUnreadCount: 0,
      unreadNotifCount: 0,
      prevUnreadNotifCount: 0,
      userId: localStorage.getItem('userId'),
      username: localStorage.getItem('username'),
      userAvatar: localStorage.getItem('userAvatar') || '',
      API_URL: config.api.baseURL,
      pollInterval: null,
      notifPollInterval: null,
      audioCtx: null,
      audioUnlocked: false,
      _unlockAudio: null,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
    };
  },
  methods: {
    async unlockAudio() {
      try {
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
        this.audioUnlocked = true;
      } catch (_) {
        this.audioUnlocked = false;
      }
    },

    playNotificationSound() {
      if (!this.audioUnlocked) return;
      if (!this.audioCtx) return;
      try {
        const ctx = this.audioCtx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(880, ctx.currentTime);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.2);
      } catch (_) {}
    },

    async fetchUnreadCount() {
      if (!this.userId) return;
      
      try {
        const res = await axios.get(`${this.API_URL}/api/conversations`, {
          params: { user_id: this.userId }
        });
        
        if (res.data.conversations) {
          // Sum up all unread counts from conversations
          const nextCount = res.data.conversations.reduce(
            (total, conv) => total + (conv.unread_count || 0), 
            0
          );

          if (nextCount > this.prevUnreadCount) {
            this.playNotificationSound();
          }

          this.unreadCount = nextCount;
          this.prevUnreadCount = nextCount;
        }
      } catch (err) {
        console.error('Failed to fetch unread count:', err);
      }
    }

    ,

    async fetchUnreadNotifCount() {
      if (!this.userId) return;
      try {
        const res = await axios.get(`${this.API_URL}/api/notifications/unread_count`, {
          params: { user_id: this.userId }
        });
        const nextCount = res.data?.count || 0;

        if (nextCount > this.prevUnreadNotifCount) {
          this.playNotificationSound();
        }

        this.unreadNotifCount = nextCount;
        this.prevUnreadNotifCount = nextCount;
      } catch (err) {
        console.error('Failed to fetch unread notifications count:', err);
      }
    },
    
    triggerGlobalPost() {
      // Dispatch a global event to open the post modal
      window.dispatchEvent(new CustomEvent('open-post-modal'));
    },

    goToProfile() {
      this.$router.push('/tabs/profile');
    },

    logout() {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userAvatar');
        window.location.href = '/login';
      }
    }
  },
  mounted() {
    // Fetch unread count immediately
    this.fetchUnreadCount();
    this.fetchUnreadNotifCount();
    
    // Poll for updates every 5 seconds
    this.pollInterval = setInterval(() => {
      this.fetchUnreadCount();
    }, 5000);

    this.notifPollInterval = setInterval(() => {
      this.fetchUnreadNotifCount();
    }, 5000);
    
    // Listen for custom events to refresh count
    window.addEventListener('dm-refresh', this.fetchUnreadCount);
    window.addEventListener('notifications-refresh', this.fetchUnreadNotifCount);

    // Unlock audio on first user interaction (autoplay policies)
    this._unlockAudio = async () => {
      await this.unlockAudio();
      if (this.audioUnlocked) {
        window.removeEventListener('click', this._unlockAudio);
        window.removeEventListener('touchstart', this._unlockAudio);
        window.removeEventListener('keydown', this._unlockAudio);
      }
    };
    window.addEventListener('click', this._unlockAudio);
    window.addEventListener('touchstart', this._unlockAudio);
    window.addEventListener('keydown', this._unlockAudio);

    // Refresh when tab becomes visible/focused
    this._onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this.fetchUnreadCount();
        this.fetchUnreadNotifCount();
      }
    };
    this._onFocus = () => {
      this.fetchUnreadCount();
      this.fetchUnreadNotifCount();
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('focus', this._onFocus);
  },
  beforeUnmount() {
    // Clean up interval and event listener
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.notifPollInterval) {
      clearInterval(this.notifPollInterval);
    }
    window.removeEventListener('dm-refresh', this.fetchUnreadCount);
    window.removeEventListener('notifications-refresh', this.fetchUnreadNotifCount);

    if (this._unlockAudio) {
      window.removeEventListener('click', this._unlockAudio);
      window.removeEventListener('touchstart', this._unlockAudio);
      window.removeEventListener('keydown', this._unlockAudio);
      this._unlockAudio = null;
    }

    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch (_) {}
      this.audioCtx = null;
      this.audioUnlocked = false;
    }

    if (this._onVisibilityChange) document.removeEventListener('visibilitychange', this._onVisibilityChange);
    if (this._onFocus) window.removeEventListener('focus', this._onFocus);
  }
};
</script>

<style scoped>
/* Ensure ion-page takes full height */
ion-page {
  height: 100vh;
  overflow: hidden;
}

/* Desktop layout container */
.desktop-layout {
  height: 100%;
  width: 100%;
}

/* Badge styles for mobile tabs */
.dm-badge {
  position: absolute;
  top: 4px;
  right: calc(50% - 20px);
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.notif-badge {
  position: absolute;
  top: 4px;
  right: calc(50% - 20px);
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

/* Ensure main content doesn't overflow on desktop */
@media (min-width: 768px) {
  .main-content {
    overflow: hidden;
  }

  .main-content ion-tabs {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .main-content ion-router-outlet {
    flex: 1;
    overflow-y: auto;
  }
}
</style>