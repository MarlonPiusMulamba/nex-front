<template>
  <ion-page>
    <div class="desktop-layout" :class="{ 'full-width-layout': isStandaloneNotice }">
      <!-- Left Sidebar (Desktop/Tablet only) -->
      <aside class="left-sidebar desktop-only" v-if="!isStandaloneNotice">
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

          <router-link to="/tabs/notices" class="nav-item">
            <ion-icon :icon="megaphoneOutline" class="nav-icon"></ion-icon>
            <span class="nav-label">Notices</span>
            <span v-if="unreadNoticeCount > 0" class="nav-badge">{{ unreadNoticeCount }}</span>
          </router-link>

          <router-link to="/tabs/follow" class="nav-item">
            <ion-icon :icon="search" class="nav-icon"></ion-icon>
            <span class="nav-label">Search</span>
          </router-link>

          <router-link to="/tabs/videos" class="nav-item">
            <ion-icon :icon="playCircleOutline" class="nav-icon"></ion-icon>
            <span class="nav-label">Videos</span>
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

          <router-link to="/tabs/fraternity" class="nav-item">
            <ion-icon :icon="shieldOutline" class="nav-icon"></ion-icon>
            <span class="nav-label">Fraternity</span>
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
      <main class="main-content" :class="{ 'standalone-main': isStandaloneNotice }">
        <ion-tabs>
          <ion-router-outlet></ion-router-outlet>
          
          <!-- Bottom Tab Bar (Mobile only) -->
          <ion-tab-bar slot="bottom" class="mobile-tab-bar mobile-only" v-if="!isStandaloneNotice">
            <ion-tab-button tab="feed" href="/tabs/feed" class="tab-btn">
              <ion-icon :icon="home"></ion-icon>
              <ion-label class="tab-lbl">Home</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="notices" href="/tabs/notices" class="tab-btn">
              <ion-icon :icon="megaphoneOutline"></ion-icon>
              <ion-badge v-if="unreadNoticeCount > 0" class="notif-badge">{{ unreadNoticeCount }}</ion-badge>
              <ion-label class="tab-lbl">Notices</ion-label>
            </ion-tab-button>
            
            <ion-tab-button tab="follow" href="/tabs/follow" class="tab-btn">
              <ion-icon :icon="search"></ion-icon>
              <ion-label class="tab-lbl">Search</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="videos" href="/tabs/videos" class="tab-btn">
              <ion-icon :icon="playCircleOutline"></ion-icon>
              <ion-label class="tab-lbl">Videos</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="dm" href="/tabs/dm" class="tab-btn">
              <ion-icon :icon="mail"></ion-icon>
              <ion-badge v-if="unreadCount > 0" class="dm-badge">{{ unreadCount }}</ion-badge>
              <ion-label class="tab-lbl">DM</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="notifications" href="/tabs/notifications" class="tab-btn">
              <ion-icon :icon="notificationsOutline"></ion-icon>
              <ion-badge v-if="unreadNotifCount > 0" class="notif-badge">{{ unreadNotifCount }}</ion-badge>
              <ion-label class="tab-lbl">Alerts</ion-label>
            </ion-tab-button>
            
            <ion-tab-button tab="profile" href="/tabs/profile" class="tab-btn">
              <ion-icon :icon="person"></ion-icon>
              <ion-label class="tab-lbl">Profile</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="fraternity" href="/tabs/fraternity" class="tab-btn">
              <ion-icon :icon="shieldOutline"></ion-icon>
              <ion-label class="tab-lbl">Club</ion-label>
            </ion-tab-button>

          </ion-tab-bar>
        </ion-tabs>

        <!-- Mobile Floating Post Button (hidden on notice board pages) -->
        <ion-fab slot="fixed" vertical="bottom" horizontal="end" class="mobile-only"
          style="margin-bottom: 70px; margin-right: 8px; z-index: 99999;"
          v-if="!hideGlobalFab && !isStandaloneNotice"
        >
          <ion-fab-button class="gold-fab" @click="triggerGlobalPost">
            <ion-icon :icon="add" class="post-icon" style="font-size: 32px; font-weight: bold; color: black;"></ion-icon>
          </ion-fab-button>
        </ion-fab>
      </main>


      <!-- Right Sidebar (Desktop only) -->
      <aside class="right-sidebar desktop-only" v-if="!isStandaloneNotice">
        <NoticeWidget />
        <TrendingWidget />
        <SuggestedUsersWidget />
      </aside>
    </div>

    <PostTypeSelectorModal 
      v-model:isOpen="showTypeSelector"
      @select="handleTypeSelect"
    />

    <PostComposerModal 
      v-model:isOpen="showPostModal" 
      :userId="userId || ''" 
      :userAvatar="userAvatar || ''"
      :initialType="selectedPostType"
      :targetFraternity="targetFraternity"
      @post-created="handlePostCreated"
    />
  </ion-page>
</template>

<script>

import { 
  IonPage, IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, 
  IonIcon, IonLabel, IonBadge, IonFab, IonFabButton 
} from '@ionic/vue';
import { home, search, mail, person, notificationsOutline, logoTwitter, logOutOutline, add, shieldOutline, playCircleOutline, megaphoneOutline } from 'ionicons/icons';
import axios from 'axios';
import config from '@/config/index.js';
import TrendingWidget from '@/components/TrendingWidget.vue';
import SuggestedUsersWidget from '@/components/SuggestedUsersWidget.vue';
import NoticeWidget from '@/components/NoticeWidget.vue';
import notificationService from '@/utils/notificationService.js';
import PostComposerModal from '@/components/PostComposerModal.vue';
import PostTypeSelectorModal from '@/components/PostTypeSelectorModal.vue';

export default {
  name: 'TabsPage',
  components: { 
    IonPage, IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, 
    IonIcon, IonLabel, IonBadge, IonFab, IonFabButton,
    TrendingWidget,
    SuggestedUsersWidget,
    NoticeWidget,
    PostComposerModal,
    PostTypeSelectorModal
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
      add,
      shieldOutline,
      playCircleOutline,
      megaphoneOutline,
      unreadCount: 0,
      prevUnreadCount: 0,
      unreadNotifCount: 0,
      prevUnreadNotifCount: 0,
      unreadNoticeCount: 0,
      userId: localStorage.getItem('userId'),
      username: localStorage.getItem('username'),
      userAvatar: localStorage.getItem('userAvatar') || '',
      API_URL: config.api.baseURL,
      pollInterval: null,
      notifPollInterval: null,
      audioCtx: null,
      audioUnlocked: false,
      _unlockAudio: null,
      showPostModal: false,
      showTypeSelector: false,
      selectedPostType: 'text',
      targetFraternity: null,
      hideGlobalFab: false,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
    };
  },
  watch: {
    $route(to) {
      // Hide the global post FAB on specific notice board pages
      this.hideGlobalFab = /^\/tabs\/notices\/.+/.test(to.path) || /^\/notices\/.+/.test(to.path);
    }
  },
  computed: {
    isStandaloneNotice() {
      const path = this.$route?.path || '';
      return /^\/tabs\/notices\/.+/.test(path) || /^\/notices\/.+/.test(path);
    }
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
      // Use the global notification service to play the msg-ton.mp3
      notificationService.playSound();
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
    },

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

    async fetchUnreadNoticeCount() {
      if (!this.userId) return;
      try {
        const res = await axios.get(`${this.API_URL}/api/boards/unread-count`, {
          params: { user_id: this.userId }
        });
        this.unreadNoticeCount = res.data?.count || 0;
      } catch (err) {
        console.error('Failed to fetch unread notices count:', err);
      }
    },
    
    triggerGlobalPost() {
      // Open selector first
      this.showTypeSelector = true;
    },

    handleTypeSelect(type) {
      this.selectedPostType = type;
      // Small delay to let selector close smoothly
      setTimeout(() => {
        this.showPostModal = true;
      }, 300);
    },

    handlePostCreated() {
      // Refresh feed if active
      // Socket should handle this, but explicit refresh helps
      window.dispatchEvent(new CustomEvent('feed-refresh'));
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
    // Set FAB visibility based on initial route
    this.hideGlobalFab = /^\/tabs\/notices\/.+/.test(this.$route?.path || '');

    // Fetch unread count immediately
    this.fetchUnreadCount();
    this.fetchUnreadNotifCount();
    this.fetchUnreadNoticeCount();
    
    // Listen for custom events to refresh count
    window.addEventListener('dm-refresh', this.fetchUnreadCount);
    window.addEventListener('notifications-refresh', this.fetchUnreadNotifCount);

    window.addEventListener('open-post-composer', (e) => {
      this.targetFraternity = null;
      if (e.detail && e.detail.fraternity_id) {
        this.targetFraternity = {
          id: e.detail.fraternity_id,
          name: e.detail.fraternity_name
        };
      }
      this.selectedPostType = 'text';
      this.showPostModal = true;
    });

    // Initial unread-update listener for more direct count updates
    window.addEventListener('unread-update', (e) => {
      const data = e.detail;
      if (data) {
        if (data.unread_messages !== undefined) this.unreadCount = data.unread_messages;
        if (data.unread_notifications !== undefined) this.unreadNotifCount = data.unread_notifications;
      }
    });

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
        this.fetchUnreadNoticeCount();
      }
    };
    this._onFocus = () => {
      this.fetchUnreadCount();
      this.fetchUnreadNotifCount();
      this.fetchUnreadNoticeCount();
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('focus', this._onFocus);

    // Socket listeners for real-time notice count
    if (window.appSocket) {
      window.appSocket.on('notice:new', () => {
        this.fetchUnreadNoticeCount();
        this.playNotificationSound();
      });
    }

    // Listen for global post trigger
    window.addEventListener('open-post-modal', this.triggerGlobalPost);
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
    window.removeEventListener('open-post-modal', this.triggerGlobalPost);
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

/* ─── Mobile Tab Bar ──────────────────────────────────────── */
.mobile-tab-bar {
  --background: #ffffff;
  --border: 0 none;
  box-shadow: 0 -1px 0 rgba(0,0,0,0.07), 0 -4px 16px rgba(0,0,0,0.06);
}

/* Each tab button — force equal width so all 8 fit */
.tab-btn {
  --padding-top: 6px;
  --padding-bottom: 6px;
  min-width: 0;
  flex: 1 1 0;
  max-width: none;
}

.tab-btn ion-icon {
  font-size: 22px;
}

/* Labels shown normally when there's room */
.tab-lbl {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.2px;
  margin-top: 2px;
}

/* On very small screens hide labels entirely so icons all fit */
@media (max-width: 400px) {
  .tab-btn {
    --padding-top: 8px;
    --padding-bottom: 8px;
  }
  .tab-lbl {
    display: none !important;
  }
  .tab-btn ion-icon {
    font-size: 20px;
  }
}

/* Badge styles for mobile tabs */
.dm-badge,
.notif-badge {
  position: absolute;
  top: 4px;
  right: calc(50% - 18px);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  animation: badgePulse 2s infinite ease-in-out;
}

.gold-fab {
  --background: gold;
  --background-activated: #e6c200;
  --background-focused: #e6c200;
  --background-hover: #e6c200;
  --color: #000;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}

.post-icon {
  font-size: 32px;
  font-weight: bold;
}

@keyframes badgePulse {
  0%   { transform: scale(1);    box-shadow: 0 0 0 0   rgba(239, 68, 68, 0.4); }
  70%  { transform: scale(1.08); box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);   }
  100% { transform: scale(1);    box-shadow: 0 0 0 0   rgba(239, 68, 68, 0);   }
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