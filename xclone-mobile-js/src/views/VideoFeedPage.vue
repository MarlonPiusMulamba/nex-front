<template>
  <ion-page class="video-feed-page">
    <!-- Loading overlay -->
    <div v-if="loading" class="video-loading">
      <div class="loading-spinner-wrap">
        <ion-spinner name="crescent" color="light"></ion-spinner>
      </div>
      <p>Loading videos...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading && videos.length === 0" class="empty-state">
      <ion-icon :icon="videocam" class="empty-icon"></ion-icon>
      <p>No videos yet</p>
      <p class="empty-sub">Videos posted by users will appear here</p>
    </div>

    <!-- Main video scroll container -->
    <div
      v-show="!loading && videos.length > 0"
      class="video-scroll-container"
      ref="scrollContainer"
      @scroll.passive="onScroll"
    >
      <div
        v-for="(video, index) in videos"
        :key="video.post_id"
        class="video-slide"
        :data-index="index"
        :data-post-id="video.post_id"
        :ref="el => setSlideRef(el, video.post_id)"
      >
        <!-- Video element keyed by post_id to prevent element recycling mismatch -->
        <video
          :key="'video-player-' + video.post_id"
          :ref="el => setVideoRef(el, video.post_id)"
          :src="getVideoSrc(video)"
          class="fullscreen-video"
          playsinline
          webkit-playsinline
          loop
          muted
          :preload="index === 0 ? 'auto' : 'metadata'"
          @ended="onVideoEnded(index)"
          @click="togglePlay(index)"
          @error="onVideoError(index, $event)"
          @loadedmetadata="onVideoMeta(index)"
        ></video>

        <!-- Gradient overlay -->
        <div class="video-gradient"></div>

        <!-- Play/Pause indicator (shown briefly on toggle) -->
        <transition name="play-fade">
          <div class="play-pause-indicator" v-if="showPlayIndicator[index]" key="play">
            <div class="play-indicator-circle">
              <ion-icon :icon="playingStates[index] ? pause : play" class="play-icon"></ion-icon>
            </div>
          </div>
        </transition>

        <!-- Progress bar -->
        <div class="video-progress-bar" v-if="videoDurations[index]">
          <div
            class="video-progress-fill"
            :style="{ width: getProgressPercent(index) + '%' }"
          ></div>
        </div>

        <!-- Bottom: author + caption -->
        <div class="video-bottom-overlay">
          <div class="video-author" @click.stop="goToProfile(video)">
            <img :src="getImageUrl(video.profile_pic)" class="author-avatar" alt="Avatar" @error="handleAvatarError" />
            <div class="author-info">
              <span class="author-name">
                {{ getAuthorDisplayName(video) }}
                <span v-if="video.verification_tier && video.verification_tier !== 'none'" class="badge-inline">
                  <ion-icon v-if="video.verification_tier === 'blue'" :icon="shieldCheckmark" class="badge-icon blue"></ion-icon>
                  <ion-icon v-else-if="video.verification_tier === 'silver'" :icon="shieldCheckmark" class="badge-icon silver"></ion-icon>
                  <ion-icon v-else-if="video.verification_tier === 'gold'" :icon="star" class="badge-icon gold"></ion-icon>
                </span>
              </span>
              <span class="author-handle">@{{ video.username || 'user' }}</span>
            </div>
          </div>
          <div class="video-caption" v-if="video.content">{{ video.content }}</div>
        </div>

        <!-- Right: action buttons -->
        <div class="video-actions">
          <button class="action-btn" @click.stop="likeVideo(video)">
            <ion-icon :icon="video.is_liked ? heart : heartOutline" :class="['action-icon', { liked: video.is_liked }]"></ion-icon>
            <span class="action-count">{{ formatCount(video.likes) }}</span>
          </button>
          <button class="action-btn" @click.stop="openComments(video)">
            <ion-icon :icon="chatbubbleOutline" class="action-icon"></ion-icon>
            <span class="action-count">{{ formatCount(video.comments_count) }}</span>
          </button>
          <button class="action-btn" @click.stop="shareVideo(video)">
            <ion-icon :icon="shareOutline" class="action-icon"></ion-icon>
            <span class="action-count">Share</span>
          </button>
        </div>

        <!-- Error state for individual video -->
        <div v-if="videoErrors[index]" class="video-error-overlay">
          <ion-icon :icon="alertCircleOutline" class="error-icon"></ion-icon>
          <p>Video unavailable</p>
        </div>
      </div>

      <!-- Load more indicator -->
      <div v-if="loadingMore" class="loading-more">
        <ion-spinner name="crescent" color="light"></ion-spinner>
      </div>
    </div>

    <!-- Global mute button -->
    <button class="global-mute-btn" @click="toggleGlobalMute" v-if="!loading && videos.length > 0">
      <ion-icon :icon="isMuted ? volumeMute : volumeHigh"></ion-icon>
    </button>

    <!-- Back button -->
    <button class="back-btn" @click="goBack">
      <ion-icon :icon="arrowBack"></ion-icon>
    </button>
  </ion-page>
</template>

<script>
import { IonPage, IonIcon, IonSpinner } from '@ionic/vue';
import {
  heart, heartOutline, chatbubbleOutline, shareOutline, play, pause,
  volumeHigh, volumeMute, shieldCheckmark, star, videocam, alertCircleOutline, arrowBack
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
      isMuted: true,
      currentIndex: 0,
      playingStates: {},
      videoRefs: {},
      slideRefs: {},
      videoErrors: {},
      videoDurations: {},
      videoCurrentTimes: {},
      showPlayIndicator: {},
      playIndicatorTimers: {},
      observer: null,
      offset: 0,
      hasMore: true,
      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E',
      // icons
      heart, heartOutline, chatbubbleOutline, shareOutline, play, pause,
      volumeHigh, volumeMute, shieldCheckmark, star, videocam, alertCircleOutline, arrowBack,
      currentPlayStartTime: null,
      _progressInterval: null,
      _scrollEndTimer: null
    };
  },
  mounted() {
    this.initMuteState();
    this.loadVideos();
  },
  created() {
    this.storageHandler = (e) => {
      if (e.key === 'nexfi_video_muted') {
        this.isMuted = e.newValue !== 'false';
        Object.values(this.videoRefs).forEach(v => { if (v) v.muted = this.isMuted; });
      }
    };
    window.addEventListener('storage', this.storageHandler);
  },
  beforeUnmount() {
    this.pauseAll();
    this.disconnectObserver();
    if (this.storageHandler) window.removeEventListener('storage', this.storageHandler);
    if (this._progressInterval) clearInterval(this._progressInterval);
    Object.values(this.playIndicatorTimers).forEach(t => clearTimeout(t));
  },
  activated() {
    // Re-init when coming back via keep-alive
    this.$nextTick(() => {
      const startPostId = this.$route.query.start_post_id;
      if (startPostId && (!this.videos.length || String(this.videos[0].post_id) !== String(startPostId))) {
        this.loadVideos();
      } else if (this.videos.length > 0) {
        this.initObserver();
        this.playVideoAt(this.currentIndex);
      }
    });
  },
  deactivated() {
    if (this.currentPlayStartTime) this.reportVideoDwell(this.currentIndex);
    this.pauseAll();
    this.disconnectObserver();
  },
  watch: {
    '$route.query.start_post_id'(newId) {
      if (newId) this.loadVideos();
    }
  },
  methods: {
    setVideoRef(el, postId) {
      if (el && postId) {
        this.videoRefs[postId] = el;
      }
    },
    setSlideRef(el, postId) {
      if (el && postId) {
        this.slideRefs[postId] = el;
      }
    },

    getAuthorDisplayName(video) {
      if (!video) return 'User';
      if (video.is_anonymous) return 'Anonymous User';
      if (video.first_name || video.last_name) {
        return `${video.first_name || ''} ${video.last_name || ''}`.trim();
      }
      return video.username || 'User';
    },

    async loadVideos() {
      if (this.loading) return;
      this.loading = true;
      this.videos = [];
      this.videoRefs = {};
      this.slideRefs = {};
      this.videoErrors = {};
      this.playingStates = {};
      this.videoDurations = {};
      this.videoCurrentTimes = {};

      const startPostId = this.$route.query.start_post_id;

      try {
        let seedPost = null;
        if (startPostId) {
          console.log('🌱 Loading seed post:', startPostId);
          try {
            const seedRes = await axios.get(`${this.API_URL}/api/posts/${startPostId}`, {
              params: { user_id: this.userId || 0 }
            });
            if (seedRes.data.success && seedRes.data.post) {
              seedPost = seedRes.data.post;
              seedPost.post_id = String(seedPost.post_id);
              seedPost.is_liked = seedPost.liked || seedPost.is_liked || false;
            }
          } catch (e) {
            console.error('Failed to load seed post:', e);
          }
        }

        const res = await axios.get(`${this.API_URL}/api/videos`, {
          params: { user_id: this.userId || 0, limit: 20, offset: 0 }
        });

        let feedVideos = (res.data.videos || []).map(v => {
          v.post_id = String(v.post_id);
          return v;
        });

        if (seedPost) {
          this.videos = [seedPost, ...feedVideos.filter(v => String(v.post_id) !== String(startPostId))];
        } else {
          this.videos = feedVideos;
        }

        this.offset = feedVideos.length;
        this.hasMore = feedVideos.length >= 20;

        await this.$nextTick();
        // One more tick to ensure :ref callbacks have fired
        await this.$nextTick();
        this.loadVideoSources();
        this.initObserver();

        // Scroll to top
        if (this.$refs.scrollContainer) {
          this.$refs.scrollContainer.scrollTop = 0;
        }

        // Start progress tracking
        this.startProgressTracking();
      } catch (e) {
        console.error('Video feed error:', e);
      } finally {
        this.loading = false;
      }
    },

    loadVideoSources() {
      // Handled reactively by the template :src binding
    },

    initObserver() {
      this.disconnectObserver();

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const index = parseInt(entry.target.dataset.index);
          const postId = entry.target.dataset.postId;
          if (isNaN(index)) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            this.onSlideVisible(index, postId);
          } else if (!entry.isIntersecting) {
            this.onSlideHidden(index, postId);
          }
        });
      }, {
        threshold: [0, 0.6, 1.0],
        root: this.$refs.scrollContainer || null
      });

      Object.values(this.slideRefs).forEach(slide => {
        if (slide) this.observer.observe(slide);
      });

      // Play first video immediately
      if (this.videos.length > 0) {
        this.onSlideVisible(0, this.videos[0].post_id);
      }
    },

    disconnectObserver() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    },

    onSlideVisible(index, postId) {
      const targetPostId = postId || (this.videos[index] && this.videos[index].post_id);
      if (!targetPostId) return;

      this.currentIndex = index;

      // Pause all other videos
      Object.keys(this.videoRefs).forEach(id => {
        if (String(id) !== String(targetPostId)) {
          this.pauseVideoByPostId(id);
        }
      });

      this.playVideoByPostId(targetPostId);

      // Load more when approaching the end
      if (index >= this.videos.length - 3) this.loadMore();
    },

    onSlideHidden(index, postId) {
      const targetPostId = postId || (this.videos[index] && this.videos[index].post_id);
      if (this.playingStates[index]) {
        this.reportVideoDwell(index);
      }
      if (targetPostId) {
        this.pauseVideoByPostId(targetPostId);
      }
    },

    playVideoAt(index) {
      const videoData = this.videos[index];
      if (videoData) {
        this.playVideoByPostId(videoData.post_id);
      }
    },

    playVideoByPostId(postId) {
      const video = this.videoRefs[postId];
      const videoData = this.videos.find(v => String(v.post_id) === String(postId));
      const index = this.videos.findIndex(v => String(v.post_id) === String(postId));
      if (!video || !videoData) return;

      // Ensure src is set
      const src = this.getVideoSrc(videoData);
      if (src && video.src !== src) {
        video.src = src;
        video.load();
      }

      this.currentPlayStartTime = Date.now();

      const doPlay = () => {
        video.muted = this.isMuted;
        video.play().catch(() => {
          // Autoplay blocked — try muted
          video.muted = true;
          this.isMuted = true;
          video.play().catch(() => {});
        });
        if (index !== -1) this.playingStates[index] = true;
      };

      if (video.readyState >= 2) {
        doPlay();
      } else {
        const onReady = () => {
          video.removeEventListener('canplay', onReady);
          doPlay();
        };
        video.addEventListener('canplay', onReady);
        if (video.networkState === HTMLMediaElement.NETWORK_EMPTY || !video.src) {
          if (src) { video.src = src; }
          video.load();
        }
      }
    },

    pauseVideoAt(index) {
      const videoData = this.videos[index];
      if (videoData) {
        this.pauseVideoByPostId(videoData.post_id);
      }
    },

    pauseVideoByPostId(postId) {
      const video = this.videoRefs[postId];
      const index = this.videos.findIndex(v => String(v.post_id) === String(postId));
      if (video && !video.paused) video.pause();
      if (index !== -1) this.playingStates[index] = false;
    },

    pauseAll() {
      Object.keys(this.videoRefs).forEach(postId => this.pauseVideoByPostId(postId));
    },

    togglePlay(index) {
      const video = this.videoRefs[index];
      if (!video) return;

      if (video.paused) {
        this.playVideoAt(index);
      } else {
        this.pauseVideoAt(index);
      }

      // Show play/pause indicator briefly
      this.flashPlayIndicator(index);
    },

    flashPlayIndicator(index) {
      this.showPlayIndicator[index] = true;
      if (this.playIndicatorTimers[index]) clearTimeout(this.playIndicatorTimers[index]);
      this.playIndicatorTimers[index] = setTimeout(() => {
        this.showPlayIndicator[index] = false;
      }, 800);
    },

    onVideoMeta(index) {
      const video = this.videoRefs[index];
      if (video) {
        this.videoDurations[index] = video.duration || 0;
      }
    },

    startProgressTracking() {
      if (this._progressInterval) clearInterval(this._progressInterval);
      this._progressInterval = setInterval(() => {
        const video = this.videoRefs[this.currentIndex];
        if (video) {
          this.videoCurrentTimes[this.currentIndex] = video.currentTime;
        }
      }, 200);
    },

    getProgressPercent(index) {
      const dur = this.videoDurations[index];
      const cur = this.videoCurrentTimes[index] || 0;
      if (!dur) return 0;
      return Math.min((cur / dur) * 100, 100);
    },

    reportVideoDwell(index) {
      const video = this.videoRefs[index];
      const post = this.videos[index];
      if (!video || !post || !this.currentPlayStartTime) return;

      const dwellMs = Date.now() - this.currentPlayStartTime;
      const seconds = dwellMs / 1000;
      if (seconds < 1) return;

      const completionRate = video.duration ? video.currentTime / video.duration : 0;

      axios.post(`${this.API_URL}/api/posts/dwell`, {
        user_id: this.userId,
        post_id: post.post_id,
        seconds: seconds,
        completion_rate: completionRate
      }).catch(() => {});

      this.currentPlayStartTime = null;
    },

    onVideoEnded(index) {
      this.reportVideoDwell(index);
      // Auto-advance to next video
      const nextIndex = index + 1;
      if (nextIndex < this.videos.length) {
        const nextSlide = this.slideRefs[nextIndex];
        if (nextSlide) {
          nextSlide.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },

    onVideoError(index, event) {
      const video = this.videoRefs[index];
      const post = this.videos[index];
      console.error(`❌ Video error at index ${index}:`, {
        src: video?.src?.substring(0, 100),
        post_id: post?.post_id,
        error: event?.target?.error
      });
      this.videoErrors[index] = true;
    },

    onScroll() {
      // Debounce scroll end detection
      if (this._scrollEndTimer) clearTimeout(this._scrollEndTimer);
      this._scrollEndTimer = setTimeout(() => {
        // Snap to nearest slide after scroll settles
        const container = this.$refs.scrollContainer;
        if (!container) return;
        const slideHeight = container.clientHeight;
        const scrolled = container.scrollTop;
        const nearestIndex = Math.round(scrolled / slideHeight);
        if (nearestIndex !== this.currentIndex) {
          // Observer should handle this, but as safety net:
          this.currentIndex = nearestIndex;
        }
      }, 150);
    },

    async loadMore() {
      if (this.loadingMore || !this.hasMore) return;
      this.loadingMore = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/videos`, {
          params: { user_id: this.userId || 0, limit: 20, offset: this.offset }
        });
        const newVideos = res.data.videos || [];
        const prevLen = this.videos.length;
        this.videos.push(...newVideos);
        this.offset += newVideos.length;
        this.hasMore = newVideos.length >= 20;

        await this.$nextTick();
        // Observe new slides (src binding is handled reactively by template)
        newVideos.forEach((video, i) => {
          const index = prevLen + i;
          const slide = this.slideRefs[index];
          if (slide && this.observer) this.observer.observe(slide);
        });
      } catch (e) {
        console.error('Load more error:', e);
      } finally {
        this.loadingMore = false;
      }
    },

    toggleGlobalMute() {
      this.isMuted = !this.isMuted;
      Object.values(this.videoRefs).forEach(v => { if (v) v.muted = this.isMuted; });
      localStorage.setItem('nexfi_video_muted', this.isMuted);
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'nexfi_video_muted',
        newValue: String(this.isMuted)
      }));
    },

    initMuteState() {
      const savedMute = localStorage.getItem('nexfi_video_muted');
      this.isMuted = savedMute !== 'false';
    },

    async likeVideo(video) {
      if (!this.userId) return;
      const wasLiked = video.is_liked;
      video.is_liked = !wasLiked;
      video.likes = wasLiked ? (video.likes || 1) - 1 : (video.likes || 0) + 1;
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
      const url = `${window.location.origin}/share/post/${video.post_id}`;
      if (navigator.share) {
        await navigator.share({ title: `Video by @${video.username}`, url }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(url).catch(() => {});
        alert('Link copied!');
      }
    },

    goToProfile(video) {
      this.$router.push(`/tabs/profile/${video.username}`);
    },

    goBack() {
      this.$router.back();
    },

    getVideoSrc(video) {
      const item = video.media?.[0];
      if (!item) return '';
      const src = item.data || '';
      if (!src) return '';
      if (src.startsWith('http')) return src;
      if (src.startsWith('/static/')) return `${this.API_URL}${src}`;
      if (src.startsWith('data:')) return src;
      return '';
    },

    getImageUrl(imageData) {
      if (!imageData) return this.defaultAvatar;
      if (imageData.startsWith('http')) return imageData;
      if (imageData.startsWith('data:')) return imageData;
      if (imageData.startsWith('/static/')) return `${this.API_URL}${imageData}`;
      return this.defaultAvatar;
    },

    handleAvatarError(event) {
      event.target.src = this.defaultAvatar;
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
  position: relative;
}

/* ── Main scroll container ── */
.video-scroll-container {
  height: 100vh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  position: relative;
}

.video-scroll-container::-webkit-scrollbar { display: none; }
.video-scroll-container { scrollbar-width: none; }

/* ── Each video slide ── */
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

/* ── Full-screen video ── */
.fullscreen-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
  cursor: pointer;
}

/* ── Gradient overlay ── */
.video-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 65%;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.9));
  pointer-events: none;
  z-index: 2;
}

/* ── Progress bar ── */
.video-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.25);
  z-index: 15;
}

.video-progress-fill {
  height: 100%;
  background: #fff;
  transition: width 0.2s linear;
  border-radius: 0 2px 2px 0;
}

/* ── Play/Pause indicator ── */
.play-pause-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 20;
  pointer-events: none;
}

.play-indicator-circle {
  width: 72px;
  height: 72px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.play-icon {
  font-size: 36px;
  color: rgba(255, 255, 255, 0.95);
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
}

.play-fade-enter-active {
  animation: piFadeIn 0.15s ease;
}
.play-fade-leave-active {
  animation: piFadeOut 0.5s ease forwards;
}
@keyframes piFadeIn {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
@keyframes piFadeOut {
  from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  to { opacity: 0; transform: translate(-50%, -50%) scale(1.2); }
}

/* ── Bottom info overlay ── */
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
  tap-highlight-color: transparent;
}

.author-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.9);
  object-fit: cover;
  flex-shrink: 0;
}

.author-info {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  gap: 4px;
}

.badge-icon { font-size: 14px; }
.badge-icon.blue { color: #1D9BF0; }
.badge-icon.silver { color: #C0C0C0; }
.badge-icon.gold { color: #FFD700; }

.author-handle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 1px;
}

.video-caption {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.45;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  max-height: 72px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

/* ── Right side action buttons ── */
.video-actions {
  position: absolute;
  right: 12px;
  bottom: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  z-index: 10;
}

.action-btn {
  background: none;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 4px;
  gap: 4px;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s ease;
}

.action-btn:active {
  transform: scale(0.9);
}

.action-icon {
  font-size: 32px;
  color: #fff;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.6));
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
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

/* ── Global mute button ── */
.global-mute-btn {
  position: fixed;
  top: 52px;
  right: 16px;
  z-index: 100;
  background: rgba(0, 0, 0, 0.65);
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  color: #fff;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.global-mute-btn:hover {
  background: rgba(0, 0, 0, 0.85);
  transform: scale(1.05);
}

.global-mute-btn:active {
  transform: scale(0.9);
}

/* ── Back button ── */
.back-btn {
  position: fixed;
  top: 52px;
  left: 16px;
  z-index: 100;
  background: rgba(0, 0, 0, 0.65);
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  color: #fff;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 22px;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.back-btn:hover {
  background: rgba(0, 0, 0, 0.85);
}

.back-btn:active {
  transform: scale(0.9);
}

/* ── Video error overlay ── */
.video-error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  color: rgba(255, 255, 255, 0.7);
  gap: 12px;
  z-index: 8;
  pointer-events: none;
}

.video-error-overlay .error-icon {
  font-size: 48px;
  color: rgba(255, 255, 255, 0.4);
}

.video-error-overlay p {
  font-size: 14px;
  margin: 0;
}

/* ── Loading overlay ── */
.video-loading {
  position: fixed;
  inset: 0;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 200;
  color: rgba(255, 255, 255, 0.7);
  gap: 16px;
}

.loading-spinner-wrap {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-loading p {
  font-size: 14px;
  margin: 0;
  letter-spacing: 0.3px;
}

/* ── Load more indicator ── */
.loading-more {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Empty state ── */
.empty-state {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  gap: 12px;
  text-align: center;
  padding: 32px;
  background: #000;
}

.empty-icon { font-size: 64px; color: rgba(255, 255, 255, 0.25); }
.empty-sub { font-size: 14px; color: rgba(255, 255, 255, 0.45); }
</style>
