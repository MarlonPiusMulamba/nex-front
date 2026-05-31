<template>
  <ion-modal :is-open="isOpen" @did-dismiss="closeModal" class="recording-modal">
    <div class="recording-container">
      <!-- Header -->
      <div class="recording-header">
        <ion-button @click="closeModal" fill="clear" class="close-btn">
          <ion-icon :icon="closeOutline"></ion-icon>
        </ion-button>
        <h2 class="recording-title">{{ space.title }}</h2>
      </div>

      <!-- Video/Audio Player -->
      <div class="player-container">
        <video
          v-if="isVideo"
          ref="videoPlayer"
          :src="recordingUrl"
          controls
          class="video-player"
          @error="handleError"
        ></video>
        <audio
          v-else
          ref="audioPlayer"
          :src="recordingUrl"
          controls
          class="audio-player"
          @error="handleError"
        ></audio>
      </div>

      <!-- Space Info -->
      <div class="space-info">
        <div class="host-row">
          <ion-avatar class="host-avatar">
            <img :src="getAvatarUrl(space.host_profile_pic)" />
          </ion-avatar>
          <div class="host-info">
            <span class="host-label">Hosted by</span>
            <span class="host-name">{{ space.host_first_name }} {{ space.host_last_name }}</span>
            <span class="host-username">@{{ space.host_username }}</span>
          </div>
        </div>
        <div class="ended-time" v-if="space.ended_at">
          <ion-icon :icon="timeOutline"></ion-icon>
          Ended {{ formatTime(space.ended_at) }}
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="error-message">
        <ion-icon :icon="alertCircleOutline"></ion-icon>
        {{ error }}
      </div>
    </div>
  </ion-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { IonModal, IonButton, IonIcon, IonAvatar } from '@ionic/vue';
import { closeOutline, timeOutline, alertCircleOutline } from 'ionicons/icons';
import config from '@/config/index.js';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  space: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close']);

const videoPlayer = ref(null);
const audioPlayer = ref(null);
const error = ref(null);

const recordingUrl = computed(() => {
  if (!props.space.recording_url) return '';
  const url = props.space.recording_url;
  // If it's a relative path, prepend the API URL
  if (url.startsWith('/')) {
    return `${config.api.baseURL}${url}`;
  }
  return url;
});

const isVideo = computed(() => {
  return recordingUrl.value.endsWith('.webm') || 
         recordingUrl.value.endsWith('.mp4') || 
         recordingUrl.value.endsWith('.mov');
});

const closeModal = () => {
  emit('close');
  error.value = null;
};

const handleError = () => {
  error.value = 'Failed to load recording. The file may not be available.';
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const getAvatarUrl = (path) => {
  if (!path) return 'https://ionicframework.com/docs/img/demos/avatar.svg';
  if (path.startsWith('http')) return path;
  return `${config.api.baseURL}${path.startsWith('/') ? '' : '/'}${path}`;
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    error.value = null;
  }
});
</script>

<style scoped>
.recording-modal {
  --background: rgba(0, 0, 0, 0.9);
}

.recording-container {
  background: #0d1117;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: white;
}

.recording-header {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.close-btn {
  --color: white;
  margin-right: 12px;
}

.recording-title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.player-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #000;
}

.video-player {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
}

.audio-player {
  width: 100%;
  max-width: 600px;
}

.space-info {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.host-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.host-avatar {
  width: 48px;
  height: 48px;
  margin-right: 12px;
}

.host-info {
  display: flex;
  flex-direction: column;
}

.host-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.host-name {
  font-size: 14px;
  font-weight: 500;
}

.host-username {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.ended-time {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.ended-time ion-icon {
  margin-right: 6px;
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #ff6b6b;
  font-size: 14px;
}

.error-message ion-icon {
  margin-right: 8px;
  font-size: 20px;
}
</style>
