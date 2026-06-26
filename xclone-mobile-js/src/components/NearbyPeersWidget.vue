<template>
  <div v-if="nearbyPeers.length > 0" class="nearby-peers-widget">
    <div class="widget-header">
      <div class="header-left">
        <ion-icon :icon="flash" class="zap-icon"></ion-icon>
        <span class="widget-title">Nearby Now</span>
      </div>
      <div class="lan-active-badge">
        <span class="pulse-dot"></span>
        LAN ACTIVE
      </div>
    </div>
    
    <div class="peers-scroll">
      <div 
        v-for="peer in nearbyPeers" 
        :key="peer.userId" 
        class="peer-card"
        @click="openChat(peer)"
      >
        <div class="avatar-wrap">
          <img :src="getImageUrl(peer.profile_pic)" class="peer-avatar" alt="Avatar" />
          <div class="peer-status-ring"></div>
        </div>
        <span class="peer-name">{{ peer.username || 'Peer' }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { IonIcon } from '@ionic/vue';
import { flash } from 'ionicons/icons';
import lanService from '@/utils/lanService.js';
import api from '@/utils/api.js';

export default {
  name: 'NearbyPeersWidget',
  components: { IonIcon },
  data() {
    return {
      flash,
      nearbyPeers: [], // { userId, username, profile_pic, status }
      peerDetailsCache: {},
      myUserId: localStorage.getItem('userId'),
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
    };
  },
  methods: {
    getImageUrl(path) {
      if (!path) return this.defaultAvatar;
      if (path.startsWith('http')) return path;
      return `${api.defaults.baseURL}${path}`;
    },
    async refreshPeers() {
      const discovered = lanService.discoveredPeers;
      const newList = [];
      
      for (const [userId, info] of discovered.entries()) {
        if (userId === this.myUserId) continue;
        
        let detail = this.peerDetailsCache[userId];
        if (!detail) {
          try {
            const res = await api.get(`/api/users/profile/${userId}`);
            detail = res.data.user || { username: info.name || 'Nearby Peer', profile_pic: null };
            this.peerDetailsCache[userId] = detail;
          } catch (e) {
            detail = { username: info.name || 'Nearby Peer', profile_pic: null };
          }
        }
        
        newList.push({
          userId,
          username: detail.username,
          profile_pic: detail.profile_pic,
          ip: info.ip
        });
      }
      
      this.nearbyPeers = newList;
    },
    openChat(peer) {
      this.$router.push({
        path: '/tabs/dm',
        query: { userId: peer.userId, username: peer.username }
      });
    }
  },
  mounted() {
    this.refreshPeers();
    window.addEventListener('lan-peer-discovered', this.refreshPeers);
    
    // Periodically re-check discovered list
    this.refreshInterval = setInterval(this.refreshPeers, 10000);
  },
  beforeUnmount() {
    window.removeEventListener('lan-peer-discovered', this.refreshPeers);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }
};
</script>

<style scoped>
.nearby-peers-widget {
  margin: 16px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zap-icon {
  color: #daa520;
  font-size: 16px;
  animation: zapPulse 2s infinite;
}

.widget-title {
  font-size: 13px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.lan-active-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9px;
  font-weight: 700;
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  padding: 3px 8px;
  border-radius: 20px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
  animation: dotPulse 1.5s infinite;
}

.peers-scroll {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.peers-scroll::-webkit-scrollbar {
  display: none;
}

.peer-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.2s;
}

.peer-card:active {
  transform: scale(0.92);
}

.avatar-wrap {
  position: relative;
  width: 52px;
  height: 52px;
}

.peer-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
}

.peer-status-ring {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border: 2px solid #daa520;
  border-radius: 50%;
  opacity: 0.4;
  animation: ringRotate 10s linear infinite;
}

.peer-name {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes zapPulse {
  0% { transform: scale(1); filter: drop-shadow(0 0 2px #daa520); }
  50% { transform: scale(1.2); filter: drop-shadow(0 0 6px #daa520); }
  100% { transform: scale(1); filter: drop-shadow(0 0 2px #daa520); }
}

@keyframes dotPulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes ringRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
