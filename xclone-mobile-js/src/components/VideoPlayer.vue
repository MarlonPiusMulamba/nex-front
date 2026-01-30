<template>
  <div class="video-container" ref="container">
    <video
      ref="video"
      :src="videoSrc"
      :poster="poster"
      class="video-player"
      playsinline
      webkit-playsinline
      muted
      loop
      preload="metadata"
      @click="togglePlay"
      @playing="isPlaying = true"
      @pause="isPlaying = false"
    ></video>
    
    <div class="mute-overlay" @click.stop="toggleMute" :class="{ 'is-muted': isMuted }">
      <ion-icon :icon="isMuted ? volumeMute : volumeHigh"></ion-icon>
    </div>
    
    <div class="play-indicator" v-if="!isPlaying" @click="togglePlay">
      <div class="play-button">
        <ion-icon :icon="play"></ion-icon>
      </div>
    </div>
  </div>
</template>

<script>
import { IonIcon } from '@ionic/vue';
import { volumeHigh, volumeMute, play, pause } from 'ionicons/icons';

export default {
  name: 'VideoPlayer',
  components: { IonIcon },
  props: {
    src: {
      type: String,
      required: true
    },
    poster: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      isPlaying: false,
      isMuted: true,
      volumeHigh,
      volumeMute, // Fixed: template used 'volumeMute' correctly but logic should ensure consistency
      play,
      pause,
      observer: null
    };
  },
  computed: {
    videoSrc() {
      if (!this.src) return '';
      // Append #t=0.1 to force first frame as thumbnail in most browsers
      const baseSrc = this.src.includes('#t=') ? this.src : `${this.src}#t=0.1`;
      return baseSrc;
    }
  },
  mounted() {
    this.initObserver();
  },
  beforeUnmount() {
    if (this.observer) {
      this.observer.disconnect();
    }
  },
  methods: {
    initObserver() {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.playVideo();
          } else {
            this.pauseVideo();
          }
        });
      }, { threshold: 0.5 });
      
      this.observer.observe(this.$refs.container);
    },
    playVideo() {
      const video = this.$refs.video;
      if (video) {
        video.play().catch(() => {
          // Auto-play might be blocked by browser if not muted
          // But we have 'muted' attribute, so it should be fine
        });
      }
    },
    pauseVideo() {
      const video = this.$refs.video;
      if (video) {
        video.pause();
      }
    },
    togglePlay() {
      const video = this.$refs.video;
      if (!video) return;
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    },
    toggleMute() {
      const video = this.$refs.video;
      if (video) {
        video.muted = !video.muted;
        this.isMuted = video.muted;
      }
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
  max-height: 450px;
  background-color: #0b0f14;
  margin: 8px 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.video-player {
  width: 100%;
  height: auto;
  max-height: 450px;
  object-fit: contain;
  display: block;
}

.mute-overlay {
  position: absolute;
  bottom: 15px;
  right: 15px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  backdrop-filter: blur(8px);
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.mute-overlay:active {
  transform: scale(0.9);
  background: rgba(29, 155, 240, 0.8);
}

.mute-overlay.is-muted {
  border-color: rgba(255, 255, 255, 0.1);
}

.mute-overlay ion-icon {
  font-size: 20px;
}

.play-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  background: rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: background 0.3s ease;
}

.video-container:hover .play-indicator {
  background: rgba(0, 0, 0, 0.3);
}

.play-button {
  width: 60px;
  height: 60px;
  background: rgba(218, 165, 32, 0.95); /* Using NexFi Gold */
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(0,0,0,0.4);
  transform: scale(1);
  transition: transform 0.2s ease;
}

.play-button:hover {
  transform: scale(1.1);
}

.play-button ion-icon {
  font-size: 32px;
  margin-left: 4px;
}
</style>
