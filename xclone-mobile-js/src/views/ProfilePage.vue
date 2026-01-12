<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="$router.back()">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Profile</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="loadingPosts" class="mini-spinner">
            <ion-spinner name="dots"></ion-spinner>
          </ion-button>
          <ion-button @click="toggleTheme">
            <ion-icon :icon="theme === 'light' ? moon : sunny"></ion-icon>
          </ion-button>
          <ion-button v-if="profile?.user_id === userId" @click="logout">
            <ion-icon :icon="logOut"></ion-icon>
          </ion-button>
          <ion-button @click="showOptionsMenu = true">
            <ion-icon :icon="ellipsisVertical"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-refresher slot="fixed" @ionRefresh="refreshProfile($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Loading State -->
      <div v-if="loading" class="loading-container">
        <ion-spinner></ion-spinner>
      </div>

      <!-- Profile Content -->
      <div v-else-if="profile" class="profile-container">
        <!-- Cover Image -->
        <div class="cover-image" @click="profile?.user_id === userId ? editProfile() : null">
          <img 
            v-if="profile.cover_photo"
            :src="getImageUrl(profile.cover_photo)"
            class="cover-photo"
            alt="Cover"
          />
          <div class="cover-gradient"></div>
        </div>

        <!-- Profile Info Section -->
        <div class="profile-info">
          <div class="avatar-section">
            <div class="avatar-container">
              <img 
                :src="getImageUrl(profile.profile_pic)" 
                class="profile-avatar"
                alt="Profile"
                @error="handleImageError"
              />
            </div>
            <div class="action-buttons">
              <ion-button 
                v-if="profile.user_id === userId"
                fill="outline" 
                size="small" 
                class="edit-profile-btn"
                @click="editProfile">
                Edit Profile
              </ion-button>
              <template v-else>
                <ion-button 
                  v-if="!profile.is_following"
                  fill="solid" 
                  size="small" 
                  class="follow-btn"
                  @click="toggleFollow"
                  :disabled="followLoading">
                  <ion-spinner v-if="followLoading" name="crescent"></ion-spinner>
                  <template v-else>Follow</template>
                </ion-button>
                <ion-button 
                  v-else
                  fill="outline" 
                  size="small" 
                  class="unfollow-btn"
                  @click="toggleFollow"
                  :disabled="followLoading">
                  <ion-spinner v-if="followLoading" name="crescent"></ion-spinner>
                  <template v-else>Unfollow</template>
                </ion-button>
              </template>
            </div>
          </div>

          <div class="user-details">
            <h2 class="display-name">
              {{ (profile.first_name || profile.last_name) ? (profile.first_name + ' ' + profile.last_name).trim() : profile.username }}
            </h2>
            <p class="username">@{{ profile.username }}</p>
          </div>

          <!-- Bio Section -->
          <div class="bio-section" v-if="profile.bio">
            <p class="bio-text">{{ profile.bio }}</p>
          </div>

          <!-- Metadata -->
          <div class="metadata">
            <div class="metadata-item" v-if="profile.date_of_birth">
              <ion-icon :icon="calendar"></ion-icon>
              <span>Born {{ formatBirthday(profile.date_of_birth) }}</span>
            </div>
            <div class="metadata-item" v-if="profile.created_at">
              <ion-icon :icon="calendar"></ion-icon>
              <span>Joined {{ formatJoinDate(profile.created_at) }}</span>
            </div>
          </div>

          <!-- Stats -->
          <div class="stats-section">
            <div class="stat-item" @click="showFollowing">
              <span class="stat-value">{{ profile.following_count || 0 }}</span>
              <span class="stat-label">Following</span>
            </div>
            <div class="stat-item" @click="showFollowers">
              <span class="stat-value">{{ profile.followers_count || 0 }}</span>
              <span class="stat-label">Followers</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ profile.posts_count || 0 }}</span>
              <span class="stat-label">Posts</span>
            </div>
          </div>
        </div>

        <!-- Tabs for Posts/Media/Likes -->
        <div class="profile-tabs">
          <div 
            :class="['tab-item', { active: activeTab === 'posts' }]"
            @click="activeTab = 'posts'">
            <ion-icon :icon="grid"></ion-icon>
            <span>Posts</span>
          </div>
          <div 
            :class="['tab-item', { active: activeTab === 'media' }]"
            @click="activeTab = 'media'">
            <ion-icon :icon="images"></ion-icon>
            <span>Media</span>
          </div>
          <div 
            :class="['tab-item', { active: activeTab === 'likes' }]"
            @click="activeTab = 'likes'">
            <ion-icon :icon="heart"></ion-icon>
            <span>Likes</span>
          </div>
        </div>

        <!-- Posts List -->
        <div class="posts-section" v-if="activeTab === 'posts'">
          <div v-if="loadingPosts && userPosts.length === 0" class="loading-posts">
            <ion-spinner name="crescent"></ion-spinner>
            <p>Loading posts...</p>
          </div>
          <div v-else-if="postsError" class="empty-state error-state">
            <ion-icon :icon="alertCircle" class="empty-icon text-danger"></ion-icon>
            <p>{{ postsError }}</p>
            <ion-button fill="outline" size="small" @click="loadUserPosts">Retry</ion-button>
          </div>
          <div v-else-if="userPosts.length === 0" class="empty-state">
            <ion-icon :icon="documentText" class="empty-icon"></ion-icon>
            <p>No posts yet</p>
            <ion-button fill="clear" size="small" @click="loadUserPosts">Refresh Posts</ion-button>
          </div>
          
          <div v-else v-for="post in userPosts" :key="post.post_id" class="post-item">
            <div class="repost-badge" v-if="post.item_type === 'repost'">
              <ion-icon :icon="grid" class="repost-icon"></ion-icon>
              <span>Reposted by {{ post.reposted_by_username || profile.username }}</span>
            </div>
            <div class="post-header">
              <span class="post-time">{{ formatPostTime(post.timestamp) }}</span>
            </div>
            <div 
              class="post-content" 
              v-if="post.content || post.quote_text"
              @click="onPostTextClick($event, post)"
              v-html="formatPostContent(post.quote_text || post.content)">
            </div>
            
            <!-- Handle multiple media items -->
            <div v-if="post.media && post.media.length" class="post-media-container">
              <div class="post-media-grid" :class="'count-' + Math.min(post.media.length, 4)">
                <div v-for="(m, idx) in post.media.slice(0, 4)" :key="idx" class="media-wrapper" @click="viewMedia(m)">
                  <img v-if="m.type === 'image'" :src="getImageUrl(m.data)" class="post-media-img" />
                  <div v-else-if="m.type === 'video'" class="video-preview">
                    <VideoPlayer :src="getImageUrl(m.data)" />
                  </div>
                </div>
              </div>
            </div>
            <img 
              v-else-if="post.image" 
              :src="getImageUrl(post.image)" 
              class="post-image"
              alt="Post"
              @click="viewMedia({type: 'image', data: post.image})"
            />

            <div class="post-stats">
              <span><ion-icon :icon="heart"></ion-icon> {{ post.likes || 0 }}</span>
              <span><ion-icon :icon="chatbubble"></ion-icon> {{ post.comments_count || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- Media Grid -->
        <div class="media-grid" v-if="activeTab === 'media'">
          <div v-if="mediaItems.length === 0" class="empty-state">
            <ion-icon :icon="images" class="empty-icon"></ion-icon>
            <p>No media yet</p>
          </div>
          
          <div 
            v-for="(item, idx) in mediaItems" 
            :key="idx"
            class="media-item"
            @click="viewMedia(item)">
            <img v-if="item.type === 'image'" :src="getImageUrl(item.data)" alt="Media" />
            <div v-else-if="item.type === 'video'" class="video-item-preview">
              <VideoPlayer :src="getImageUrl(item.data)" />
            </div>
          </div>
        </div>

        <!-- Likes (placeholder) -->
        <div class="empty-state" v-if="activeTab === 'likes'">
          <ion-icon :icon="heart" class="empty-icon"></ion-icon>
          <p>Liked posts coming soon</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else class="error-state">
        <ion-icon :icon="alertCircle" class="error-icon"></ion-icon>
        <p>Failed to load profile</p>
        <ion-button @click="loadProfile">Retry</ion-button>
      </div>
    </ion-content>

    <!-- Options Menu Modal -->
    <ion-modal :is-open="showOptionsMenu" @did-dismiss="showOptionsMenu = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Options</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showOptionsMenu = false">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-list>
          <ion-item button @click="shareProfile">
            <ion-icon :icon="shareOutline" slot="start"></ion-icon>
            <ion-label>Share Profile</ion-label>
          </ion-item>
          <ion-item button @click="settings">
            <ion-icon :icon="settingsOutline" slot="start"></ion-icon>
            <ion-label>Settings</ion-label>
          </ion-item>
          <ion-item button lines="none" @click="logout" class="logout-item">
            <ion-icon :icon="logOut" slot="start" color="danger"></ion-icon>
            <ion-label color="danger">Logout</ion-label>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-modal>

    <!-- Edit Profile Modal -->
    <ion-modal :is-open="showEditModal" @did-dismiss="closeEditProfile">
      <ion-header>
        <ion-toolbar>
          <ion-title>Edit profile</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeEditProfile">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div class="edit-cover" @click="$refs.editCoverInput.click()">
          <img
            v-if="editCoverPreview"
            :src="editCoverPreview"
            alt="Cover"
          />
          <div v-else class="edit-cover-placeholder">
            <span>Tap to add cover photo</span>
          </div>
        </div>
        <input
          type="file"
          ref="editCoverInput"
          accept="image/*"
          style="display:none"
          @change="onEditCoverChange"
        />

        <div class="edit-avatar" @click="$refs.editAvatarInput.click()">
          <img
            v-if="editProfilePreview"
            :src="editProfilePreview"
            alt="Avatar"
          />
        </div>
        <input
          type="file"
          ref="editAvatarInput"
          accept="image/*"
          style="display:none"
          @change="onEditAvatarChange"
        />

        <div class="edit-form">
          <div class="edit-row">
            <ion-input
              v-model="editFirstName"
              type="text"
              placeholder="First name"
            ></ion-input>
          </div>
          <div class="edit-row">
            <ion-input
              v-model="editLastName"
              type="text"
              placeholder="Last name"
            ></ion-input>
          </div>
          <div class="edit-row">
            <ion-input
              :value="username"
              type="text"
              disabled
            ></ion-input>
          </div>
          <div class="edit-row">
            <ion-input
              v-model="editDob"
              type="date"
              placeholder="Date of birth"
            ></ion-input>
          </div>
          <div class="edit-row">
            <ion-input
              v-model="editBio"
              type="text"
              placeholder="Bio"
            ></ion-input>
          </div>
          <ion-button expand="block" class="save-profile-btn" @click="saveProfile">
            Save
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Media Lightbox Modal -->
    <ion-modal :is-open="showMediaModal" @did-dismiss="closeMediaModal" class="full-screen-modal">
      <ion-header class="ion-no-border">
        <ion-toolbar color="dark">
          <ion-buttons slot="start">
            <ion-button @click="closeMediaModal" color="light">
              <ion-icon :icon="arrowBack" slot="start"></ion-icon>
              <span>Back</span>
            </ion-button>
          </ion-buttons>
          <ion-title color="light">View Media</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="mediaZoom = Math.max(1, mediaZoom - 0.5)" color="light">
              <ion-icon :icon="remove" slot="icon-only"></ion-icon>
            </ion-button>
            <ion-button @click="mediaZoom += 0.5" color="light">
              <ion-icon :icon="add" slot="icon-only"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="media-modal" color="dark">
        <div class="media-lightbox">
          <div class="zoom-container" :style="{ transform: `scale(${mediaZoom})` }">
            <img v-if="mediaSrc" :src="mediaSrc" alt="Media" @click="closeMediaModal" />
          </div>
        </div>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script>

import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
  IonButtons, IonIcon, IonSpinner, IonRefresher, IonRefresherContent,
  IonModal, IonList, IonItem, IonLabel, IonInput
} from '@ionic/vue';
import {
  checkmark, personAdd, mail, camera, 
  images, calendar, arrowBack, person, logOut, sunny, moon, ellipsisVertical,
  grid, heart, documentText, chatbubble, alertCircle,
  shareOutline, settingsOutline, add, remove, happy
} from 'ionicons/icons';
import api from '@/utils/api';
import config from '@/config/index.js';
// import VideoPlayer from '@/components/VideoPlayer.vue';

export default {
  name: 'ProfilePage',
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
    IonButtons, IonIcon, IonSpinner, IonRefresher, IonRefresherContent,
    IonModal, IonList, IonItem, IonLabel, IonInput //, VideoPlayer
  },
  data() {
    return {
      userId: localStorage.getItem('userId'),
      // Prefer route param username when viewing other profiles; fallback to own username
      username: (typeof this.$route?.params?.username === 'string' && this.$route.params.username) || localStorage.getItem('username'),
      API_URL: config.api.baseURL,
      theme: window.theme || 'light',
      arrowBack,
      logOut,
      sunny,
      moon,
      ellipsisVertical,
      calendar,
      grid,
      images,
      heart,
      documentText,
      chatbubble,
      alertCircle,
      shareOutline,
      settingsOutline,
      loading: false,
      profile: null,
      userPosts: [],
      mediaItems: [],
      loadingPosts: false,
      activeTab: 'posts',
      showOptionsMenu: false,
      showEditModal: false,
      editFirstName: '',
      editLastName: '',
      editBio: '',
      editDob: '',
      editGender: '',
      editProfilePic: null,
      editProfilePreview: '',
      editCoverPhoto: null,
      editCoverPreview: '',
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E',
      showMediaModal: false,
      mediaSrc: '',
      mediaZoom: 1,
      postsError: '',
      followLoading: false,
      happy
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

    formatPostContent(text) {
      if (!text) return '';

      const escapeHtml = (str) =>
        str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const urlRegex = /^(https?:\/\/[\S]+|www\.[\S]+)$/i;
      const parts = text.split(/(\s+)/);

      return parts
        .map((part) => {
          if (/\s+/.test(part)) return part;

          const escaped = escapeHtml(part);

          if (urlRegex.test(part)) {
            const href = part.startsWith('http') ? part : `https://${part}`;
            return `<a href="${href}" class="post-link" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
          }

          if (part.startsWith('#') && part.length > 1) {
            return `<span class="hashtag" data-hashtag="${escaped}" style="color:#1d9bf0;">${escaped}</span>`;
          }

          if (part.startsWith('@') && part.length > 1) {
            const username = escaped.slice(1);
            return `<span class="mention" data-mention="${username}" style="color:#1d9bf0;">${escaped}</span>`;
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

    handleImageError(event) {
      event.target.src = this.defaultAvatar;
    },

    formatBirthday(dob) {
      try {
        const date = new Date(dob);
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      } catch {
        return dob;
      }
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
    },

    async loadProfile() {
      if (!this.username) return;
      
      try {
        this.loading = true;
        const targetUsername = (typeof this.$route?.params?.username === 'string' && this.$route.params.username) || this.username;
        const res = await api.get(`/api/profile/${targetUsername}`, {
          params: { viewer_id: this.userId }
        });
        
        if (res.success) {
          this.profile = res.profile;
          this.profile.user_id = String(this.profile.user_id); // Ensure string
          
          // Prefill edit fields
          this.editFirstName = this.profile.first_name || '';
          this.editLastName = this.profile.last_name || '';
          this.editBio = this.profile.bio || '';
          this.editDob = this.profile.date_of_birth || '';
          this.editGender = this.profile.gender || '';
          this.editProfilePreview = this.getImageUrl(this.profile.profile_pic);
          this.editCoverPreview = this.profile.cover_photo 
            ? this.getImageUrl(this.profile.cover_photo)
            : '';
          
          await this.loadPosts();
        } else {
          console.error('Profile not found');
        }
      } catch (err) {
        console.error('Load profile error:', err);
      } finally {
        this.loading = false;
      }
    },

    async loadPosts() {
      if (!this.profile?.user_id) return;
      
      try {
        this.loadingPosts = true;
        this.postsError = '';
        console.log('📡 Loading posts for user_id:', this.profile.user_id);
        const res = await api.post('/api/feed', {
          user_id: this.profile.user_id,
          mode: 'profile',
          limit: 50
        });
        console.log('📥 Posts response:', res.posts?.length, 'posts');
        
        if (res.posts) {
          this.userPosts = res.posts;
          
          // Extract media items for the media tab
          const items = [];
          this.userPosts.forEach(post => {
            if (post.media && Array.isArray(post.media)) {
              post.media.forEach(m => {
                items.push({
                  type: m.type || 'image',
                  data: m.data,
                  post_id: post.post_id
                });
              });
            } else if (post.image) {
              items.push({
                type: 'image',
                data: post.image,
                post_id: post.post_id
              });
            }
          });
          this.mediaItems = items;
        }
      } catch (err) {
        console.error('Failed to load posts:', err);
        this.postsError = err.response?.data?.error || 'Connection error';
      } finally {
        this.loadingPosts = false;
      }
    },

    async refreshProfile(event) {
      await this.loadProfile();
      if (event) event.target.complete();
    },

    toggleTheme() {
      this.$root.toggleTheme?.();
    },

    editProfile() {
      this.showEditModal = true;
    },

    closeEditProfile() {
      this.showEditModal = false;
    },

    onEditAvatarChange(e) {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        this.editProfilePreview = ev.target.result;
        this.editProfilePic = ev.target.result.split(',')[1];
      };
      reader.readAsDataURL(file);
    },

    onEditCoverChange(e) {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 8 * 1024 * 1024) {
        alert('Cover image must be less than 8MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        this.editCoverPreview = ev.target.result;
        this.editCoverPhoto = ev.target.result.split(',')[1];
      };
      reader.readAsDataURL(file);
    },

    async saveProfile() {
      try {
        const payload = {
          user_id: this.userId,
          first_name: this.editFirstName,
          last_name: this.editLastName,
          bio: this.editBio,
          date_of_birth: this.editDob,
          gender: this.editGender
        };

        if (this.editProfilePic !== null) {
          payload.profile_pic = this.editProfilePic;
        }
        if (this.editCoverPhoto !== null) {
          payload.cover_photo = this.editCoverPhoto;
        }

        const res = await api.post('/api/profile/update', payload);

        if (res.success) {
          this.showEditModal = false;
          await this.loadProfile();
        } else {
          alert(res.message || 'Failed to update profile');
        }
      } catch (err) {
        console.error('Update profile error:', err);
        alert('Failed to update profile');
      }
    },

    async toggleFollow() {
      if (!this.profile || !this.userId) return;
      try {
        const isFollowing = this.profile.is_following;
        const endpoint = isFollowing ? '/api/unfollow' : '/api/follow';
        const res = await api.post(endpoint, {
          follower_id: this.userId,
          following_username: this.profile.username
        });
        
        if (res.success) {
          this.profile.is_following = !isFollowing;
          this.profile.followers_count += isFollowing ? -1 : 1;
        } else {
          alert(res.message || 'Action failed');
        }
      } catch (err) {
        console.error('Follow toggle error:', err);
        alert('Action failed');
      }
    },

    showFollowing() {
      console.log('Show following list');
      // TODO: Navigate to following list
    },

    showFollowers() {
      console.log('Show followers list');
      // TODO: Navigate to followers list
    },

    viewMedia(item) {
      if (!item || !item.data) return;
      this.mediaSrc = this.getImageUrl(item.data);
      this.showMediaModal = true;
      this.mediaZoom = 1;
    },

    closeMediaModal() {
      this.showMediaModal = false;
      this.mediaSrc = '';
      this.mediaZoom = 1;
    },

    async shareProfile() {
      if (!this.profile || !this.username) return;
      
      // Backend share URL for rich link previews (WhatsApp, Facebook, etc.)
      const backendShareUrl = `${this.API_URL}/share/profile/${this.username}`;
      
      // Frontend URL for direct access (cleaner for clipboard)
      const frontendUrl = `${window.location.origin}/tabs/profile/${this.username}`;
      
      const displayName = (this.profile.first_name || this.profile.last_name) 
        ? `${this.profile.first_name || ''} ${this.profile.last_name || ''}`.trim()
        : this.username;

      const shareData = {
        title: `${displayName} (@${this.username}) - NexFi`,
        text: `Check out @${this.username} on NexFi!`,
        url: backendShareUrl  // Use backend URL for native share (better previews)
      };

      // Check if native share is available
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          console.log('✅ Profile shared successfully');
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('❌ Share failed:', err);
          }
        }
      } else {
        // Fallback: Copy frontend URL to clipboard (cleaner, user-friendly)
        try {
          await navigator.clipboard.writeText(frontendUrl);
          alert('🔗 Profile link copied to clipboard!');
        } catch (err) {
          console.error('❌ Failed to copy link:', err);
          alert('Unable to share. Please copy the URL manually.');
        }
      }
      
      this.showOptionsMenu = false;
    },

    settings() {
      console.log('Settings');
      this.showOptionsMenu = false;
      // TODO: Navigate to settings
    },

    toggleTheme() {
      this.$root.toggleTheme?.();
    },

    logout() {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userAvatar');
        this.$router.push('/login');
      }
    }
  },

  mounted() {
    if (!this.userId) {
      this.$router.push('/login');
      return;
    }
    
    window.addEventListener('themeChanged', (e) => {
      this.theme = e.detail;
    });
  },

  watch: {
    '$route.params.username': {
      immediate: true,
      handler(newVal) {
        console.log('🔄 Profile Route Watch:', newVal);
        // Fallback to own username if none provided
        const target = (typeof newVal === 'string' && newVal) || localStorage.getItem('username');
        
        // Always load if target is set, but only change this.username if it's different
        if (target) {
          const isSame = target === this.username;
          this.username = target;
          
          // If profile is already loaded for this user, don't reload EVERYTHING
          // but we might want to refresh. For now, always load if it's the first time
          if (!this.profile || !isSame) {
            this.loadProfile();
          }
        }
      }
    }
  }
};
</script>

<style scoped>
.profile-container {
  max-width: 600px;
  margin: 0 auto;
}

.cover-image {
  height: 200px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #020617 100%);
  position: relative;
}

.cover-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100px;
  background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.3));
}

.profile-info {
  padding: 0 16px;
  margin-top: -40px;
  position: relative;
}

.avatar-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 12px;
}

.avatar-container {
  border: 4px solid var(--ion-background-color, #fff);
  border-radius: 50%;
  background: var(--ion-background-color, #fff);
}

.profile-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.edit-profile-btn, .follow-btn, .unfollow-btn {
  --border-radius: 20px;
  height: 36px;
  font-weight: 700;
  text-transform: none;
  font-size: 14px;
}

.follow-btn {
  --background: var(--ion-text-color, #0f1419);
  --color: var(--ion-background-color, #fff);
  --border-width: 0;
}

.unfollow-btn {
  --background: transparent;
  --color: var(--ion-text-color, #0f1419);
  --border-color: var(--ion-border-color, #eff3f4);
  --border-width: 1px;
}

.edit-profile-btn {
  --background: transparent;
  --color: var(--ion-text-color, #0f1419);
  --border-color: var(--ion-border-color, #eff3f4);
  --border-width: 1px;
}

.edit-cover {
  width: 100%;
  height: 140px;
  border-radius: 16px;
  overflow: hidden;
  background: #020617;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.edit-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.edit-cover-placeholder {
  color: #9ca3af;
  font-size: 14px;
}

.edit-avatar {
  display: flex;
  justify-content: center;
  margin-top: -32px;
  margin-bottom: 16px;
}

.edit-avatar img {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 4px solid #fff;
  object-fit: cover;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.edit-row ion-input {
  --background: #f3f4f6;
  --border-radius: 12px;
  padding-inline: 12px;
}

.save-profile-btn {
  margin-top: 12px;
  --border-radius: 999px;
  font-weight: 700;
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
}

.stat-item {
  display: flex;
  gap: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.stat-item:hover {
  opacity: 0.7;
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

.profile-tabs {
  display: flex;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
  position: sticky;
  top: 0;
  background: var(--ion-background-color, #fff);
  z-index: 10;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 12px;
  color: var(--ion-color-medium, #536471);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-item ion-icon {
  font-size: 20px;
}

.tab-item span {
  font-size: 13px;
  font-weight: 500;
}

.tab-item:hover {
  background: var(--ion-color-light, rgba(0, 0, 0, 0.03));
}

.tab-item.active {
  color: var(--ion-color-primary, #1d9bf0);
  border-bottom-color: var(--ion-color-primary, #1d9bf0);
  font-weight: 700;
}

.posts-section {
  padding: 16px;
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
  font-size: 15px;
  line-height: 20px;
  color: var(--ion-text-color, #0f1419);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.post-content .post-link {
  color: #1d9bf0;
  text-decoration: none;
}

.post-content .post-link:hover {
  text-decoration: underline;
}

.post-content .hashtag,
.post-content .mention {
  color: #1d9bf0;
  cursor: pointer;
}

.post-image {
  width: 100%;
  border-radius: 16px;
  margin: 12px 0;
  cursor: pointer;
}

.post-media-container {
  margin: 12px 0;
}

.post-media-grid {
  display: grid;
  gap: 2px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--ion-border-color, #eff3f4);
}

.post-media-grid.count-1 { grid-template-columns: 1fr; }
.post-media-grid.count-2 { grid-template-columns: 1fr 1fr; aspect-ratio: 16/9; }
.post-media-grid.count-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; aspect-ratio: 16/9; }
.post-media-grid.count-3 .media-wrapper:first-child { grid-row: 1 / span 2; }
.post-media-grid.count-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; aspect-ratio: 16/9; }

.media-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  cursor: pointer;
  overflow: hidden;
}

.post-media-img, .post-media-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-preview {
  position: relative;
  width: 100%;
  height: 100%;
}

.video-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.5);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
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

.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 2px;
}

.media-item {
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
  position: relative;
}

.media-item img, .video-item-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}

.video-item-preview {
  width: 100%;
  height: 100%;
  position: relative;
}

.video-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  color: white;
  background: rgba(0,0,0,0.3);
  padding: 2px;
  border-radius: 4px;
  display: flex;
}

.media-item:hover img, .media-item:hover video {
  transform: scale(1.05);
}

.empty-state, .error-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--ion-color-medium, #536471);
}

.empty-icon, .error-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.loading-container, .loading-posts {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--ion-color-medium, #536471);
}

.loading-posts ion-spinner {
  margin-bottom: 12px;
}

.repost-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--ion-color-medium, #536471);
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 4px;
}

.repost-icon {
  font-size: 16px;
}

.logout-item {
  margin-top: 20px;
}

/* Media Lightbox */
.media-modal {
  --background: #000;
}

.media-lightbox {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  overflow: auto;
}

.zoom-container {
  transition: transform 0.2s ease-out;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100%;
  min-height: 100%;
}

.media-lightbox img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* Full screen modal for media */
.full-screen-modal {
  --width: 100%;
  --height: 100%;
}
</style>