<template>
  <div
    class="video-container"
    :class="{ 'is-playing': isPlaying, 'is-portrait': isPortrait, 'is-landscape': !isPortrait, 'feed-mode': feedMode }"
    ref="container"
    @mouseenter="feedMode && onHoverStart()"
    @mouseleave="feedMode && onHoverEnd()"
    @click="handleContainerClick"
  >
    <!-- Poster thumbnail shown before/when not playing in feed mode -->
    <div
      v-if="feedMode && poster && !isPlaying"
      class="feed-poster"
      :style="{ backgroundImage: `url(${poster})` }"
    >
      <!-- Play icon overlay on poster -->
      <div class="feed-poster-play">
        <div class="feed-poster-play-circle">
          <ion-icon :icon="play" class="feed-poster-play-icon"></ion-icon>
        </div>
      </div>
      <!-- Video duration badge -->
      <div v-if="duration > 0" class="feed-duration-badge">{{ durationFormatted }}</div>
    </div>

    <video
      ref="video"
      :src="videoSrc"
      :poster="poster"
      class="video-player"
      :class="{ 'video-hidden': feedMode && !isPlaying && poster }"
      playsinline
      webkit-playsinline
      :autoplay="!feedMode"
      muted
      loop
      :preload="feedMode ? 'metadata' : 'auto'"
      @playing="onPlaying"
      @pause="onPause"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onMetadata"
      @canplay="onCanPlay"
      @loadeddata="onLoadedData"
    ></video>

    <!-- Play/Pause ripple overlay (only in non-feedMode) -->
    <transition name="ripple-fade" v-if="!feedMode">
      <div v-if="showRipple" class="ripple-overlay">
        <div class="ripple-icon">
          <ion-icon :icon="rippleIcon"></ion-icon>
        </div>
      </div>
    </transition>

    <!-- Feed mode playing: muted badge + gradient -->
    <template v-if="feedMode && isPlaying">
      <!-- Muted badge — top-right -->
      <div class="feed-muted-badge" @click.stop="toggleMute">
        <ion-icon :icon="isMuted ? volumeMute : volumeHigh"></ion-icon>
      </div>
      <!-- Bottom gradient with "Click to watch" hint -->
      <div class="feed-hover-overlay">
        <div class="feed-hover-hint">
          <ion-icon :icon="play" class="feed-hint-icon"></ion-icon>
          <span>Click to watch</span>
        </div>
      </div>
    </template>

    <!-- Play indicator when paused (non-feed mode) -->
    <div class="play-indicator" v-if="!feedMode && !isPlaying && !showRipple">
      <div class="play-button">
        <ion-icon :icon="play"></ion-icon>
      </div>
    </div>

    <!-- Bottom controls bar (non-feed mode only) -->
    <div class="controls-bar" @click.stop v-if="!feedMode">
      <!-- Progress bar -->
      <div class="progress-track" @click.stop="seekTo($event)" ref="progressTrack">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <div class="controls-row">
        <!-- Time display -->
        <span class="time-display">{{ currentTimeFormatted }} / {{ durationFormatted }}</span>

        <!-- Mute button -->
        <div class="mute-btn" @click.stop="toggleMute" :class="{ 'is-muted': isMuted }">
          <ion-icon :icon="isMuted ? volumeMute : volumeHigh"></ion-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { IonIcon } from '@ionic/vue';
import { volumeHigh, volumeMute, play, pause, playCircle, pauseCircle } from 'ionicons/icons';

export default {
  name: 'VideoPlayer',
  components: { IonIcon },
  emits: ['open-in-feed'],
  props: {
    src: {
      type: String,
      required: true
    },
    poster: {
      type: String,
      default: ''
    },
    // When true: video plays on hover muted in feed; clicking navigates to video feed
    feedMode: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isPlaying: false,
      isMuted: true,
      isVisible: false,
      isPortrait: false,
      isHovering: false,
      currentTime: 0,
      duration: 0,
      showRipple: false,
      rippleIcon: play,
      rippleTimer: null,
      volumeHigh,
      volumeMute,
      play,
      pause,
      observer: null,
      storageHandler: null,
      hoverTimeout: null
    };
  },
  computed: {
    videoSrc() {
      return this.src || '';
    },
    progressPercent() {
      if (!this.duration) return 0;
      return Math.min((this.currentTime / this.duration) * 100, 100);
    },
    currentTimeFormatted() {
      return this.formatTime(this.currentTime);
    },
    durationFormatted() {
      return this.formatTime(this.duration);
    }
  },
  watch: {
    src(newSrc) {
      if (!newSrc) return;
      this.$nextTick(() => {
        const video = this.$refs.video;
        if (video && this.isVisible && !this.feedMode) {
          video.load();
          this.playVideo();
        }
      });
    }
  },
  mounted() {
    this.initObserver();
    // Sync muted state
    this.$nextTick(() => {
      const video = this.$refs.video;
      if (video) {
        video.muted = true; // always start muted
        this.isMuted = true;
      }
    });

    // Listen for storage changes from other components
    this.storageHandler = (e) => {
      if (e.key === 'nexfi_video_muted') {
        this.isMuted = e.newValue !== 'false';
        if (this.$refs.video) this.$refs.video.muted = this.isMuted;
      }
    };
    window.addEventListener('storage', this.storageHandler);
  },
  beforeUnmount() {
    if (this.observer) this.observer.disconnect();
    if (this.rippleTimer) clearTimeout(this.rippleTimer);
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    if (this.storageHandler) window.removeEventListener('storage', this.storageHandler);
    // Clean up hover playback
    if (this.feedMode && this.$refs.video) {
      this.$refs.video.pause();
    }
  },
  methods: {
    // ─── Feed-mode hover handlers ───────────────────────────
    onHoverStart() {
      this.isHovering = true;
      const video = this.$refs.video;
      if (!video) return;
      video.muted = true; // always muted on hover
      this.isMuted = true;

      const savedMute = localStorage.getItem('nexfi_video_muted');
      // Keep muted on hover for browser autoplay compat
      // But reflect saved pref after play starts
      if (video.readyState >= 2) {
        this._doHoverPlay(video);
      } else {
        // Pre-load and play when ready
        video.load();
        const onReady = () => {
          video.removeEventListener('canplay', onReady);
          if (this.isHovering) this._doHoverPlay(video);
        };
        video.addEventListener('canplay', onReady);
      }
    },

    _doHoverPlay(video) {
      video.muted = true;
      video.currentTime = 0;
      video.play().catch(() => {
        // Autoplay blocked — silently fail, user must click
      });
    },

    onHoverEnd() {
      this.isHovering = false;
      const video = this.$refs.video;
      if (video && !video.paused) {
        video.pause();
        video.currentTime = 0;
      }
    },

    // ─── Non-feedMode auto-play on scroll-into-view ───────────────────────────
    initObserver() {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          this.isVisible = entry.isIntersecting;
          if (entry.isIntersecting) {
            this.playVideo();
          } else {
            this.pauseVideo();
          }
        });
      }, { threshold: 0.3, rootMargin: '0px' });
      this.observer.observe(this.$refs.container);
    },

    playVideo() {
      const video = this.$refs.video;
      if (!video) return;
      if (this.feedMode) {
        // Feed mode autoplay is always muted initially
        video.muted = true;
        this.isMuted = true;
      } else {
        const savedMute = localStorage.getItem('nexfi_video_muted');
        this.isMuted = savedMute !== 'false';
        video.muted = this.isMuted;
      }
      const promise = video.play();
      if (promise !== undefined) {
        promise.catch(() => {
          this.isPlaying = false;
        });
      }
    },

    onCanPlay() {
      const video = this.$refs.video;
      if (!video) return;
      if (this.feedMode) return; // Don't auto-play in feed mode
      video.muted = true;
      this.isMuted = true;
      if (this.isVisible && video.paused) {
        video.play().catch(() => { this.isPlaying = false; });
      }
    },

    onLoadedData() {
      const video = this.$refs.video;
      if (!video) return;
      if (this.feedMode) return; // Defer to hover
      const savedMute = localStorage.getItem('nexfi_video_muted');
      this.isMuted = savedMute !== 'false';
      video.muted = this.isMuted;
      if (this.isVisible && video.paused) {
        video.play().catch(() => { this.isPlaying = false; });
      }
    },

    pauseVideo() {
      const video = this.$refs.video;
      if (video) video.pause();
    },

    togglePlay() {
      const video = this.$refs.video;
      if (!video) return;
      if (video.paused) {
        video.play();
        this.flashRipple(play);
      } else {
        video.pause();
        this.flashRipple(pause);
      }
    },

    // Unified click handler
    handleContainerClick() {
      if (this.feedMode) {
        this.$emit('open-in-feed');
      } else {
        this.togglePlay();
      }
    },

    toggleMute() {
      const video = this.$refs.video;
      if (!video) return;
      const newState = !this.isMuted;
      video.muted = newState;
      this.isMuted = newState;
      localStorage.setItem('nexfi_video_muted', newState);
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'nexfi_video_muted',
        newValue: String(newState)
      }));
    },

    seekTo(event) {
      const video = this.$refs.video;
      const track = this.$refs.progressTrack;
      if (!video || !track || !this.duration) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      video.currentTime = ratio * this.duration;
    },

    onPlaying() { this.isPlaying = true; },
    onPause() { this.isPlaying = false; },
    onTimeUpdate() {
      const video = this.$refs.video;
      if (video) this.currentTime = video.currentTime;
    },
    onMetadata() {
      const video = this.$refs.video;
      if (video) {
        this.duration = video.duration;
        this.isPortrait = video.videoHeight > video.videoWidth;
      }
    },

    flashRipple(icon) {
      this.rippleIcon = icon;
      this.showRipple = true;
      if (this.rippleTimer) clearTimeout(this.rippleTimer);
      this.rippleTimer = setTimeout(() => { this.showRipple = false; }, 600);
    },

    formatTime(secs) {
      if (!secs || isNaN(secs)) return '0:00';
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    }
  }
};
</script>

<style scoped>
.video-container {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0b0f14;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 180px;
  max-height: 480px;
}

.video-container.is-portrait {
  aspect-ratio: 3 / 4;
}

.video-container.is-landscape {
  aspect-ratio: 16 / 9;
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #000;
  transition: opacity 0.2s ease;
}

/* Hide video element when poster is showing */
.video-player.video-hidden {
  opacity: 0;
  position: absolute;
  pointer-events: none;
}

/* ── Feed mode: Poster thumbnail ── */
.feed-poster {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease;
}

.feed-poster::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.15);
}

.feed-poster-play {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feed-poster-play-circle {
  width: 52px;
  height: 52px;
  background: rgba(0, 0, 0, 0.65);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  border: 2px solid rgba(255, 255, 255, 0.35);
  transition: transform 0.2s ease, background 0.2s ease;
}

.video-container:hover .feed-poster-play-circle {
  transform: scale(1.1);
  background: rgba(0, 0, 0, 0.8);
}

.feed-poster-play-icon {
  font-size: 24px;
  color: #fff;
  margin-left: 3px; /* optical center for play triangle */
}

.feed-duration-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  z-index: 10;
  letter-spacing: 0.3px;
}

/* ── Feed mode hovering overlays ── */
.feed-muted-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.65);
  color: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  z-index: 20;
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  pointer-events: auto;
  transition: transform 0.15s ease, background 0.15s ease;
}

.feed-muted-badge:hover {
  background: rgba(0, 0, 0, 0.85);
  transform: scale(1.1);
}

.feed-muted-badge:active {
  transform: scale(0.9);
}

.feed-hover-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 10px 12px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 50%);
  z-index: 12;
  pointer-events: none;
}

.feed-hover-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 12px;
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  letter-spacing: 0.3px;
  animation: hintFadeIn 0.2s ease;
}

@keyframes hintFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.feed-hint-icon {
  font-size: 13px;
}

/* ── Play/Pause ripple ── */
.ripple-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 20;
}

.ripple-icon {
  width: 72px;
  height: 72px;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
}

.ripple-icon ion-icon {
  font-size: 38px;
  color: #fff;
}

.ripple-fade-enter-active {
  animation: rippleIn 0.15s ease;
}
.ripple-fade-leave-active {
  animation: rippleOut 0.45s ease forwards;
}
@keyframes rippleIn {
  from { transform: scale(0.6); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
@keyframes rippleOut {
  from { transform: scale(1);   opacity: 1; }
  to   { transform: scale(1.4); opacity: 0; }
}

/* ── Paused big play button (non-feed mode) ── */
.play-indicator {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  background: rgba(0, 0, 0, 0.25);
  transition: background 0.25s ease;
  pointer-events: none;
}

.play-button {
  width: 62px;
  height: 62px;
  background: rgba(218, 165, 32, 0.92);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
  transition: transform 0.2s ease;
}

.play-button ion-icon {
  font-size: 32px;
  margin-left: 4px;
}

/* ── Bottom controls bar (non-feed mode) ── */
.controls-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 10px 8px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, transparent 100%);
  z-index: 10;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.video-container:hover .controls-bar,
.video-container:focus-within .controls-bar {
  opacity: 1;
}

.video-container:not(.is-playing) .controls-bar {
  opacity: 1;
}

.progress-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  cursor: pointer;
  margin-bottom: 6px;
  position: relative;
  transition: height 0.15s ease;
}

.progress-track:hover {
  height: 6px;
}

.progress-fill {
  height: 100%;
  background: #daa520;
  border-radius: 2px;
  transition: width 0.1s linear;
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.time-display {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.mute-btn {
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.mute-btn:hover {
  background: rgba(218, 165, 32, 0.8);
  transform: scale(1.1);
}

.mute-btn:active {
  transform: scale(0.9);
}

.mute-btn ion-icon {
  font-size: 16px;
}

.mute-btn.is-muted {
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
}
</style>
