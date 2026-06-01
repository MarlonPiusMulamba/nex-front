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
        <div class="user-main-row">
          <img
            :src="getImageUrl(user.profile_pic)"
            class="user-avatar"
            alt="Avatar"
            @click="goToProfile(user)"
          />
          <div class="user-info" @click="goToProfile(user)">
            <div class="user-name-row">
              <span class="user-name">{{ user.display_name }}</span>
              <VerificationBadge v-if="user.verification_tier && user.verification_tier !== 'none'" :tier="user.verification_tier" />
            </div>
            <div class="user-handle">@{{ user.username }}</div>
          </div>
          <ion-button
            size="small"
            fill="solid"
            class="follow-btn"
            @click="followUser(user)"
            :disabled="user.following || user.followLoading"
          >
            <ion-spinner v-if="user.followLoading" name="crescent"></ion-spinner>
            <template v-else>
              {{ user.following ? 'Following' : 'Follow' }}
            </template>
          </ion-button>
        </div>

        <div v-if="user.bio" class="user-bio line-clamp-1" @click="goToProfile(user)">
          {{ user.bio }}
        </div>

        <div class="user-stats">
          <span v-if="user.followers_count > 0" class="stat-badge">
            {{ formatCount(user.followers_count) }} followers
          </span>
          <span v-if="user.mutual_username" class="mutual-follow">
             Followed by @{{ user.mutual_username }}
          </span>
        </div>
      </div>
    </div>
    
    <div v-if="users.length > 0" class="widget-footer" @click="showMore">
      <span>Show more</span>
    </div>
  </div>
</template>

<script>
import { IonSpinner, IonButton } from '@ionic/vue';
import api from '@/utils/api';
import config from '@/config/index.js';

export default {
  name: 'SuggestedUsersWidget',
  components: {
    IonSpinner,
    IonButton,
    VerificationBadge: () => import('@/components/VerificationBadge.vue')
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
        const res = await api.get('/api/users/suggested', {
          params: { limit: 10, user_id: this.userId }
        });
        
        this.users = (res.users || [])
          .map(u => ({ 
            ...u, 
            user_id: u.id, // backend mapping
            following: !!u.is_following,
            followLoading: false
          }));
      } catch (err) {
        console.error('Failed to load suggestions:', err);
      } finally {
        this.loading = false;
      }
    },
    
    async followUser(user) {
      if (!this.userId || user.followLoading) return;
      
      try {
        user.followLoading = true;
        const res = await api.post('/api/follow', {
          follower_id: this.userId,
          following_username: user.username
        });
        
        if (res.success) {
          user.following = true;
        }
      } catch (err) {
        console.error('Follow error:', err);
      } finally {
        user.followLoading = false;
      }
    },
    
    goToProfile(user) {
      this.$router.push(`/tabs/profile/${user.username}`);
    },
    
    showMore() {
      this.$router.push('/tabs/follow');
    },
    
    formatCount(n) {
      if (!n) return '0';
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return String(n);
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
  flex-direction: column;
  padding: 12px 16px;
  gap: 8px;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
  transition: all 0.2s ease;
}

.user-item:last-child {
  border-bottom: none;
}

.user-item:hover {
  background-color: var(--ion-color-light, #f7f9f9);
}

.user-main-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer;
  flex-shrink: 0;
  border: 1px solid var(--ion-border-color, #eff3f4);
}

.user-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 4px;
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

.user-bio {
  font-size: 13px;
  color: var(--ion-text-color, #0f1419);
  line-height: 1.3;
  margin-left: 56px; /* Align with info */
  cursor: pointer;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.user-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 56px;
  flex-wrap: wrap;
}

.stat-badge {
  font-size: 12px;
  color: var(--ion-color-medium, #536471);
  font-weight: 500;
}

.mutual-follow {
  font-size: 11px;
  color: var(--ion-color-primary, #daa520);
  background: rgba(218, 165, 32, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
}

.follow-btn {
  --border-radius: 20px;
  height: 32px;
  font-size: 13px;
  font-weight: 700;
  min-width: 76px;
  flex-shrink: 0;
  --background: var(--ion-text-color, #0f1419);
  --color: var(--ion-background-color, #fff);
  margin: 0;
}

.follow-btn[disabled] {
  opacity: 0.6;
}

.widget-footer {
  padding: 16px;
  color: var(--ion-color-primary, #daa520);
  font-size: 15px;
  cursor: pointer;
  transition: background-color 0.2s;
  text-align: center;
}

.widget-footer:hover {
  background-color: var(--ion-color-light, #f7f9f9);
}
</style>
