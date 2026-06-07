<template>
  <ion-page class="video-feed-page">
    <div class="video-scroll-container" ref="scrollContainer" @touchstart="onTouchStart" @touchend="onTouchEnd">
      <div
        v-for="(video, index) in videos"
        :key="video.post_id"
        class="video-slide"
        :data-index="index"
        :ref="el => videoSlides[index] = el"
      >
        <!-- Full-screen video -->
        <video
          :ref="el => videoRefs[index] = el"
          :src="getVideoSrc(video)"
          :poster="getVideoPoster(video)"
          class="fullscreen-video"
          playsinline
          webkit-playsinline
          loop
          preload="auto"
          @ended="onVideoEnded(index)"
          @click="togglePlay(index)"
        ></video>

        <!-- Gradient overlay -->
        <div class="video-gradient"></div>

        <!-- Bottom: post caption + author info -->
        <div class="video-bottom-overlay">
          <div class="video-author" @click="goToProfile(video)">
            <img :src="getImageUrl(video.profile_pic)" class="author-avatar" alt="Avatar" />
            <div class="author-info">
              <span class="author-name">
                {{ video.first_name || video.last_name ? `${video.first_name} ${video.last_name}`.trim() : video.username }}
                <span v-if="video.verification_tier && video.verification_tier !== 'none'" class="badge-inline">
                  <ion-icon v-if="video.verification_tier === 'blue'" :icon="shieldCheckmark" class="badge-icon blue"></ion-icon>
                  <ion-icon v-else-if="video.verification_tier === 'silver'" :icon="shieldCheckmark" class="badge-icon silver"></ion-icon>
                  <ion-icon v-else-if="video.verification_tier === 'gold'" :icon="star" class="badge-icon gold"></ion-icon>
                </span>
              </span>
              <span class="author-handle">@{{ video.username }}</span>
            </div>
          </div>
          <div class="video-caption" v-if="video.content">{{ video.content }}</div>
        </div>

        <!-- Right: action buttons (TikTok-style) -->
        <div class="video-actions">
          <button class="action-btn" @click="likeVideo(video)">
            <ion-icon :icon="video.is_liked ? heart : heartOutline" :class="['action-icon', { liked: video.is_liked }]"></ion-icon>
            <span class="action-count">{{ formatCount(video.likes) }}</span>
          </button>
          <button class="action-btn" @click="openComments(video)">
            <ion-icon :icon="chatbubbleOutline" class="action-icon"></ion-icon>
            <span class="action-count">{{ formatCount(video.comments_count) }}</span>
          </button>
          <button class="action-btn" @click="shareVideo(video)">
            <ion-icon :icon="shareOutline" class="action-icon"></ion-icon>
            <span class="action-count">Share</span>
          </button>
        </div>

        <!-- Play/Pause indicator -->
        <div class="play-pause-indicator" v-if="!playingStates[index]" @click="togglePlay(index)">
          <ion-icon :icon="play" class="play-icon"></ion-icon>
        </div>
      </div>

      <!-- Loading more indicator -->
      <div v-if="loadingMore" class="loading-more">
        <ion-spinner name="crescent"></ion-spinner>
      </div>

      <!-- Empty state -->
      <div v-if="!loading && videos.length === 0" class="empty-state">
        <ion-icon :icon="videocam" class="empty-icon"></ion-icon>
        <p>No videos yet</p>
        <p class="empty-sub">Videos posted by verified or popular accounts will appear here</p>
      </div>
    </div>

    <!-- Loading overlay -->
    <div v-if="loading" class="video-loading">
      <ion-spinner name="crescent" color="light"></ion-spinner>
      <p>Loading videos...</p>
    </div>

    <!-- Mute button -->
    <button class="global-mute-btn" @click="toggleGlobalMute">
      <ion-icon :icon="isMuted ? volumeMute : volumeHigh"></ion-icon>
    </button>
  </ion-page>
</template>

<script>
import { IonPage, IonIcon, IonSpinner } from '@ionic/vue';
import {
  heart, heartOutline, chatbubbleOutline, shareOutline, play, pause,
  volumeHigh, volumeMute, shieldCheckmark, star, videocam
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config/index.js';

export default {
  name: 'VideoFeedPage',
  components: { IonPage, IonIcon, IonSpinner },
  data() {
    return {
      videos: [],
      loading: false,
      loadingMore: false,
      isMuted: false,
      currentIndex: 0,
      playingStates: {},
      videoRefs: {},
      videoSlides: {},
      observer: null,
      offset: 0,
      hasMore: true,
      touchStartY: 0,
      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E',
      // icons
      heart, heartOutline, chatbubbleOutline, shareOutline, play, pause,
      volumeHigh, volumeMute, shieldCheckmark, star, videocam,
      currentPlayStartTime: null
    };
  },
  mounted() {
    this.loadVideos();
  },
  beforeUnmount() {
    this.pauseAll();
    if (this.observer) this.observer.disconnect();
  },
  activated() {
    this.initObserver();
    // Re-load if start_post_id doesn't match current first video
    const startPostId = this.$route.query.start_post_id;
    if (startPostId && (!this.videos.length || String(this.videos[0].post_id) !== String(startPostId))) {
      this.loadVideos();
    }
  },
  deactivated() {
    if (this.currentPlayStartTime) {
      this.reportVideoDwell(this.currentIndex);
    }
    this.pauseAll();
  },
  watch: {
    '$route.query.start_post_id'(newId) {
      if (newId) {
        this.loadVideos();
      }
    }
  },
  methods: {
    async loadVideos() {
      if (this.loading) return;
      this.loading = true;
      
      const startPostId = this.$route.query.start_post_id;
      
      try {
        let seedPost = null;
        if (startPostId) {
          console.log('🌱 Loading seed post:', startPostId);
          try {
            const seedRes = await axios.get(`${this.API_URL}/api/posts/${startPostId}`, {
              params: { user_id: this.userId || 0 }
            });
            if (seedRes.data.success) {
              seedPost = seedRes.data.post;
            }
          } catch (e) {
            console.error('Failed to load seed post:', e);
          }
        }

        const res = await axios.get(`${this.API_URL}/api/videos`, {
          params: { user_id: this.userId || 0, limit: 20, offset: 0 }
        });
        
        let feedVideos = res.data.videos || [];
        
        if (seedPost) {
          // Put seed post first, filter out if it exists in feed
          this.videos = [seedPost, ...feedVideos.filter(v => String(v.post_id) !== String(startPostId))];
        } else {
          this.videos = feedVideos;
        }

        this.offset = feedVideos.length;
        this.hasMore = feedVideos.length >= 20;
        this.$nextTick(() => {
          if (this.$refs.scrollContainer) {
            this.$refs.scrollContainer.scrollTop = 0;
          }
          this.initObserver();
        });
      } catch (e) {
        console.error('Video feed error:', e);
      } finally {
        this.loading = false;
      }
    },

    async loadMore() {
      if (this.loadingMore || !this.hasMore) return;
      this.loadingMore = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/videos`, {
          params: { user_id: this.userId || 0, limit: 20, offset: this.offset }
        });
        const newVideos = res.data.videos || [];
        this.videos.push(...newVideos);
        this.offset += newVideos.length;
        this.hasMore = newVideos.length >= 20;
        this.$nextTick(() => this.refreshObserver());
      } catch (e) {
        console.error('Load more error:', e);
      } finally {
        this.loadingMore = false;
      }
    },

    initObserver() {
      if (this.observer) this.observer.disconnect();
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const index = parseInt(entry.target.dataset.index);
          const videoEl = this.videoRefs[index];
          if (!videoEl) return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.75) {
            this.playVideoAt(index);
            // Load more when near end
            if (index >= this.videos.length - 3) this.loadMore();
          } else {
            if (this.playingStates[index]) {
               this.reportVideoDwell(index);
            }
            this.pauseVideoAt(index);
          }
        });
      }, { threshold: 0.75 });

      Object.values(this.videoSlides).forEach(slide => {
        if (slide) this.observer.observe(slide);
      });
    },

    refreshObserver() {
      Object.values(this.videoSlides).forEach(slide => {
        if (slide && this.observer) this.observer.observe(slide);
      });
    },

    playVideoAt(index) {
      const video = this.videoRefs[index];
      if (!video) return;
      
      this.currentPlayStartTime = Date.now();
      
      video.muted = this.isMuted;
      video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
      this.playingStates[index] = true;
      this.currentIndex = index;
    },

    pauseVideoAt(index) {
      const video = this.videoRefs[index];
      if (video) video.pause();
      this.playingStates[index] = false;
    },

    reportVideoDwell(index) {
      const video = this.videoRefs[index];
      const post = this.videos[index];
      if (!video || !post || !this.currentPlayStartTime) return;
      
      const dwellMs = Date.now() - this.currentPlayStartTime;
      const seconds = dwellMs / 1000;
      if (seconds < 1) return;
      
      const completionRate = video.duration ? video.currentTime / video.duration : 0;
      
      console.log(`📊 Reporting video dwell: ${seconds.toFixed(1)}s, ${Math.round(completionRate*100)}% complete`);

      axios.post(`${this.API_URL}/api/posts/dwell`, {
        user_id: this.userId,
        post_id: post.post_id,
        seconds: seconds,
        completion_rate: completionRate
      }).catch(e => console.error('Dwell report error:', e));
      
      this.currentPlayStartTime = null;
    },

    pauseAll() {
      Object.keys(this.videoRefs).forEach(i => this.pauseVideoAt(parseInt(i)));
    },

    togglePlay(index) {
      const video = this.videoRefs[index];
      if (!video) return;
      if (video.paused) {
        this.playVideoAt(index);
      } else {
        this.pauseVideoAt(index);
      }
    },

    toggleGlobalMute() {
      this.isMuted = !this.isMuted;
      Object.values(this.videoRefs).forEach(v => { if (v) v.muted = this.isMuted; });
    },

    onVideoEnded(index) {
      this.reportVideoDwell(index);
      const nextIndex = index + 1;
      if (nextIndex < this.videos.length) {
        const nextSlide = this.videoSlides[nextIndex];
        if (nextSlide) {
          nextSlide.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },

    onTouchStart(e) {
      this.touchStartY = e.changedTouches[0].clientY;
    },
    onTouchEnd(e) {
      const deltaY = this.touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(deltaY) > 50) {
        const dir = deltaY > 0 ? 1 : -1;
        const next = this.currentIndex + dir;
        if (next >= 0 && next < this.videos.length) {
          const slide = this.videoSlides[next];
          if (slide) slide.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },

    async likeVideo(video) {
      if (!this.userId) return;
      const wasLiked = video.is_liked;
      video.is_liked = !wasLiked;
      video.likes = wasLiked ? video.likes - 1 : video.likes + 1;
      try {
        await axios.post(`${this.API_URL}/api/${wasLiked ? 'unlike' : 'like'}`, {
          user_id: this.userId, post_id: video.post_id
        });
      } catch (e) {
        video.is_liked = wasLiked;
        video.likes = wasLiked ? video.likes + 1 : video.likes - 1;
      }
    },

    openComments(video) {
      this.$router.push(`/tabs/feed?post=${video.post_id}`);
    },

    async shareVideo(video) {
      const url = `${this.API_URL.replace('/api', '')}/share/post/${video.post_id}`;
      if (navigator.share) {
        await navigator.share({ title: `Video by @${video.username}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied!');
      }
    },

    goToProfile(video) {
      this.$router.push(`/tabs/profile/${video.username}`);
    },

    getVideoSrc(video) {
      const item = video.media?.[0];
      if (!item) return '';
      const src = item.data || '';
      if (src.startsWith('http')) return src;
      if (src.startsWith('/static/')) return `${this.API_URL}${src}`;
      if (src.length > 100) return `data:video/mp4;base64,${src}`;
      return src;
    },

    getVideoPoster(video) {
      const item = video.media?.[0];
      if (!item?.thumbnail) return '';
      const t = item.thumbnail;
      if (t.startsWith('http')) return t;
      if (t.startsWith('/static/')) return `${this.API_URL}${t}`;
      if (t.length > 100) return `data:image/jpeg;base64,${t}`;
      return t;
    },

    getImageUrl(imageData) {
      if (!imageData) return this.defaultAvatar;
      if (imageData.startsWith('http')) return imageData;
      if (imageData.startsWith('data:image')) return imageData;
      if (imageData.startsWith('/static/')) return `${this.API_URL}${imageData}`;
      if (imageData.length > 100) return `data:image/png;base64,${imageData}`;
      return imageData;
    },

    formatCount(n) {
      if (!n) return '0';
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return String(n);
    }
  }
};
</script>

<style scoped>
.video-feed-page {
  background: #000;
  --background: #000;
  height: 100vh;
  overflow: hidden;
}

.video-scroll-container {
  height: 100vh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
  position: relative;
}

.video-scroll-container::-webkit-scrollbar { display: none; }

.video-slide {
  width: 100%;
  height: 100vh;
  position: relative;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  overflow: hidden;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-video {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-gradient {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 60%;
  background: linear-gradient(transparent, rgba(0,0,0,0.85));
  pointer-events: none;
}

/* Right side action buttons */
.video-actions {
  position: absolute;
  right: 12px;
  bottom: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  z-index: 10;
}

.action-btn {
  background: none;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 0;
  gap: 4px;
}

.action-icon {
  font-size: 32px;
  color: #fff;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
  transition: transform 0.15s ease, color 0.15s ease;
}

.action-icon.liked {
  color: #ff2d55;
  transform: scale(1.2);
}

.action-count {
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0,0,0,0.7);
}

/* Bottom info overlay */
.video-bottom-overlay {
  position: absolute;
  bottom: 80px;
  left: 16px;
  right: 80px;
  z-index: 10;
}

.video-author {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  cursor: pointer;
}

.author-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid #fff;
  object-fit: cover;
}

.author-info {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  gap: 4px;
}

.badge-icon { font-size: 14px; }
.badge-icon.blue { color: #1D9BF0; }
.badge-icon.silver { color: #C0C0C0; }
.badge-icon.gold { color: #FFD700; }

.author-handle {
  font-size: 12px;
  color: rgba(255,255,255,0.8);
}

.video-caption {
  font-size: 14px;
  color: #fff;
  line-height: 1.4;
  text-shadow: 0 1px 3px rgba(0,0,0,0.7);
  max-height: 60px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

/* Play/pause indicator */
.play-pause-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 20;
  pointer-events: none;
  animation: fadeOut 0.8s ease forwards;
  animation-delay: 0.5s;
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

.play-icon {
  font-size: 72px;
  color: rgba(255,255,255,0.9);
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
}

/* Global mute button */
.global-mute-btn {
  position: fixed;
  top: 50px;
  right: 16px;
  z-index: 100;
  background: rgba(0,0,0,0.6);
  border: 1.5px solid rgba(255,255,255,0.3);
  backdrop-filter: blur(8px);
  color: #fff;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  transition: all 0.2s;
}

.global-mute-btn:active { transform: scale(0.9); }

/* Loading */
.video-loading {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 200;
  color: #fff;
  gap: 16px;
}

.loading-more {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Empty state */
.empty-state {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  gap: 12px;
  text-align: center;
  padding: 32px;
}
.empty-icon { font-size: 64px; color: rgba(255,255,255,0.3); }
.empty-sub { font-size: 14px; color: rgba(255,255,255,0.5); }
</style>
