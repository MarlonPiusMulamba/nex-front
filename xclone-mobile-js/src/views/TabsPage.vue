<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-tab-bar slot="bottom">
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
  </ion-page>
</template>

<script>

import { 
  IonPage, IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, 
  IonIcon, IonLabel, IonBadge 
} from '@ionic/vue';
import { home, search, mail, person, notificationsOutline } from 'ionicons/icons';
import axios from 'axios';

export default {
  name: 'TabsPage',
  components: { 
    IonPage, IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, 
    IonIcon, IonLabel, IonBadge 
  },
  data() {
    return {
      home, 
      search, 
      mail, 
      notificationsOutline,
      person,
      unreadCount: 0,
      prevUnreadCount: 0,
      unreadNotifCount: 0,
      prevUnreadNotifCount: 0,
      userId: localStorage.getItem('userId'),
      API_URL: 'http://localhost:5000',
      pollInterval: null,
      notifPollInterval: null,
      audioCtx: null,
      audioUnlocked: false,
      _unlockAudio: null
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
</style>