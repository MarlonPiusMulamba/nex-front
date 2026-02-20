<template>
  <ion-modal :is-open="isOpen" @did-dismiss="closeModal" class="audio-space-modal">
    <div class="space-container">
      <!-- Header -->
      <div class="space-header">
        <ion-button fill="clear" @click="minimize" class="minimize-btn">
          <ion-icon :icon="chevronDownOutline"></ion-icon>
        </ion-button>
        <div class="space-title-row">
          <span class="live-tag">LIVE</span>
          <h2>{{ space?.title || 'Audio Space' }}</h2>
        </div>
        <ion-button fill="clear" color="danger" @click="confirmLeave">
          <ion-icon :icon="powerOutline"></ion-icon>
        </ion-button>
      </div>

      <!-- Speakers Area -->
      <div class="speakers-grid">
        <div class="speaker-card" v-for="speaker in speakers" :key="speaker.id">
          <div class="avatar-wrapper" :class="{ 'is-speaking': speaker.isSpeaking }">
            <img :src="getAvatarUrl(speaker.profile_pic)" />
            <div class="mic-status" :class="{ 'is-muted': speaker.isMuted }">
              <ion-icon :icon="speaker.isMuted ? micOff : mic"></ion-icon>
            </div>
          </div>
          <span class="speaker-name">{{ speaker.first_name || speaker.username }}</span>
          <span class="speaker-role">{{ speaker.role }}</span>
        </div>
      </div>

      <!-- Listeners Area -->
      <div class="listeners-section">
        <h3>Listeners ({{ listeners.length }})</h3>
        <div class="listeners-scroll">
          <div class="listener-item" v-for="listener in listeners" :key="listener.id">
             <img :src="getAvatarUrl(listener.profile_pic)" />
             <span>{{ listener.first_name || listener.username }}</span>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="space-controls">
        <ion-button fill="clear" class="control-btn" @click="toggleMic">
           <div class="icon-circle" :class="{ 'active': !isMuted }">
             <ion-icon :icon="isMuted ? micOffOutline : micOutline"></ion-icon>
           </div>
           <span>Mic</span>
        </ion-button>
        
        <ion-button fill="clear" class="control-btn" @click="raiseHand">
           <div class="icon-circle">
             <ion-icon :icon="handLeftOutline"></ion-icon>
           </div>
           <span>Raise Hand</span>
        </ion-button>

        <ion-button fill="clear" class="control-btn" @click="react('heart')">
           <div class="icon-circle">
             <ion-icon :icon="heartOutline"></ion-icon>
           </div>
           <span>React</span>
        </ion-button>
      </div>
    </div>
  </ion-modal>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { IonModal, IonButton, IonIcon } from '@ionic/vue';
import { 
  chevronDownOutline, powerOutline, mic, micOff, 
  micOutline, micOffOutline, handLeftOutline, heartOutline 
} from 'ionicons/icons';

const props = defineProps({
  isOpen: Boolean,
  space: Object,
  currentUser: Object
});

const emit = defineEmits(['close', 'minimize', 'leave']);

// Mock State
const isMuted = ref(true);
const speakers = ref([]);
const listeners = ref([]);

// Initialize with mock data or props
watch(() => props.space, (newSpace) => {
  if (newSpace) {
    // Determine if current user is host
    const isHost = props.currentUser?.id == newSpace.host_user_id; // strict equality might need check
    
    // Setup initial lists (mocking for UI dev)
    speakers.value = [
      {
        id: newSpace.host_user_id,
        username: newSpace.host_username,
        first_name: newSpace.host_first_name,
        profile_pic: newSpace.host_profile_pic,
        role: 'Host',
        isSpeaking: true,
        isMuted: false
      }
    ];

    // Add current user if not host
    if (!isHost && props.currentUser) {
        listeners.value.push({
            id: props.currentUser.id,
            username: props.currentUser.username,
            profile_pic: props.currentUser.profile_pic,
            role: 'Listener'
        });
    }
  }
}, { immediate: true });

const getAvatarUrl = (path) => {
  if (!path) return 'https://ionicframework.com/docs/img/demos/avatar.svg';
  if (path.startsWith('http')) return path;
  return `https://nexback.pythonanywhere.com${path}`;
};

const closeModal = () => {
  emit('close');
};

const minimize = () => {
    emit('minimize');
};

const confirmLeave = () => {
    if (confirm('Leave this space?')) {
        emit('leave');
    }
};

const toggleMic = () => {
    isMuted.value = !isMuted.value;
};

const raiseHand = () => {
    // Todo: Emit signal
    console.log('Raised hand');
};

const react = (type) => {
    // Todo: Emit reaction
    console.log('Reacted', type);
};
</script>

<style scoped>
.audio-space-modal {
  --background: #111;
}

.space-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1a2e 0%, #000 100%);
  color: white;
  padding: 20px;
}

.space-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
}

.space-title-row {
  text-align: center;
}

.live-tag {
  background: #ff4961;
  color: white;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 4px;
}

.space-title-row h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.speakers-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding: 10px;
  margin-bottom: 30px;
}

.speaker-card {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar-wrapper {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 35% 35% 35% 35% / 35% 35% 35% 35%; /* Squircle-ish */
  margin-bottom: 8px;
  transition: all 0.2s;
}

.avatar-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  border: 2px solid transparent;
}

.avatar-wrapper.is-speaking img {
  border-color: #8a2be2;
  box-shadow: 0 0 15px rgba(138, 43, 226, 0.6);
}

.mic-status {
  position: absolute;
  bottom: -5px;
  right: -5px;
  background: white;
  color: black;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.mic-status.is-muted {
  background: #ff4961;
  color: white;
}

.speaker-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.speaker-role {
  font-size: 11px;
  color: #888;
  background: rgba(255,255,255,0.1);
  padding: 2px 6px;
  border-radius: 99px;
  margin-top: 2px;
}

.listeners-section {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border-radius: 20px;
  padding: 16px;
}

.listeners-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.listeners-scroll {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 12px;
  overflow-y: auto;
  max-height: 200px;
}

.listener-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.listener-item img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 4px;
}

.listener-item span {
  font-size: 11px;
  color: #ccc;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.space-controls {
  display: flex;
  justify-content: space-around;
  padding: 20px 0;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.control-btn {
  --color: white;
  height: auto;
  display: flex;
  flex-direction: column;
}

.icon-circle {
  width: 50px;
  height: 50px;
  background: rgba(255,255,255,0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.icon-circle.active {
  background: #8a2be2;
  color: white;
  box-shadow: 0 0 15px rgba(138, 43, 226, 0.4);
}

.control-btn span {
  font-size: 11px;
  color: #888;
}
</style>
