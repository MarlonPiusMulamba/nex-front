<template>
  <div class="suggested-users-widget">
    <h3 class="widget-title">Who to follow</h3>
    
    <div v-if="loading" class="widget-loading">
      <ion-spinner name="crescent"></ion-spinner>
    </div>
    
    <div v-else-if="users.length === 0" class="widget-empty">
      <p>No suggestions</p>
    </div>
    
    <div v-else class="users-list">
      <div
        v-for="user in users.slice(0, 5)"
        :key="user.user_id"
        class="user-item"
      >
        <img
          :src="getImageUrl(user.profile_pic)"
          class="user-avatar"
          alt="Avatar"
          @click="goToProfile(user)"
        />
        <div class="user-info" @click="goToProfile(user)">
          <div class="user-name">{{ user.username }}</div>
          <div class="user-handle">@{{ user.username }}</div>
        </div>
        <ion-button
          size="small"
          fill="solid"
          class="follow-btn"
          @click="followUser(user)"
          :disabled="user.following"
        >
          {{ user.following ? 'Following' : 'Follow' }}
        </ion-button>
      </div>
    </div>
    
    <div v-if="users.length > 0" class="widget-footer" @click="showMore">
      <span>Show more</span>
    </div>
  </div>
</template>

<script>
import { IonSpinner, IonButton } from '@ionic/vue';
import axios from 'axios';
import config from '@/config/index.js';

export default {
  name: 'SuggestedUsersWidget',
  components: {
    IonSpinner,
    IonButton
  },
  data() {
    return {
      users: [],
      loading: false,
      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
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
    
    async loadSuggestedUsers() {
      try {
        this.loading = true;
        const res = await axios.get(`${this.API_URL}/api/search/users`, {
          params: { q: '', limit: 10 }
        });
        
        this.users = (res.data.users || [])
          .filter(u => u.user_id !== this.userId)
          .slice(0, 5)
          .map(u => ({ ...u, following: false }));
      } catch (err) {
        console.error('Failed to load suggestions:', err);
        this.users = [];
      } finally {
        this.loading = false;
      }
    },
    
    async followUser(user) {
      if (!this.userId) return;
      
      try {
        const res = await axios.post(`${this.API_URL}/api/follow`, {
          follower_id: this.userId,
          following_username: user.username
        });
        
        if (res.data.success) {
          user.following = true;
        }
      } catch (err) {
        console.error('Follow error:', err);
      }
    },
    
    goToProfile(user) {
      this.$router.push(`/tabs/profile/${user.username}`);
    },
    
    showMore() {
      this.$router.push('/tabs/follow');
    }
  },
  mounted() {
    this.loadSuggestedUsers();
  }
};
</script>

<style scoped>
.suggested-users-widget {
  background: var(--ion-background-color, #fff);
  border: 1px solid var(--ion-border-color, #eff3f4);
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 16px;
}

.widget-title {
  font-size: 20px;
  font-weight: 800;
  padding: 16px;
  margin: 0;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
  color: var(--ion-text-color, #0f1419);
}

.widget-loading,
.widget-empty {
  padding: 32px;
  text-align: center;
  color: var(--ion-color-medium, #536471);
}

.users-list {
  /* No padding, items have their own */
}

.user-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
  transition: background-color 0.2s;
}

.user-item:last-child {
  border-bottom: none;
}

.user-item:hover {
  background-color: var(--ion-color-light, #f7f9f9);
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.user-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--ion-text-color, #0f1419);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-handle {
  font-size: 14px;
  color: var(--ion-color-medium, #536471);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.follow-btn {
  --border-radius: 20px;
  height: 32px;
  font-size: 14px;
  font-weight: 700;
  min-width: 80px;
  flex-shrink: 0;
}

.widget-footer {
  padding: 16px;
  color: var(--ion-color-primary, #1d9bf0);
  font-size: 15px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.widget-footer:hover {
  background-color: var(--ion-color-light, #f7f9f9);
}
</style>
