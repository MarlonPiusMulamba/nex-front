<template>
  <ion-page>
    <!-- Search View -->
    <div v-if="!selectedUser">
      <ion-header class="ion-no-border">
        <ion-toolbar>
          <ion-title>Search</ion-title>
        </ion-toolbar>
        <ion-toolbar>
          <ion-searchbar
            v-model="searchQuery"
            placeholder="Search users or topics..."
            @ionInput="handleSearch"
            :debounce="300"
            show-clear-button="focus">
          </ion-searchbar>
        </ion-toolbar>
        <ion-toolbar v-if="searchQuery.length >= 2">
          <ion-segment v-model="searchTab" mode="md">
            <ion-segment-button value="top">
              <ion-label>All</ion-label>
            </ion-segment-button>
            <ion-segment-button value="people">
              <ion-label>People</ion-label>
            </ion-segment-button>
            <ion-segment-button value="posts">
              <ion-label>Posts</ion-label>
            </ion-segment-button>
          </ion-segment>
        </ion-toolbar>
      </ion-header>

      <ion-content :fullscreen="true">
        <!-- Trending + Suggestions -->
        <div v-if="!searchQuery" class="suggestions-container">
          <h3 class="section-title">Trending</h3>

          <div v-if="loadingTrending" class="loading-container">
            <ion-spinner></ion-spinner>
          </div>

          <div v-else>
            <div
              v-for="t in trendingTopics"
              :key="t.type + '_' + t.topic"
              class="trend-item"
              @click="onTrendingClick(t)"
            >
              <div class="trend-topic">{{ formatTrendLabel(t) }}</div>
              <div class="trend-count">{{ t.count }} posts</div>
            </div>

            <h3 class="section-title" style="margin-top: 20px;">Suggested Users</h3>
            <div 
              v-for="user in suggestedUsers" 
              :key="user.user_id"
              class="user-item"
              @click="viewProfile(user)">
              <img :src="getImageUrl(user.profile_pic)" class="user-avatar" alt="Avatar" />
              <div class="user-info">
                <div class="user-name">{{ user.username }}</div>
                <div class="user-handle">@{{ user.username }}</div>
              </div>
              <ion-button 
                size="small" 
                :fill="user.is_following ? 'solid' : 'outline'" 
                @click.stop="quickFollow(user)"
                :disabled="user.followLoading"
                class="follow-btn">
                <ion-spinner v-if="user.followLoading" name="crescent"></ion-spinner>
                <template v-else>
                  {{ user.is_following ? 'Following' : 'Follow' }}
                </template>
              </ion-button>
            </div>
          </div>
        </div>

        <!-- Search Results -->
        <div v-else-if="searchQuery.length >= 2">
          <div v-if="searching" class="loading-container">
            <ion-spinner></ion-spinner>
          </div>

          <div class="results-container">
            <!-- Users Section -->
            <div v-if="(searchTab === 'top' || searchTab === 'people') && searchResults.length > 0">
              <h3 class="section-title" v-if="searchTab === 'top'">Users</h3>
              <div 
                v-for="user in searchResults" 
                :key="user.user_id"
                class="user-item"
                @click="viewProfile(user)">
                <img :src="getImageUrl(user.profile_pic)" class="user-avatar" alt="Avatar" />
                <div class="user-info">
                  <div class="user-name">{{ user.full_name || user.username }}</div>
                  <div class="user-handle">@{{ user.username }}</div>
                </div>
                <ion-button 
                  size="small" 
                  :fill="user.is_following ? 'solid' : 'outline'" 
                  @click.stop="quickFollow(user)"
                  :disabled="user.followLoading"
                  class="follow-btn">
                  <ion-spinner v-if="user.followLoading" name="crescent"></ion-spinner>
                  <template v-else>
                    {{ user.is_following ? 'Following' : 'Follow' }}
                  </template>
                </ion-button>
              </div>
            </div>

            <!-- Posts Section -->
            <div v-if="(searchTab === 'top' || searchTab === 'posts') && postResults.length > 0" :style="{ marginTop: (searchTab === 'top' && searchResults.length > 0) ? '24px' : '0' }">
              <h3 class="section-title" v-if="searchTab === 'top'">Posts</h3>
              <div v-for="post in postResults" :key="post.post_id" class="post-item">
                <div class="post-header">
                  <span class="user-handle">@{{ post.username }}</span>
                  <span class="post-time">{{ formatPostTime(post.timestamp) }}</span>
                </div>
                <div
                  class="post-content"
                  v-if="post.content"
                  @click="onPostTextClick($event, post)"
                  v-html="formatPostContent(post.content)"
                ></div>
                <img
                  v-if="post.image"
                  :src="getImageUrl(post.image)"
                  class="post-image"
                  alt="Post"
                />
              </div>
            </div>

            <!-- No Results -->
            <div v-if="searchResults.length === 0 && postResults.length === 0" class="empty-state">
              <ion-icon :icon="searchOutline" class="empty-icon"></ion-icon>
              <p>No results found for "{{ searchQuery }}"</p>
            </div>
          </div>
        </div>

        <!-- Initial State -->
        <div v-else class="empty-state">
          <ion-icon :icon="search" class="empty-icon"></ion-icon>
          <p>Search for users or topics</p>
        </div>
      </ion-content>
    </div>

    <!-- User Profile View -->
    <div v-else>
      <ion-header class="ion-no-border">
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button @click="closeProfile">
              <ion-icon :icon="arrowBack"></ion-icon>
            </ion-button>
          </ion-buttons>
          <ion-title>{{ selectedUser.username }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="shareProfile">
              <ion-icon :icon="shareOutline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>

      <ion-content :fullscreen="true">
        <div v-if="loadingProfile" class="loading-container">
          <ion-spinner></ion-spinner>
        </div>

        <div v-else-if="userProfile" class="profile-container">
          <!-- Cover Image -->
          <div 
            class="cover-image"
            :style="userProfile.cover_photo ? { backgroundImage: `url(${getImageUrl(userProfile.cover_photo)})` } : {}">
            <div class="cover-overlay"></div>
          </div>

          <!-- Profile Info -->
          <div class="profile-info">
            <div class="avatar-section">
              <img 
                :src="getImageUrl(userProfile.profile_pic)" 
                class="profile-avatar"
                alt="Profile"
              />
            </div>

            <div class="action-buttons">
              <ion-button 
                fill="solid" 
                size="small"
                @click="sendMessage"
                class="dm-btn">
                <ion-icon :icon="mail" slot="start"></ion-icon>
                Message
              </ion-button>
              <ion-button 
                :fill="isFollowing ? 'outline' : 'solid'"
                size="small"
                @click="toggleFollow"
                :disabled="followLoading"
                class="follow-btn">
                <ion-spinner v-if="followLoading" name="crescent"></ion-spinner>
                <template v-else>
                  <ion-icon :icon="isFollowing ? checkmark : personAdd" slot="start"></ion-icon>
                  {{ isFollowing ? 'Following' : 'Follow' }}
                </template>
              </ion-button>
            </div>

            <div class="user-details">
              <h2 class="display-name">
                {{ (userProfile.first_name || userProfile.last_name) ? (userProfile.first_name + ' ' + userProfile.last_name).trim() : userProfile.username }}
              </h2>
              <p class="username">@{{ userProfile.username }}</p>
            </div>

            <!-- Bio -->
            <div class="bio-section" v-if="userProfile.bio">
              <p class="bio-text">{{ userProfile.bio }}</p>
            </div>

            <!-- Metadata -->
            <div class="metadata">
              <div class="metadata-item" v-if="userProfile.created_at">
                <ion-icon :icon="calendar"></ion-icon>
                <span>Joined {{ formatJoinDate(userProfile.created_at) }}</span>
              </div>
            </div>

            <!-- Stats -->
            <div class="stats-section">
              <div class="stat-item">
                <span class="stat-value">{{ userProfile.following_count || 0 }}</span>
                <span class="stat-label">Following</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ userProfile.followers_count || 0 }}</span>
                <span class="stat-label">Followers</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ userProfile.posts_count || 0 }}</span>
                <span class="stat-label">Posts</span>
              </div>
            </div>
          </div>

          <!-- User Posts -->
          <div class="posts-section">
            <h3 class="section-title">Posts</h3>
            
            <div v-if="userPosts.length === 0" class="empty-state">
              <ion-icon :icon="documentText" class="empty-icon"></ion-icon>
              <p>No posts yet</p>
            </div>

            <div v-for="post in userPosts" :key="post.post_id" class="post-item">
              <div class="post-header">
                <span class="post-time">{{ formatPostTime(post.timestamp) }}</span>
              </div>
              <div
                class="post-content"
                v-if="post.content"
                @click="onPostTextClick($event, post)"
                v-html="formatPostContent(post.content)">
              </div>
              <img 
                v-if="post.image" 
                :src="getImageUrl(post.image)" 
                class="post-image"
                alt="Post"
              />
              <div class="post-stats">
                <span><ion-icon :icon="heart"></ion-icon> {{ post.likes || 0 }}</span>
                <span><ion-icon :icon="chatbubble"></ion-icon> {{ post.comments_count || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      </ion-content>
    </div>
  </ion-page>
</template>

<script>
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar,
  IonButton, IonButtons, IonIcon, IonSpinner, IonSegment, IonSegmentButton, IonLabel
} from '@ionic/vue';
import {
  search, searchOutline, arrowBack, chevronForward, personAdd, 
  checkmark, mail, shareOutline, calendar, heart, chatbubble, documentText
} from 'ionicons/icons';
import axios from 'axios';
import api from '@/utils/api';
import config from '@/config/index.js';

export default {
  name: 'FollowPage',
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar,
    IonButton, IonButtons, IonIcon, IonSpinner, IonSegment, IonSegmentButton, IonLabel
  },
  data() {
    return {
      searchQuery: '',
      searchResults: [],
      postResults: [],
      suggestedUsers: [],
      trendingTopics: [],
      searchTab: 'top',
      selectedUser: null,
      userProfile: null,
      userPosts: [],
      searching: false,
      loadingTrending: false,
      isPostSearch: false,
      loadingProfile: false,
      followLoading: false,
      isFollowing: false,
      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL,
      searchController: null,
      search, searchOutline, arrowBack, chevronForward, personAdd,
      checkmark, mail, shareOutline, calendar, heart, chatbubble, documentText,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
    };
  },
  watch: {
    '$route.query.q': {
      handler(newQ) {
        if (newQ) {
          this.searchQuery = newQ;
          this.handleSearch();
        }
      },
      immediate: true
    }
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

    formatPostContent(text) {
      if (!text) return '';

      const escapeHtml = (str) =>
        str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const urlRegex = /^(https?:\/\/[\S]+|www\.[\S]+|[a-z0-9-]+\.[a-z0-9.-]+\.[a-z]{2,}(\/[\S]*)?)$/i;
      const parts = text.split(/(\s+)/);

      return parts
        .map((part) => {
          if (/\s+/.test(part)) return part;

          const escaped = escapeHtml(part);

          if (urlRegex.test(part) && !part.startsWith('@') && !part.startsWith('#')) {
            const href = part.startsWith('http') ? part : `https://${part}`;
            return `<a href="${href}" class="post-link" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
          }

          if (part.startsWith('#') && part.length > 1) {
            return `<span class="hashtag" data-hashtag="${escaped}" style="color:#daa520;">${escaped}</span>`;
          }

          if (part.startsWith('@') && part.length > 1) {
            const username = escaped.slice(1);
            return `<span class="mention" data-mention="${username}" style="color:#daa520;">${escaped}</span>`;
          }

          return escaped;
        })
        .join('');
    },

    onPostTextClick(event, post) {
      const target = event.target;

      if (target.classList.contains('mention') && target.dataset.mention) {
        const username = target.dataset.mention;
        this.$router.push(`/tabs/profile/${username}`);
        return;
      }

      if (target.classList.contains('hashtag')) {
        const tag = target.dataset.hashtag?.replace('#', '') || '';
        this.$router.push({ path: '/tabs/follow', query: { q: `#${tag}` } });
        return;
      }
    },

    async handleSearch() {
      // Clear previous results if query too short
      if (this.searchQuery.length < 2) {
        this.searchResults = [];
        this.postResults = [];
        this.isPostSearch = false;
        return;
      }

      // 1. Abort any pending search request
      if (this.searchController) {
        this.searchController.abort();
      }
      this.searchController = new AbortController();

      try {
        this.searching = true;
        const q = (this.searchQuery || '').trim();
        const searchQ = q.replace(/^@/, '');
        const isHashtag = q.startsWith('#');

        // 2. Parallel search for Users and Posts
        const [userRes, postRes] = await Promise.all([
          api.get('/api/search/users', {
            params: { q: searchQ, limit: 10, viewer_id: this.userId },
            signal: this.searchController.signal
          }).catch(err => {
            if (err.name === 'CanceledError' || err.name === 'AbortError') throw err;
            console.error('User search error:', err);
            return { users: [] };
          }),
          api.get('/api/search/posts', {
            params: { q: q, limit: 20, offset: 0 },
            signal: this.searchController.signal
          }).catch(err => {
            if (err.name === 'CanceledError' || err.name === 'AbortError') throw err;
            console.error('Post search error:', err);
            return { posts: [] };
          })
        ]);

        // 3. Process results
        this.searchResults = (userRes.users || [])
          .map(u => ({ ...u, followLoading: false }))
          .filter(u => u.user_id !== this.userId);

        this.postResults = postRes.posts || [];

        // 4. Update view mode
        if (q.startsWith('@')) {
          this.isPostSearch = false;
        } else if (isHashtag) {
          this.isPostSearch = true;
        } else {
          // Default to mixed results, starting with users
          this.isPostSearch = false;
        }

      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          // Silently ignore aborted requests
          return;
        }
        console.error('Search error:', err);
        this.searchResults = [];
        this.postResults = [];
      } finally {
        // Only reset searching if this was the last request
        if (!this.searchController.signal.aborted) {
          this.searching = false;
        }
      }
    },

    async loadTrending() {
      try {
        this.loadingTrending = true;
        const res = await api.get('/api/trending', {
          params: { limit: 10, days: 7, recent_limit: 2000 }
        });
        this.trendingTopics = res.topics || [];
      } catch (err) {
        console.error('Failed to load trending:', err);
        this.trendingTopics = [];
      } finally {
        this.loadingTrending = false;
      }
    },

    formatTrendLabel(t) {
      try {
        const raw = (t?.topic || '').toString();
        if (!raw) return '';
        if (t?.type === 'hashtag') return raw;
        const s = raw.charAt(0).toUpperCase() + raw.slice(1);
        return s.length > 60 ? s.slice(0, 57) + '...' : s;
      } catch {
        return t?.topic || '';
      }
    },

    onTrendingClick(topic) {
      const q = topic?.type === 'hashtag' ? topic.topic : topic.topic;
      this.searchQuery = q;
      this.handleSearch();
    },

    async loadSuggestedUsers() {
      try {
        const res = await api.get('/api/search/users', {
          params: { q: '', limit: 10, viewer_id: this.userId }
        });

        this.suggestedUsers = (res.users || [])
          .filter(u => u.user_id !== this.userId)
          .slice(0, 5)
          .map(u => ({ ...u, is_following: !!u.is_following, followLoading: false }));
      } catch (err) {
        console.error('Failed to load suggestions:', err);
      }
    },

    async viewProfile(user) {
      this.selectedUser = user;
      this.loadingProfile = true;

      try {
        const res = await api.get(`/api/profile/${user.username}`, {
          params: { viewer_id: this.userId }
        });
        
        if (res.success) {
          this.userProfile = res.profile;
          await this.loadUserPosts(user.user_id);
          this.isFollowing = !!res.profile.is_following;
        }
      } catch (err) {
        console.error('Profile error:', err);
      } finally {
        this.loadingProfile = false;
      }
    },

    async loadUserPosts(userId) {
      try {
        const res = await api.post('/api/feed', {
          user_id: userId,
          mode: 'user'
        });
        
        if (res.posts) {
          this.userPosts = res.posts;
        }
      } catch (err) {
        console.error('Failed to load posts:', err);
        this.userPosts = [];
      }
    },

    async checkFollowStatus(targetUserId) {
      // Handled by viewProfile directly now
    },

    async toggleFollow() {
      if (this.followLoading) return;

      try {
        this.followLoading = true;
        
        const endpoint = this.isFollowing ? '/api/unfollow' : '/api/follow';
        const res = await api.post(endpoint, {
          follower_id: this.userId,
          following_username: this.selectedUser.username
        });

        if (res.success) {
          this.isFollowing = !this.isFollowing;
          
          // Update follower count
          if (this.userProfile) {
            this.userProfile.followers_count = Math.max(
              (this.userProfile.followers_count || 0) + (this.isFollowing ? 1 : -1),
              0
            );
          }
        } else {
          alert(res.message);
        }
      } catch (err) {
        console.error('Follow error:', err);
        alert('Failed to update follow status');
      } finally {
        this.followLoading = false;
      }
    },

    async quickFollow(user) {
      if (user.followLoading) return;
      try {
        user.followLoading = true;
        const res = await api.post('/api/follow', {
          follower_id: this.userId,
          following_username: user.username
        });

        if (res.success) {
          user.is_following = true;
          // Optionally show a toast instead of alert for better UX
          console.log(`Now following @${user.username}`);
        } else {
          alert(res.message);
        }
      } catch (err) {
        console.error('Quick follow error:', err);
        alert('Failed to follow user');
      } finally {
        user.followLoading = false;
      }
    },

    sendMessage() {
      // Navigate to DM page with this user
      this.$router.push({
        path: '/tabs/dm',
        query: { username: this.selectedUser.username, userId: this.selectedUser.user_id }
      });
    },

    shareProfile() {
      if (navigator.share) {
        navigator.share({
          title: `@${this.selectedUser.username}'s Profile`,
          text: `Check out @${this.selectedUser.username} on NexFi`
        });
      }
    },

    closeProfile() {
      this.selectedUser = null;
      this.userProfile = null;
      this.userPosts = [];
      this.isFollowing = false;
    },

    formatJoinDate(dateStr) {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } catch {
        return 'Recently';
      }
    },

    formatPostTime(timestamp) {
      try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch {
        return '';
      }
    }
  },

  mounted() {
    if (!this.userId) {
      this.$router.push('/login');
      return;
    }
    
    this.loadSuggestedUsers();
    this.loadTrending();

    const initialQ = (typeof this.$route?.query?.q === 'string' && this.$route.query.q) ? this.$route.query.q : '';
    if (initialQ) {
      this.searchQuery = initialQ;
      this.handleSearch();
    }
  }
};
</script>

<style scoped>
.suggestions-container, .results-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
}

.trend-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-border-color, #e5e7eb);
  cursor: pointer;
}

.trend-item:hover {
  background-color: var(--ion-color-light, #f3f4f6);
}

.trend-topic {
  font-weight: 800;
  font-size: 16px;
  color: var(--ion-text-color, #0f1419);
}

.trend-count {
  margin-top: 2px;
  font-size: 13px;
  color: var(--ion-color-medium, #536471);
}

.section-title {
  font-size: 20px;
  font-weight: 800;
  margin: 16px 0;
  color: var(--ion-text-color, #0f1419);
}

.user-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-border-color, #e5e7eb);
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-item:hover {
  background-color: var(--ion-color-light, #f3f4f6);
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  margin-right: 12px;
  object-fit: cover;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-weight: 700;
  font-size: 15px;
  color: var(--ion-text-color, #0f1419);
}

.user-handle {
  font-size: 15px;
  color: var(--ion-color-medium, #536471);
}

.chevron {
  font-size: 20px;
  color: var(--ion-color-medium, #536471);
}

.profile-container {
  max-width: 600px;
  margin: 0 auto;
}

.cover-image {
  height: 200px;
  background: linear-gradient(135deg, #111827 0%, #daa520 100%);
}

.profile-info {
  padding: 0 16px;
  margin-top: -40px;
  position: relative;
}

.avatar-section {
  border: 4px solid var(--ion-background-color, #fff);
  border-radius: 50%;
  width: 120px;
  height: 120px;
  background: var(--ion-background-color, #fff);
  margin-bottom: 12px;
}

.profile-avatar {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}

.dm-btn, .follow-btn {
  flex: 1;
  height: 36px;
  font-weight: 700;
  --border-radius: 20px;
  --background: linear-gradient(135deg, #daa520 0%, #ffd700 100%);
  --color: #000;
  --border-width: 0;
}

.user-details {
  margin-top: 8px;
}

.display-name {
  font-size: 20px;
  font-weight: 800;
  margin: 0;
  color: var(--ion-text-color, #0f1419);
}

.username {
  font-size: 15px;
  color: var(--ion-color-medium, #536471);
  margin: 2px 0 12px;
}

.bio-section {
  margin: 12px 0;
}

.bio-text {
  font-size: 15px;
  line-height: 20px;
  color: var(--ion-text-color, #0f1419);
}

.metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 12px 0;
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  color: var(--ion-color-medium, #536471);
}

.metadata-item ion-icon {
  font-size: 18px;
}

.stats-section {
  display: flex;
  gap: 20px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  gap: 4px;
}

.stat-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--ion-text-color, #0f1419);
}

.stat-label {
  font-size: 15px;
  color: var(--ion-color-medium, #536471);
}

.posts-section {
  padding: 0 16px 16px;
}

.post-item {
  padding: 16px 0;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
}

.post-header {
  margin-bottom: 8px;
}

.post-time {
  font-size: 13px;
  color: var(--ion-color-medium, #536471);
}

.post-content {
  margin: 8px 0;
  line-height: 1.4;
}

.post-content .post-link {
  color: #daa520;
  text-decoration: none;
}

.post-content .post-link:hover {
  text-decoration: underline;
}

.post-content .hashtag,
.post-content .mention {
  color: #daa520;
  cursor: pointer;
}

.post-image {
  width: 100%;
  border-radius: 16px;
  margin: 12px 0;
}

.post-stats {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  color: var(--ion-color-medium, #536471);
  font-size: 13px;
}

.post-stats span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.post-stats ion-icon {
  font-size: 16px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--ion-color-medium, #536471);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 60px 20px;
}
</style>