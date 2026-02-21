<template>
  <div class="audio-space-card" @click.stop>
    <!-- Live Badge & Status -->
    <div class="space-header">
      <div class="live-badge" v-if="localSpace.status === 'live'">
        <div class="equalizer">
          <span></span><span></span><span></span><span></span>
        </div>
        LIVE
      </div>
      <div class="ended-badge" v-else>
        Ended
      </div>
      
      <div class="listener-count" v-if="localSpace.status === 'live'">
        <ion-icon :icon="peopleOutline"></ion-icon>
        {{ localSpace.participant_count || 0 }} listening
      </div>
    </div>

    <!-- Main Content -->
    <div class="space-content">
      <h3 class="space-title">{{ localSpace.title }}</h3>
      
      <div class="host-row">
        <ion-avatar class="host-avatar">
          <img :src="getAvatarUrl(localSpace.host_profile_pic)" />
          <div class="mic-badge">
            <ion-icon :icon="mic"></ion-icon>
          </div>
        </ion-avatar>
        <div class="host-info">
          <span class="host-label">Hosted by</span>
          <span class="host-name">{{ localSpace.host_first_name }} {{ localSpace.host_last_name }}</span>
          <span class="host-username">@{{ localSpace.host_username }}</span>
        </div>
      </div>

      <!-- Listeners Preview (if any) -->
      <div class="listeners-preview" v-if="localSpace.top_listeners && localSpace.top_listeners.length > 0">
        <div class="avatar-pile">
          <ion-avatar 
            v-for="(pic, index) in localSpace.top_listeners.slice(0, 3)" 
            :key="index"
            class="listener-avatar"
            :style="{ zIndex: 10 - index }"
          >
            <img :src="getAvatarUrl(pic)" />
          </ion-avatar>
        </div>
        <span class="more-listeners" v-if="localSpace.participant_count > 3">
          +{{ localSpace.participant_count - 3 }} others
        </span>
      </div>

      <!-- Action Button -->
      <ion-button 
        expand="block" 
        class="join-btn"
        :class="{ 'btn-live': localSpace.status === 'live', 'btn-ended': localSpace.status !== 'live' }"
        @click="joinSpace"
      >
        {{ localSpace.status === 'live' ? 'Join Space' : 'View Recording' }}
      </ion-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { IonIcon, IonAvatar, IonButton } from '@ionic/vue';
import { mic, peopleOutline } from 'ionicons/icons';
import config from '@/config/index.js';

const API_URL = config.api.baseURL;

const props = defineProps({
  space: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['join-space']);

const localSpace = computed(() => props.space);

const getAvatarUrl = (path) => {
  if (!path) return 'https://ionicframework.com/docs/img/demos/avatar.svg';
  if (path.startsWith('http')) return path;
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

const joinSpace = () => {
    emit('join-space', localSpace.value);
};
</script>

<style scoped>
.audio-space-card {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(138, 43, 226, 0.3); /* Purple border */
  border-radius: 16px;
  padding: 16px;
  margin-top: 10px;
  color: white;
  position: relative;
  overflow: hidden;
}

/* Ambient Glow */
.audio-space-card::before {
  content: '';
  position: absolute;
  top: -50px;
  right: -50px;
  width: 150px;
  height: 150px;
  background: radial-gradient(circle, rgba(138, 43, 226, 0.4) 0%, transparent 70%);
  filter: blur(20px);
  z-index: 0;
}

.space-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
}

.live-badge {
  display: flex;
  align-items: center;
  background: rgba(138, 43, 226, 0.2);
  color: #c471ed; /* Bright pastel purple */
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  border: 1px solid rgba(138, 43, 226, 0.5);
  box-shadow: 0 0 10px rgba(138, 43, 226, 0.3);
}

.equalizer {
  display: flex;
  align-items: flex-end;
  height: 12px;
  margin-right: 6px;
  gap: 2px;
}

.equalizer span {
  width: 2px;
  background: #c471ed;
  animation: equalize 1s infinite ease-in-out;
}

.equalizer span:nth-child(1) { height: 6px; animation-delay: 0.0s; }
.equalizer span:nth-child(2) { height: 10px; animation-delay: 0.2s; }
.equalizer span:nth-child(3) { height: 8px; animation-delay: 0.4s; }
.equalizer span:nth-child(4) { height: 5px; animation-delay: 0.1s; }

@keyframes equalize {
  0%, 100% { transform: scaleY(0.5); }
  50% { transform: scaleY(1.2); }
}

.ended-badge {
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.listener-count {
  display: flex;
  align-items: center;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  gap: 4px;
}

.space-content {
  position: relative;
  z-index: 1;
}

.space-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 12px 0;
  line-height: 1.3;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.host-row {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.host-avatar {
  width: 40px;
  height: 40px;
  margin-right: 10px;
  position: relative;
  border: 2px solid #8a2be2;
}

.mic-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: #8a2be2;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
  border: 1px solid #1a1a2e;
}

.host-info {
  display: flex;
  flex-direction: column;
}

.host-label {
  font-size: 0.7rem;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.host-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: white;
}

.host-username {
  font-size: 0.8rem;
  color: #888;
}

.listeners-preview {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.avatar-pile {
  display: flex;
  align-items: center;
}

.listener-avatar {
  width: 24px;
  height: 24px;
  border: 2px solid #1a1a2e;
  margin-right: -8px;
}

.more-listeners {
  margin-left: 12px;
  font-size: 0.8rem;
  color: #aaa;
}

.join-btn {
  --background: #8a2be2;
  --background-hover: #7b27cc;
  --background-activated: #6a22b0;
  --border-radius: 8px;
  --box-shadow: 0 4px 12px rgba(138, 43, 226, 0.3);
  font-weight: 600;
  letter-spacing: 0.5px;
  margin: 0;
}

.btn-ended {
  --background: rgba(255, 255, 255, 0.1);
  --color: #aaa;
  --box-shadow: none;
}
</style>
