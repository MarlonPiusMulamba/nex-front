<template>
  <div class="video-container" ref="container">
    <video
      ref="video"
      :src="videoSrc"
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
    
    <div class="mute-overlay" @click.stop="toggleMute">
      <ion-icon :icon="isMuted ? volumeMuted : volumeHigh"></ion-icon>
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
import { volumeHigh, volumeMuted, play, pause } from 'ionicons/icons';

export default {
  name: 'VideoPlayer',
  components: { IonIcon },
  props: {
    src: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      isPlaying: false,
      isMuted: true,
      volumeHigh,
      volumeMuted,
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
  border-radius: inherit;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 500px;
  background-color: #000;
}

.video-player {
  width: 100%;
  height: auto;
  max-height: 500px;
  object-fit: contain;
  display: block;
}

.mute-overlay {
  position: absolute;
  bottom: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  backdrop-filter: blur(4px);
}

.mute-overlay ion-icon {
  font-size: 16px;
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
  background: rgba(0, 0, 0, 0.1);
  cursor: pointer;
}

.play-button {
  width: 50px;
  height: 50px;
  background: rgba(29, 155, 240, 0.9);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.play-button ion-icon {
  font-size: 24px;
  margin-left: 2px;
}
</style>
