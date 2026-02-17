<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="goBack">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div v-if="loading" class="loading-container">
        <ion-spinner></ion-spinner>
      </div>

      <div v-else-if="users.length === 0" class="empty-state">
        <ion-icon :icon="peopleOutline" class="empty-icon"></ion-icon>
        <p>No {{ type }} yet</p>
      </div>

      <div v-else class="users-list">
        <div 
          v-for="user in users" 
          :key="user.user_id"
          class="user-item"
          @click="viewProfile(user.username)">
          <img :src="getImageUrl(user.profile_pic)" class="user-avatar" alt="Avatar" />
          <div class="user-info">
            <div class="user-name">{{ user.full_name || user.username }}</div>
            <div class="user-handle">@{{ user.username }}</div>
            <div v-if="user.bio" class="user-bio">{{ user.bio }}</div>
          </div>
          
          <div class="action-section" @click.stop>
            <!-- Following Page Logic -->
            <template v-if="type === 'following'">
              <div v-if="user.is_following" class="button-group">
                <ion-button 
                  size="small" 
                  fill="solid" 
                  disabled
                  class="status-btn">
                  Following
                </ion-button>
                <ion-button 
                  size="small" 
                  fill="outline" 
                  color="danger"
                  @click="handleUnfollow(user)"
                  :disabled="user.loading"
                  class="action-btn">
                  <ion-spinner v-if="user.loading" name="crescent"></ion-spinner>
                  <span v-else>Unfollow</span>
                </ion-button>
              </div>
              <ion-button 
                v-else
                size="small" 
                fill="outline"
                @click="handleFollow(user)"
                :disabled="user.loading"
                class="action-btn">
                <ion-spinner v-if="user.loading" name="crescent"></ion-spinner>
                <span v-else>Follow</span>
              </ion-button>
            </template>

            <!-- Followers Page Logic -->
            <template v-else-if="type === 'followers'">
              <ion-button 
                v-if="user.is_following"
                size="small" 
                fill="solid" 
                disabled
                class="status-btn">
                You follow
              </ion-button>
              <ion-button 
                v-else
                size="small" 
                fill="outline"
                @click="handleFollow(user)"
                :disabled="user.loading"
                class="action-btn">
                <ion-spinner v-if="user.loading" name="crescent"></ion-spinner>
                <span v-else>Follow back</span>
              </ion-button>
            </template>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script>
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonButtons, IonIcon, IonSpinner
} from '@ionic/vue';
import { arrowBack, peopleOutline } from 'ionicons/icons';
import api from '@/utils/api';
import config from '@/config/index.js';

export default {
  name: 'UserFollowListPage',
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
    IonButton, IonButtons, IonIcon, IonSpinner
  },
  data() {
    return {
      users: [],
      loading: true,
      currentUserId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL,
      arrowBack,
      peopleOutline,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
    };
  },
  computed: {
    username() {
      return this.$route.params.username;
    },
    type() {
      return this.$route.meta.type || 'followers';
    },
    pageTitle() {
      if (this.type === 'followers') return 'Followers';
      if (this.type === 'following') return 'Following';
      return 'Users';
    }
  },
  async mounted() {
    console.log(`🚀 [UserFollowListPage] Mounted for @${this.username} (${this.type})`);
    await this.fetchUsers();
  },
  // Ionic life cycle hook
  async ionViewWillEnter() {
    console.log(`📍 [UserFollowListPage] Entering for @${this.username} (${this.type})`);
    if (!this.users.length || this.loading) {
      await this.fetchUsers();
    }
  },
  methods: {
    async fetchUsers() {
      if (!this.username) {
        console.error('❌ [UserFollowListPage] No username found in route params');
        this.loading = false;
        return;
      }

      this.loading = true;
      try {
        const endpoint = `/api/profile/${this.username}/${this.type}`;
        console.log(`🌐 [UserFollowListPage] Calling API: ${endpoint}`, { viewer_id: this.currentUserId });
        
        const res = await api.get(endpoint, {
          params: { viewer_id: this.currentUserId }
        });
        
        console.log(`✅ [UserFollowListPage] API Response for ${this.type}:`, {
          success: res.success,
          count: res.users?.length,
          data: res
        });

        if (res.success) {
          this.users = (res.users || []).map(u => ({ ...u, loading: false }));
        } else {
          console.error(`❌ [UserFollowListPage] API Error:`, res.error || res.message);
          this.users = [];
        }
      } catch (err) {
        console.error(`❌ [UserFollowListPage] Fetching failed:`, err);
        this.users = [];
      } finally {
        this.loading = false;
      }
    },
    getImageUrl(imageData) {
      if (!imageData || imageData === '') return this.defaultAvatar;
      if (typeof imageData !== 'string') return this.defaultAvatar;
      if (imageData.startsWith('http')) return imageData;
      if (imageData.startsWith('data:image')) return imageData;
      if (imageData.startsWith('/static/')) return `${this.API_URL}${imageData}`;
      return `data:image/png;base64,${imageData}`;
    },
    viewProfile(username) {
      this.$router.push(`/tabs/profile/${username}`);
    },
    goBack() {
      this.$router.back();
    },
    async handleFollow(user) {
      if (user.loading) return;
      user.loading = true;
      try {
        const res = await api.post('/api/follow', {
          follower_id: this.currentUserId,
          following_username: user.username
        });
        if (res.success) {
          user.is_following = true;
        }
      } catch (err) {
        console.error('Follow error:', err);
      } finally {
        user.loading = false;
      }
    },
    async handleUnfollow(user) {
      if (user.loading) return;
      user.loading = true;
      try {
        const res = await api.post('/api/unfollow', {
          follower_id: this.currentUserId,
          following_username: user.username
        });
        if (res.success) {
          user.is_following = false;
        }
      } catch (err) {
        console.error('Unfollow error:', err);
      } finally {
        user.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 300px;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.users-list {
  padding-bottom: 50px;
}

.user-item {
  display: flex;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-border-color, #e5e7eb);
  cursor: pointer;
  align-items: flex-start;
}

.user-item:active {
  background-color: rgba(0, 0, 0, 0.05);
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.user-info {
  flex-grow: 1;
  margin: 0 12px;
  min-width: 0;
}

.user-name {
  font-weight: 800;
  font-size: 16px;
  color: var(--ion-text-color, #0f1419);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-handle {
  font-size: 14px;
  color: var(--ion-color-medium, #536471);
  margin-bottom: 4px;
}

.user-bio {
  font-size: 14px;
  color: var(--ion-text-color, #0f1419);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.action-section {
  flex-shrink: 0;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}

.status-btn {
  --background: var(--ion-color-light);
  --color: var(--ion-color-medium);
  font-size: 11px;
  height: 24px;
  margin: 0;
  --padding-start: 8px;
  --padding-end: 8px;
}

.action-btn {
  margin: 0;
  font-weight: 700;
}
</style>
