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
          <ion-button v-if="profile && String(profile.user_id) === String(userId)" @click="logout" title="Logout">
            <ion-icon :icon="logOutOutline"></ion-icon>
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
          </div>
          <div class="action-buttons-row">
            <div class="action-buttons">
              <ion-button 
                v-if="profile && String(profile.user_id) === String(userId) && !profile.is_verified"
                fill="outline" 
                size="small"
                class="verify-inline-btn"
                @click="getVerified">
                <ion-icon :icon="checkmarkCircle" slot="start"></ion-icon>
                Get Verified
              </ion-button>
              <ion-button 
                v-if="profile && String(profile.user_id) === String(userId) && profile.is_verified && profile.verification_tier !== 'gold'"
                fill="outline" 
                size="small"
                class="verify-inline-btn"
                @click="getVerified">
                <ion-icon :icon="colorWand" slot="start"></ion-icon>
                Upgrade
              </ion-button>
              <ion-button 
                v-if="profile && String(profile.user_id) === String(userId)"
                fill="outline" 
                size="small" 
                class="edit-profile-btn"
                @click="editProfile">
                Edit Profile
              </ion-button>
              <ion-button 
                v-if="profile && String(profile.user_id) === String(userId)"
                fill="solid" 
                size="small" 
                :class="['ghost-btn', { 'active': profile.is_anonymous }]"
                @click="handleAnonymityToggle"
                :disabled="anonymityLoading">
                <ion-spinner v-if="anonymityLoading" name="crescent" size="small"></ion-spinner>
                <template v-else>
                  <ion-icon :icon="skull" slot="start"></ion-icon>
                  {{ profile.is_anonymous ? 'Go Public' : 'Go Anonymous' }}
                </template>
              </ion-button>
              <!-- Hide follow/message buttons when viewing others while you are anonymous -->
              <template v-else-if="!currentUserIsAnonymous">
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
                <ion-button 
                  fill="outline" 
                  size="small"
                  class="message-btn"
                  @click="openDirectMessage">
                  <ion-icon :icon="mail" slot="start"></ion-icon>
                  Message
                </ion-button>
              </template>
            </div>
          </div>

          <div class="user-details">
            <h2 class="display-name">
              {{ (profile.first_name || profile.last_name) ? (profile.first_name + ' ' + profile.last_name).trim() : profile.username }}
              <VerificationBadge :tier="profile.verification_tier" />
              <ion-badge v-if="profile.is_anonymous" color="medium" class="anonymous-badge">
                <ion-icon :icon="skull"></ion-icon> Anonymous
              </ion-badge>
            </h2>
            <p class="username">@{{ profile.username }}</p>
          </div>

          <!-- Bio Section -->
          <div class="bio-section" v-if="profile.bio">
            <p class="bio-text">{{ profile.bio }}</p>
          </div>

          <!-- Metadata (hidden when viewing own profile in anonymous mode) -->
          <div class="metadata" v-if="!(profile && String(profile.user_id) === String(userId) && profile.is_anonymous)">
            <div class="metadata-item" v-if="profile.date_of_birth">
              <ion-icon :icon="calendar"></ion-icon>
              <span>Born {{ formatBirthday(profile.date_of_birth) }}</span>
            </div>
            <div class="metadata-item" v-if="profile.created_at">
              <ion-icon :icon="calendar"></ion-icon>
              <span>Joined {{ formatJoinDate(profile.created_at) }}</span>
            </div>
          </div>

          <!-- Stats (hidden when viewing own profile in anonymous mode) -->
          <div class="stats-section" v-if="!currentUserIsAnonymous">
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

        <!-- LAN Mode Panel (Only visible on own profile) -->
        <LanModePanel 
          v-if="profile && String(profile.user_id) === String(userId)"
          :isOwnProfile="true"
          :currentUserId="userId"
          :currentUsername="profile.username"
        />

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
          
          <div v-else v-for="post in userPosts" :key="post.post_id" class="post-item post-card-container">
            <!-- Left: Avatar -->
            <div class="post-avatar" @click="openProfile(post)">
              <img
                :src="getImageUrl(post.profile_pic || profile.profile_pic)"
                class="avatar-img"
                alt="Profile"
                @error="handleImageError"
              />
            </div>

            <!-- Right: Content wrapper -->
            <div class="post-content-wrapper">
              <!-- Repost Context -->
              <div v-if="post.item_type === 'repost'" class="repost-context">
                <ion-icon :icon="repeat" class="repost-icon"></ion-icon>
                <span class="repost-text">Reposted by @{{ truncateUsername(post.reposted_by_username || profile.username) }}</span>
              </div>

              <!-- Quote Container (if quote repost) -->
              <div v-if="post.item_type === 'repost' && (post.quote_text || (post.quote_media && post.quote_media.length))" class="quote-container">
                <div v-if="post.quote_text" class="quote-text" v-html="formatPostContent(post.quote_text)"></div>
                <div v-if="post.quote_media && post.quote_media.length" class="quote-media">
                  <div class="media-grid" :class="`count-${Math.min(post.quote_media.length, 4)}`">
                    <div
                      v-for="(item, index) in post.quote_media.slice(0, 4)"
                      :key="index"
                      class="media-item"
                      @click="viewMedia(item)"
                    >
                      <img
                        v-if="item.type === 'image'"
                        :src="getImageUrl(item.data)"
                        class="media-img"
                        alt="Quote media"
                        @error="handleImageError"
                      />
                      <VideoPlayer
                        v-else-if="item.type === 'video'"
                        :src="getVideoUrl(item)"
                        :poster="item.thumbnail ? getImageUrl(item.thumbnail) : ''"
                        @click.stop
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Post Header (User Info + More Option) -->
              <div class="post-header">
                <div class="post-user-info" @click="openProfile(post)">
                  <span class="display-name">
                    {{ (post.first_name || post.last_name) ? (post.first_name + ' ' + post.last_name).trim() : post.username }}
                  </span>
                  <VerificationBadge :tier="post.verification_tier || (post.item_type !== 'repost' ? profile.verification_tier : 'none')" />
                  <span class="handle">@{{ truncateUsername(post.username) }}</span>
                  <span class="separator">·</span>
                  <span class="timestamp">{{ formatPostTime(post.timestamp) }}</span>
                </div>
                <ion-button 
                  fill="clear" 
                  size="small" 
                  class="more-btn"
                  @click.stop="openPostMoreOptions(post)">
                  <ion-icon :icon="ellipsisHorizontal"></ion-icon>
                </ion-button>
              </div>

              <!-- Post Content Text -->
              <div 
                class="post-text" 
                v-if="post.content" 
                @click="onPostTextClick($event, post)"
                v-html="formatPostContent(getPostDisplayContent(post.content, post.post_id))">
              </div>
              <div v-if="post.content && post.content.length > 500" class="show-more-toggle" @click.stop="toggleExpandPost(post.post_id)">
                {{ isExpanded(post.post_id) ? 'Show less' : 'Show more' }}
              </div>

              <!-- Handle media items -->
              <div 
                class="post-media" 
                v-if="post.media && post.media.length"
              >
                <div 
                  class="media-grid" 
                  :class="`count-${Math.min(post.media.length, 4)}`"
                >
                  <div
                    v-for="(item, index) in post.media.slice(0, 4)"
                    :key="index"
                    class="media-item"
                    @click="viewMedia(item)"
                  >
                    <img
                      v-if="item.type === 'image'"
                      :src="getImageUrl(item.data)"
                      class="media-img"
                      alt="Post media"
                      @error="handleImageError"
                    />
                    <VideoPlayer
                      v-else-if="item.type === 'video'"
                      :src="getVideoUrl(item)"
                      :poster="item.thumbnail ? getImageUrl(item.thumbnail) : ''"
                      @click.stop
                    />
                  </div>
                </div>
              </div>

              <!-- Legacy single image -->
              <div v-else-if="post.image" class="post-media">
                <img 
                  :src="getImageUrl(post.image)" 
                  class="post-image"
                  alt="Post"
                  @click="viewMedia({type: 'image', data: post.image})"
                />
              </div>

              <!-- Poll Display -->
              <PollDisplay 
                v-if="post.poll" 
                :poll="post.poll" 
                :postId="post.post_id"
                @poll-updated="handlePollUpdate"
              />

              <!-- Actions row -->
              <div class="post-actions">
                <ion-button fill="clear" size="small" @click="openComments(post)" class="action-btn">
                  <ion-icon :icon="chatbubbleOutline"></ion-icon>
                  <span v-if="post.comments">{{ post.comments }}</span>
                </ion-button>
                
                <ion-button
                  fill="clear"
                  size="small"
                  @click="retweet(post.post_id)"
                  :class="['action-btn', 'retweet-btn', { 'reposted': post.is_reposted_by_me }]"
                >
                  <ion-icon :icon="repeat"></ion-icon>
                </ion-button>
                
                <ion-button 
                  fill="clear" 
                  size="small" 
                  @click="toggleLike(post.post_id, post.liked)" 
                  :class="['action-btn', 'like-btn', { 'liked': post.liked }]">
                  <ion-icon :icon="post.liked ? heart : heartOutline"></ion-icon>
                  <span v-if="post.likes > 0">{{ post.likes }}</span>
                </ion-button>
                
                <ion-button fill="clear" size="small" @click="share(post)" class="action-btn">
                  <ion-icon :icon="shareOutline"></ion-icon>
                </ion-button>
              </div>
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
              <VideoPlayer :src="getVideoUrl(item)" />
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
          <ion-item button @click="getVerified" v-if="!profile || !profile.is_verified">
            <ion-icon :icon="checkmarkCircle" slot="start" color="primary"></ion-icon>
            <ion-label>Get Verified</ion-label>
          </ion-item>
          <ion-item button @click="getVerified" v-if="profile && profile.is_verified && profile.verification_tier !== 'gold'">
            <ion-icon :icon="colorWand" slot="start" color="primary"></ion-icon>
            <ion-label>Upgrade Verification</ion-label>
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

    <!-- Post Options Action Sheet -->
    <ion-action-sheet
      :is-open="showPostMoreSheet"
      @didDismiss="showPostMoreSheet = false"
      :buttons="postMoreButtons"
    ></ion-action-sheet>
  </ion-page>
</template>

<script>

import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
  IonButtons, IonIcon, IonSpinner, IonRefresher, IonRefresherContent,
  IonModal, IonList, IonItem, IonLabel, IonInput, IonActionSheet
} from '@ionic/vue';
import {
  checkmark, personAdd, mail, camera, 
  images, calendar, arrowBack, person, logOut, sunny, moon, ellipsisVertical, ellipsisHorizontal,
  grid, heart, heartOutline, chatbubbleOutline, repeat, documentText, chatbubble, alertCircle,
  shareOutline, checkmarkCircle, skull, colorWand, happy, add, remove, settingsOutline, close, notificationsCircleOutline
} from 'ionicons/icons';
import api from '@/utils/api';
import config from '@/config/index.js';
import VideoPlayer from '@/components/VideoPlayer.vue';
import PollDisplay from '@/components/PollDisplay.vue';
import LanModePanel from '@/components/LanModePanel.vue';
import VerificationBadge from '@/components/VerificationBadge.vue';
import { saveProfileOffline, getOfflineProfile, isNetworkOffline, savePostsOffline, getOfflinePosts } from '@/utils/offlineDb.js';

export default {
  name: 'ProfilePage',
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
    IonButtons, IonIcon, IonSpinner, IonRefresher, IonRefresherContent,
    IonModal, IonList, IonItem, IonLabel, IonInput, IonActionSheet, VideoPlayer, PollDisplay, LanModePanel, VerificationBadge
  },
  data() {
    return {
      userId: localStorage.getItem('userId'),
      // Prefer route param username when viewing other profiles; fallback to own username
      username: (typeof this.$route?.params?.username === 'string' && this.$route.params.username) || localStorage.getItem('username'),
      API_URL: config.api.baseURL,
      theme: window.theme || 'light',
      arrowBack,
      mail,
      logOut,
      sunny,
      moon,
      ellipsisVertical,
      ellipsisHorizontal,
      showPostMoreSheet: false,
      postMoreButtons: [],
      activeMorePost: null,
      expandedPosts: {},
      calendar,
      grid,
      heart,
      heartOutline,
      chatbubbleOutline,
      repeat,
      documentText,
      chatbubble,
      alertCircle,
      shareOutline,
      settingsOutline,
      checkmarkCircle,
      logoGhost: skull,
      skull,
      colorWand,
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
      
      // Anonymity state
      anonymityLoading: false,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E',
      showMediaModal: false,
      mediaSrc: '',
      mediaZoom: 1,
      postsError: '',
      followLoading: false,
      happy,
      add,
      remove,
      currentTime: Date.now(),
      _timeTickerInterval: null
    };
  },
  
  computed: {
    currentUserIsAnonymous() {
      // Check if the current logged-in user is in anonymous mode
      return this.profile && String(this.profile.user_id) === String(this.userId) && this.profile.is_anonymous;
    }
  },
  
  methods: {
    handlePollUpdate(event) {
      const updatePost = (post) => {
        if (post.post_id === event.postId && post.poll) {
          post.poll.options = event.options;
          post.poll.has_voted = true;
        }
      };
      
      const post = this.userPosts.find(p => p.post_id === event.postId);
      if (post) updatePost(post);
    },

    _normalizeMediaUrl(url) {
      if (!url || typeof url !== 'string') return url;
      let cleaned = url.trim();
      while (cleaned.endsWith('?')) {
        cleaned = cleaned.substring(0, cleaned.length - 1);
      }
      const STATIC_MARKER = '/static/';
      const idx = cleaned.indexOf(STATIC_MARKER);
      if (cleaned.startsWith('http') && idx !== -1) {
        return `${this.API_URL}${cleaned.substring(idx)}`;
      }
      return cleaned;
    },

    getImageUrl(imageData) {
      if (!imageData || imageData === '') return this.defaultAvatar;
      if (typeof imageData !== 'string') return this.defaultAvatar;
      if (imageData.startsWith('data:')) return imageData;
      // Normalize full URLs to local API (avoids DDNS/CORS issues)
      if (imageData.startsWith('http')) return this._normalizeMediaUrl(imageData);
      if (imageData.startsWith('/static/')) return `${this.API_URL}${imageData}`;
      // Fix: Handle base64 images properly
      if (imageData.length > 100) {
        return `data:image/png;base64,${imageData}`;
      }
      return imageData;
    },

    getVideoUrl(mediaItem) {
      if (!mediaItem) return '';
      const data = mediaItem.data || '';
      if (!data) return '';
      if (data.startsWith('http')) return this._normalizeMediaUrl(data);
      if (data.startsWith('/static/')) return `${this.API_URL}${data}`;
      if (data.startsWith('data:')) return data;
      return '';
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
        const normalizeTimestamp = (value) => {
          if (typeof value === 'number') {
            return value > 1000000000000 ? new Date(value) : new Date(value * 1000);
          }

          if (typeof value === 'string') {
            const trimmed = value.trim();
            const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
            const looksIso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(trimmed);

            if (looksIso && !hasZone) {
              const iso = trimmed.replace(' ', 'T') + 'Z';
              return new Date(iso);
            }

            return new Date(trimmed);
          }

          return new Date();
        };

        const postDate = normalizeTimestamp(timestamp);
        const now = this.currentTime ? new Date(this.currentTime) : new Date();
        const diffMs = now - postDate;
        
        if (isNaN(diffMs) || diffMs < 0) {
          return 'now';
        }
        
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHr / 24);

        if (diffSec < 10) return 'now';
        if (diffSec < 60) return `${diffSec}s`;
        if (diffMin < 60) return `${diffMin}m`;
        if (diffHr < 24) return `${diffHr}h`;
        if (diffDay < 7) return `${diffDay}d`;
        return postDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch (err) {
        return '';
      }
    },

    async loadProfile() {
      const targetUsername = (typeof this.$route?.params?.username === 'string' && this.$route.params.username) || this.username || localStorage.getItem('username');
      if (!targetUsername) return;
      
      try {
        this.loading = true;
        
        // Handle offline
        if (isNetworkOffline()) {
          console.log('📡 OFFLINE: Loading profile from IndexedDB');
          const cachedProfile = await getOfflineProfile(targetUsername);
          if (cachedProfile) {
            this.profile = cachedProfile;
            this.loading = false;
            // Also try to load cached posts for this user
            const cachedPosts = await getOfflinePosts();
            this.posts = cachedPosts.filter(p => p.username === targetUsername);
            return;
          }
        }

        const res = await api.get(`/api/profile/${targetUsername}`, {
          params: { viewer_id: this.userId }
        });
        
        if (res.success) {
          this.profile = res.profile;
          if (this.profile) {
              this.profile.user_id = String(this.profile.user_id); // Ensure string
          }
          
          // Save to offline DB
          await saveProfileOffline(this.profile);
          
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
          // Try fallback if request just failed
          const cachedProfile = await getOfflineProfile(targetUsername);
          if (cachedProfile) {
            this.profile = cachedProfile;
          }
        }
      } catch (err) {
        console.error('Load profile error:', err);
        const targetUsername = (typeof this.$route?.params?.username === 'string' && this.$route.params.username) || this.username;
        const cachedProfile = await getOfflineProfile(targetUsername);
        if (cachedProfile) {
          this.profile = cachedProfile;
        }
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
          this.userPosts = res.posts.map(p => ({
            ...p,
            liked: !!p.is_liked,
            likes: p.likes_count ?? p.likes ?? 0,
            comments: p.comments_count || 0
          }));
          
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

    getVerified() {
      this.showOptionsMenu = false;
      this.$router.push('/tabs/verify');
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

      if (file.size > 50 * 1024 * 1024) {
        alert('Image must be less than 50MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        this.editProfilePreview = ev.target.result;
        this.editProfilePic = ev.target.result;
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
        this.editCoverPhoto = ev.target.result;
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
      if (!this.profile || !this.userId || this.followLoading) return;
      
      // Store original state for rollback
      const originalFollowState = this.profile.is_following;
      const originalFollowerCount = this.profile.followers_count;
      
      try {
        // Set loading state
        this.followLoading = true;
        
        // Optimistic UI update - update immediately for better UX
        this.profile.is_following = !originalFollowState;
        this.profile.followers_count += originalFollowState ? -1 : 1;
        
        const endpoint = originalFollowState ? '/api/unfollow' : '/api/follow';
        const res = await api.post(endpoint, {
          follower_id: this.userId,
          following_username: this.profile.username
        });
        
        const success = res.success !== undefined ? res.success : res.data?.success;
        
        console.log('Follow/unfollow response:', { success, res });
        
        if (!success) {
          this.profile.is_following = originalFollowState;
          this.profile.followers_count = originalFollowerCount;
          const errorMsg = res.message || res.data?.message || 'Unable to update follow status';
          alert(errorMsg);
        } else {
          console.log(`✅ Successfully ${originalFollowState ? 'unfollowed' : 'followed'} @${this.profile.username}`);
        }
      } catch (err) {
        this.profile.is_following = originalFollowState;
        this.profile.followers_count = originalFollowerCount;
        console.error('Follow toggle error:', err);
        const errorMsg = err.response?.data?.message || err.message || 'Connection error. Please try again.';
        alert(errorMsg);
      } finally {
        this.followLoading = false;
      }
    },

    async handleAnonymityToggle() {
      if (this.anonymityLoading) return;
      
      try {
        this.anonymityLoading = true;
        
        // Save current theme before toggling if going anonymous
        const currentlyAnonymous = this.profile.is_anonymous;
        if (!currentlyAnonymous) {
          // Entering anonymous mode - save current theme
          const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
          localStorage.setItem('preAnonymousTheme', currentTheme);
        }
        
        const res = await api.post('/api/user/toggle-anonymity', {
          user_id: this.userId
        });
        
        if (res.success) {
          this.profile.is_anonymous = res.is_anonymous;
          
          // Apply theme based on new anonymity state
          if (res.is_anonymous) {
            // Entering anonymous mode - force dark theme
            document.body.classList.remove('light');
            document.body.classList.add('dark');
          } else {
            // Exiting anonymous mode - restore previous theme
            const previousTheme = localStorage.getItem('preAnonymousTheme') || 'light';
            document.body.classList.remove('dark', 'light');
            document.body.classList.add(previousTheme);
          }
          
          setTimeout(() => {
            this.loadProfile();
            this.loadPosts();
          }, 100);
        } else {
          alert('Failed to toggle anonymity');
        }
      } catch (err) {
        console.error('Anonymity toggle error:', err);
        alert('Action failed');
      } finally {
        this.anonymityLoading = false;
      }
    },

    openDirectMessage() {
      if (!this.profile) return;
      
      // Navigate to DM page with query parameters for the profile user
      this.$router.push({
        path: '/tabs/dm',
        query: {
          userId: this.profile.user_id,
          username: this.profile.username
        }
      });
    },

    showFollowing() {
      if (!this.username) return;
      this.$router.push(`/tabs/profile/${this.username}/following`);
    },

    showFollowers() {
      if (!this.username) return;
      this.$router.push(`/tabs/profile/${this.username}/followers`);
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
    },

    getVerified() {
      this.showOptionsMenu = false;
      this.$router.push('/tabs/verify');
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
    },

    async toggleLike(postId, liked) {
      if (!this.userId) {
        this.$router.push('/login');
        return;
      }
      const post = this.userPosts.find(p => p.post_id === postId);
      if (!post) return;

      const previousLiked = post.liked;
      const previousLikes = post.likes;

      // Optimistic update
      post.liked = !liked;
      post.likes = (post.likes || 0) + (liked ? -1 : 1);

      try {
        const res = await api.post('/api/like', {
          post_id: postId,
          user_id: this.userId
        });
        if (res.success) {
          post.liked = res.liked;
          post.likes = res.likes;
        }
      } catch (err) {
        post.liked = previousLiked;
        post.likes = previousLikes;
        console.error('Like error:', err);
      }
    },

    openComments(post) {
      this.$router.push({ path: '/tabs/feed', query: { post: post.post_id } });
    },

    async retweet(postId) {
      if (!this.userId) {
        this.$router.push('/login');
        return;
      }
      const post = this.userPosts.find(p => p.post_id === postId);
      if (!post) return;
      
      const wasReposted = post.is_reposted_by_me;
      post.is_reposted_by_me = !wasReposted;
      
      try {
        const endpoint = wasReposted ? '/api/repost/undo' : '/api/repost';
        const res = await api.post(endpoint, {
          user_id: this.userId,
          post_id: postId
        });
        if (res.success) {
          // If undoing repost, and we are viewing our own profile's reposts, remove it from list
          if (wasReposted && String(this.profile?.user_id) === String(this.userId)) {
            this.userPosts = this.userPosts.filter(p => p.post_id !== postId);
          }
        }
      } catch (err) {
        post.is_reposted_by_me = wasReposted;
        console.error('Repost error:', err);
      }
    },

    async share(post) {
      if (!post) return;
      const isNative = window?.location?.protocol === 'capacitor:' || window?.location?.protocol === 'ionic:' || typeof window.Capacitor !== 'undefined';
      const frontendBase = isNative ? 'https://nex-front.vercel.app' : window.location.origin;
      const frontendUrl = `${frontendBase}/tabs/feed?post=${post.post_id}`;
      
      const shareData = {
        title: `NexFi - Post by @${post.username}`,
        text: post.content || 'Check out this post on NexFi!',
        url: frontendUrl
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Share failed:', err);
          }
        }
      } else {
        try {
          await navigator.clipboard.writeText(frontendUrl);
          alert('🔗 Link copied to clipboard!');
        } catch (err) {
          console.error('Failed to copy link:', err);
        }
      }
    },

    isExpanded(postId) {
      return !!this.expandedPosts[postId];
    },

    toggleExpandPost(postId) {
      this.expandedPosts[postId] = !this.expandedPosts[postId];
    },

    getPostDisplayContent(content, postId) {
      if (!content) return '';
      if (this.isExpanded(postId) || content.length <= 500) {
        return content;
      }
      return content.slice(0, 500) + '...';
    },

    truncateUsername(username) {
      if (!username) return '';
      if (username.length <= 15) return username;
      return username.slice(0, 15) + '...';
    },

    getVideoUrl(mediaItem) {
      if (!mediaItem) return '';
      const data = mediaItem.data || '';
      if (!data) return '';
      if (data.startsWith('http')) return data;
      if (data.startsWith('/static/')) return `${this.API_URL}${data}`;
      if (data.startsWith('data:')) return data;
      return '';
    },

    openProfile(post) {
      if (!post || !post.username) return;
      if (this.username === post.username) return;
      this.$router.push(`/tabs/profile/${post.username}`);
    },

    async deletePost(postId) {
      if (!confirm('Delete this post?')) return;
      
      try {
        const res = await api.post('/api/delete_post', { 
          post_id: postId, 
          user_id: this.userId 
        });
        
        if (res.success) {
          this.userPosts = this.userPosts.filter(p => p.post_id !== postId);
        } else {
          alert(res.message || 'Failed to delete post');
        }
      } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete post');
      }
    },

    openPostMoreOptions(post) {
      this.activeMorePost = post;
      const buttons = [];
      
      if (post.user_id === this.userId) {
        buttons.push({
          text: 'Delete Post',
          role: 'destructive',
          icon: close,
          handler: () => { this.deletePost(post.post_id); }
        });
      } else {
        buttons.push({
          text: 'Not Interested',
          icon: notificationsCircleOutline,
          handler: () => {
            api.post('/api/posts/dislike', {
              user_id: this.userId,
              target_type: 'post',
              target_id: post.post_id
            }).then(() => {
              this.userPosts = this.userPosts.filter(p => p.post_id !== post.post_id);
            }).catch(console.error);
          }
        });
        buttons.push({
          text: `Mute @${post.username}`,
          icon: notificationsCircleOutline,
          role: 'destructive',
          handler: () => {
            if (confirm(`Mute @${post.username}?`)) {
              api.post('/api/posts/dislike', {
                user_id: this.userId,
                target_type: 'user',
                target_id: post.user_id
              }).then(() => {
                this.userPosts = this.userPosts.filter(p => p.user_id !== post.user_id);
              }).catch(console.error);
            }
          }
        });
      }
      
      buttons.push({
        text: 'Cancel',
        role: 'cancel'
      });
      
      this.postMoreButtons = buttons;
      this.showPostMoreSheet = true;
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
  },
  mounted() {
    this._timeTickerInterval = setInterval(() => {
      this.currentTime = Date.now();
    }, 10000);
  },
  beforeUnmount() {
    if (this._timeTickerInterval) {
      clearInterval(this._timeTickerInterval);
      this._timeTickerInterval = null;
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

.stats-section {
  display: flex;
  gap: 20px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
}

.stat-item {
  display: flex;
  gap: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.stat-item:hover {
  text-decoration: underline;
  opacity: 0.8;
}

.stat-value {
  font-weight: 800;
  color: var(--ion-text-color, #0f1419);
}

.stat-label {
  color: var(--ion-color-medium, #536471);
}

.avatar-section {
  display: flex;
  justify-content: flex-start;
  align-items: flex-end;
  margin-bottom: 8px;
}

.action-buttons-row {
  display: flex;
  justify-content: flex-end;
  margin-top: -36px;
  position: relative;
  z-index: 5;
}

.avatar-container {
  border: 4px solid var(--ion-background-color, #fff);
  border-radius: 50%;
  background: var(--ion-background-color, #fff);
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: nowrap;
  align-items: center;
}

.message-btn {
  --background: transparent;
  --color: #0f1419;
  --border-color: #cfd9de;
  --border-width: 1px;
  --border-radius: 20px;
  height: 36px;
  font-weight: 700;
  text-transform: none;
  font-size: 14px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: transparent;
  margin: 0;
}

.message-btn:hover {
  --background: rgba(0, 0, 0, 0.03);
  --border-color: #bcc9d2;
}

.message-btn:active {
  --background: rgba(0, 0, 0, 0.08);
  transform: scale(0.96);
}

.message-btn ion-icon {
  font-size: 18px;
  margin-right: 4px;
}


.profile-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.edit-profile-btn, .follow-btn, .unfollow-btn, .verify-inline-btn {
  --border-radius: 20px;
  height: 36px;
  font-weight: 700;
  text-transform: none;
  font-size: 14px;
}

.follow-btn {
  --background: var(--ion-color-primary, #daa520);
  --color: #ffffff;
  --border-width: 0;
  box-shadow: 0 2px 8px rgba(218, 165, 32, 0.2);
}

.follow-btn:hover {
  --background: var(--ion-color-primary-tint, #deae36);
  box-shadow: 0 4px 12px rgba(218, 165, 32, 0.3);
}

.verify-inline-btn {
  --background: transparent;
  --color: #daa520;
  --border-color: #daa520;
  --border-width: 1px;
  transition: all 0.2s ease-in-out;
}

.verify-inline-btn:hover {
  --background: rgba(218, 165, 32, 0.05);
}

.verify-inline-btn:active {
  --background: rgba(218, 165, 32, 0.1);
  transform: scale(0.96);
}

.unfollow-btn {
  --background: transparent;
  --color: var(--ion-text-color, #1a1a1a);
  --border-color: #cfd9de;
  --border-width: 1px;
}

.edit-profile-btn {
  --background: transparent;
  --color: var(--ion-text-color, #1a1a1a);
  --border-color: #cfd9de;
  --border-width: 1px;
}

.ghost-btn {
  --background: #f1f5f9;
  --color: #475569;
  --border-radius: 20px;
  --box-shadow: none;
}

.ghost-btn.active {
  --background: #0f172a;
  --color: #f8fafc;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.3);
}

.anonymous-badge {
  font-size: 11px;
  vertical-align: middle;
  margin-left: 8px;
  --padding-start: 6px;
  --padding-end: 8px;
  --padding-top: 2px;
  --padding-bottom: 2px;
  border-radius: 12px;
  text-transform: uppercase;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.edit-profile-btn:hover, .unfollow-btn:hover {
  --background: rgba(0, 0, 0, 0.03);
  --border-color: #bcc9d2;
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
  color: var(--ion-color-primary, #daa520);
  border-bottom-color: var(--ion-color-primary, #daa520);
  font-weight: 700;
}

.posts-section {
  padding: 0;
}

.post-card-container {
  display: flex;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
  background: var(--ion-background-color, #fff);
  position: relative;
  transition: background-color 0.2s ease;
}

.post-card-container:hover {
  background-color: var(--ion-color-light, rgba(0, 0, 0, 0.02));
}

.post-avatar {
  margin-right: 12px;
  flex-shrink: 0;
}

.avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.post-content-wrapper {
  flex: 1;
  min-width: 0;
}

/* Post Header */
.post-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
}

.post-user-info {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.post-user-info .display-name {
  font-weight: 700;
  color: var(--ion-text-color, #0f1419);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
  font-size: 15px;
}

.handle, .separator, .timestamp {
  color: var(--ion-color-medium, #536471);
  font-size: 15px;
}

.more-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  margin: -8px -8px 0 0;
  color: var(--ion-color-medium, #536471);
}

/* Post Content */
.post-text {
  font-size: 15px;
  line-height: 20px;
  color: var(--ion-text-color, #0f1419);
  white-space: pre-wrap;
  word-wrap: break-word;
  margin-bottom: 8px;
}

.post-text .post-link {
  color: #daa520;
  text-decoration: none;
}

.post-text .post-link:hover {
  text-decoration: underline;
}

.post-text .hashtag,
.post-text .mention {
  color: #daa520;
  cursor: pointer;
}

/* Post Media Grid (Identical to FeedPage) */
.post-media {
  margin: 8px 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--ion-border-color, rgba(0, 0, 0, 0.08));
  background: #080c10;
}

.media-img,
.post-image {
  width: 100% !important;
  height: auto !important;
  max-height: 750px !important;
  object-fit: contain !important;
  display: block !important;
  margin: 0 auto !important;
}

.media-grid {
  display: grid;
  gap: 2px;
}

.media-grid.count-1 {
  grid-template-columns: 1fr;
  width: 100%;
  background: #080c10;
}

.media-grid.count-1 .media-item {
  width: 100%;
  min-height: 0 !important;
  max-height: 750px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-grid.count-1 .media-item img {
  width: 100% !important;
  height: auto !important;
  max-height: 750px !important;
  object-fit: contain !important;
  display: block !important;
  margin: 0 auto !important;
}

.media-grid.count-2 {
  grid-template-columns: 1fr 1fr;
  height: 280px;
}

.media-grid.count-3,
.media-grid.count-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  height: 320px;
}

.media-grid:not(.count-1) .media-item {
  position: relative;
  overflow: hidden;
  height: 100%;
}

.media-grid:not(.count-1) .media-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Actions Row */
.post-actions {
  display: flex;
  justify-content: space-between;
  max-width: 425px;
  margin-top: 4px;
}

.action-btn {
  --color: var(--ion-color-medium, #536471);
  --padding-start: 0;
  --padding-end: 0;
  margin: 0;
  font-size: 13px;
  transition: all 0.2s ease;
}

.action-btn::part(native) {
  border-radius: 50%;
}

.action-btn ion-icon {
  font-size: 18px;
  margin-right: 4px;
}

.action-btn:hover {
  --color: var(--ion-color-primary, #daa520);
}

.like-btn.liked {
  --color: #f91880 !important;
}

.like-btn.liked ion-icon {
  color: #f91880;
}

.retweet-btn.reposted {
  --color: #00ba7c !important;
}

/* CTA */
.verification-cta-section {
  margin: 16px 0;
}

.cta-verify-btn {
  --box-shadow: 0 4px 12px rgba(218, 165, 32, 0.4);
  margin-top: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.cta-verify-btn ion-icon {
  font-size: 20px;
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