<template>
  <ion-modal :is-open="isOpen" @did-dismiss="closeModal" class="audio-space-modal">
    <div class="space-container">
      <!-- Header -->
      <div class="meeting-header">
        <div class="header-left">
          <div class="live-indicator">
            <div class="dot"></div>
            <span>LIVE</span>
          </div>
          <h2 class="meeting-title">{{ space?.title || 'NexFi Meeting' }}</h2>
        </div>
        <div class="header-right">
          <ion-button fill="clear" @click="minimize" class="icon-only-btn">
            <ion-icon :icon="chevronDownOutline"></ion-icon>
          </ion-button>
          <ion-button fill="clear" @click="confirmLeave" class="icon-only-btn danger">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </div>
      </div>

      <!-- Video Grid -->
      <div class="meeting-viewport" :class="gridClass">
        <!-- Local Participant -->
        <div class="participant-tile local" :class="{ 'is-speaking': !isMuted && isSpeaking }">
          <div class="video-wrapper">
             <video ref="localVideo" autoplay playsinline muted v-show="isVideoOn"></video>
             <div class="avatar-fallback" v-if="!isVideoOn">
               <img :src="getAvatarUrl(currentUser?.profile_pic)" />
             </div>
             <div class="tile-badges">
               <div v-if="handRaised" class="badge hand-badge">
                 <ion-icon :icon="handLeft"></ion-icon>
               </div>
               <div v-if="isMuted" class="badge mute-badge">
                 <ion-icon :icon="micOff"></ion-icon>
               </div>
             </div>
             <div class="participant-label">You</div>
          </div>
        </div>

        <!-- Remote Participants -->
        <div 
          v-for="p in remoteParticipants" 
          :key="p.id" 
          class="participant-tile"
          :class="{ 'is-speaking': p.isSpeaking }"
        >
          <div class="video-wrapper">
             <video :ref="el => setRemoteVideo(el, p.id)" autoplay playsinline v-show="p.isVideoOn"></video>
             <div class="avatar-fallback" v-if="!p.isVideoOn">
               <img :src="getAvatarUrl(p.profile_pic)" />
             </div>
             <div class="tile-badges">
               <div v-if="p.handRaised" class="badge hand-badge">
                 <ion-icon :icon="handLeft"></ion-icon>
               </div>
               <div v-if="p.isMuted" class="badge mute-badge">
                 <ion-icon :icon="micOff"></ion-icon>
               </div>
             </div>
             <div class="participant-label">{{ p.first_name || p.username }}</div>
          </div>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="meeting-controls">
        <button class="ctrl-btn" :class="{ 'off': isMuted }" @click="toggleMic" title="Toggle Mic">
          <ion-icon :icon="isMuted ? micOffOutline : micOutline"></ion-icon>
        </button>
        <button class="ctrl-btn" :class="{ 'off': !isVideoOn }" @click="toggleCamera" title="Toggle Camera">
          <ion-icon :icon="isVideoOn ? videocamOutline : videocamOffOutline"></ion-icon>
        </button>
        <button class="ctrl-btn" :class="{ 'sharing': isScreenSharing }" @click="toggleScreenShare" title="Share Screen">
          <ion-icon :icon="desktopOutline"></ion-icon>
        </button>
        <button class="ctrl-btn" :class="{ 'active': handRaised }" @click="toggleHand" title="Raise Hand">
          <ion-icon :icon="handLeftOutline"></ion-icon>
        </button>
        <button class="ctrl-btn end-btn" @click="confirmEnd" v-if="isHost" title="End Meeting">
          <ion-icon :icon="powerOutline"></ion-icon>
        </button>
        <button class="ctrl-btn leave-btn" @click="confirmLeave" v-else title="Leave Meeting">
          <ion-icon :icon="logOutOutline"></ion-icon>
        </button>
      </div>
    </div>
  </ion-modal>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { IonModal, IonButton, IonIcon } from '@ionic/vue';
import { 
  chevronDownOutline, powerOutline, mic, micOff, 
  micOutline, micOffOutline, handLeftOutline, heartOutline,
  videocamOutline, videocamOffOutline, desktopOutline, logOutOutline, closeOutline,
  handLeft
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config/index.js';
import socketService from '@/utils/socketService.js';

const API_URL = config.api.baseURL;

const props = defineProps({
  isOpen: Boolean,
  space: Object,
  currentUser: Object
});

const emit = defineEmits(['close', 'minimize', 'leave']);

// State
const isMuted = ref(true);
const isVideoOn = ref(false);
const isScreenSharing = ref(false);
const handRaised = ref(false);
const isSpeaking = ref(false); // Can bind to volume analysis

const localStream = ref(null);
const localVideo = ref(null);
const remoteParticipants = ref([]); // Unified list

const gridClass = computed(() => {
  const count = 1 + remoteParticipants.value.length;
  if (count === 1) return 'grid-1';
  if (count === 2) return 'grid-2';
  if (count <= 4) return 'grid-4';
  return 'grid-many';
});

const isHost = computed(() => {
  return props.currentUser && props.space && String(props.currentUser.id) === String(props.space.host_user_id);
});

// Participant video ref management
const remoteVideoRefs = {};
const setRemoteVideo = (el, id) => {
  if (el) remoteVideoRefs[id] = el;
};

// State update function
const syncState = async () => {
  if (!props.space || !props.currentUser) return;
  try {
    await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/state`, {
      user_id: props.currentUser.id,
      state: {
        is_muted: isMuted.value,
        is_video_on: isVideoOn.value,
        is_screen_sharing: isScreenSharing.value,
        hand_raised: handRaised.value
      }
    });
  } catch (err) {
    console.error('Failed to sync state:', err);
  }
};

// Real-time Event Handlers
const handleSpaceEnded = (e) => {
  if (String(e.detail.space_id) === String(props.space?.id)) {
    emit('leave');
  }
};

const handleParticipantJoined = (e) => {
  if (String(e.detail.space_id) === String(props.space?.id)) {
    if (String(e.detail.user_id) !== String(props.currentUser?.id)) {
       // Refresh participants or add to list
       console.log('New participant joined:', e.detail.user_id);
       // In a full WebRTC app, this would trigger an ICE offer
    }
  }
};

const handleStateUpdated = (e) => {
  if (String(e.detail.space_id) === String(props.space?.id)) {
    const { user_id, state } = e.detail;
    if (String(user_id) === String(props.currentUser?.id)) return;

    const p = remoteParticipants.value.find(p => String(p.id) === String(user_id));
    if (p) {
      if (state.is_muted !== undefined) p.isMuted = state.is_muted;
      if (state.is_video_on !== undefined) p.isVideoOn = state.is_video_on;
      if (state.hand_raised !== undefined) p.handRaised = state.hand_raised;
    }
  }
};

onMounted(() => {
  if (props.isOpen) {
    // Initial sync
    syncState();
    // Join socket room
    if (props.space) {
        socketService.joinRoom(`space_${props.space.id}`);
    }
    
    window.addEventListener('space:ended', handleSpaceEnded);
    window.addEventListener('space:participant_joined', handleParticipantJoined);
    window.addEventListener('space:state_updated', handleStateUpdated);
  }
});

onUnmounted(() => {
  stopTracks();
  window.removeEventListener('space:ended', handleSpaceEnded);
  window.removeEventListener('space:participant_joined', handleParticipantJoined);
  window.removeEventListener('space:state_updated', handleStateUpdated);
});

const stopTracks = () => {
  if (localStream.value) {
    localStream.value.getTracks().forEach(track => track.stop());
    localStream.value = null;
  }
};

watch(() => props.space, (newSpace) => {
  if (newSpace) {
    // Determine if current user is host
    // Mocking remote participants for UI design (replace with actual WebRTC/Socket logic later)
    remoteParticipants.value = [
      {
        id: 999,
        username: 'UserA',
        first_name: 'Alice',
        profile_pic: '',
        isMuted: false,
        isVideoOn: false,
        handRaised: true,
        isSpeaking: true
      },
      {
        id: 888,
        username: 'UserB',
        profile_pic: '',
        isMuted: true,
        isVideoOn: false,
        handRaised: false,
        isSpeaking: false
      }
    ];
  }
}, { immediate: true });

const getAvatarUrl = (path) => {
  if (!path) return 'https://ionicframework.com/docs/img/demos/avatar.svg';
  if (path.startsWith('http')) return path;
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
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
    if (localStream.value) {
      localStream.value.getAudioTracks().forEach(t => t.enabled = !isMuted.value);
    }
    syncState();
};

const toggleCamera = async () => {
    try {
      if (!isVideoOn.value) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: !isMuted.value });
        if (localStream.value) {
           // Replace/Add video track
           const videoTrack = stream.getVideoTracks()[0];
           const existingTracks = localStream.value.getTracks();
           existingTracks.forEach(t => { if(t.kind==='video') t.stop(); });
           localStream.value.addTrack(videoTrack);
        } else {
           localStream.value = stream;
        }
        if (localVideo.value) {
          localVideo.value.srcObject = localStream.value;
        }
        isVideoOn.value = true;
      } else {
        localStream.value.getVideoTracks().forEach(t => t.stop());
        isVideoOn.value = false;
      }
      syncState();
    } catch (err) {
      console.error('Camera access error:', err);
      alert('Camera access failed');
    }
};

const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing.value) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        // Handling screen sharing usually involves WebRTC renegotiation in real apps
        // For UI purposes, we'll just show the local switch
        isScreenSharing.value = true;
        // Auto stop when user clicks browser's "Stop sharing"
        stream.getVideoTracks()[0].onended = () => {
           isScreenSharing.value = false;
           syncState();
        };
      } else {
        isScreenSharing.value = false;
      }
      syncState();
    } catch (err) {
       console.error('Screen sharing error:', err);
    }
};

const toggleHand = () => {
    handRaised.value = !handRaised.value;
    syncState();
};

const endSpace = async () => {
    if (!confirm('Are you sure you want to end this space for everyone?')) return;
    
    try {
        const res = await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/end`, {
            user_id: props.currentUser.id
        });
        if (res.data.success) {
            emit('leave');
        } else {
            alert(res.data.message || 'Failed to end space');
        }
    } catch (err) {
        console.error('End space error:', err);
        alert('Error: ' + (err.response?.data?.message || err.message));
    }
};

const confirmEnd = () => {
    if (confirm('End this meeting for everyone?')) {
        endSpace();
    }
};
</script>

<style scoped>
.audio-space-modal {
  --background: #000;
  --height: 100%;
  --width: 100%;
}

.space-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #000;
  color: #fff;
  padding: 0;
  overflow: hidden;
}

/* Header */
.meeting-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
}

.live-indicator {
  display: flex;
  align-items: center;
  background: rgba(255, 73, 97, 0.2);
  padding: 4px 8px;
  border-radius: 4px;
  gap: 6px;
  margin-bottom: 4px;
  width: fit-content;
}

.live-indicator .dot {
  width: 6px;
  height: 6px;
  background: #ff4961;
  border-radius: 50%;
  box-shadow: 0 0 10px #ff4961;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}

.live-indicator span {
  font-size: 10px;
  font-weight: 800;
  color: #ff4961;
}

.meeting-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.icon-only-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  --color: #fff;
  font-size: 20px;
}

.icon-only-btn.danger {
  --color: #ff4961;
}

/* Viewport / Grid */
.meeting-viewport {
  flex: 1;
  display: grid;
  padding: 16px;
  gap: 12px;
  margin-top: 60px;
  margin-bottom: 100px;
  align-content: center;
}

.grid-1 { grid-template-columns: 1fr; }
.grid-2 { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.grid-many { grid-template-columns: 1fr 1fr; }

.participant-tile {
  background: #1a1a1a;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  transition: all 0.3s ease;
  aspect-ratio: 4/3;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
}

.participant-tile.is-speaking {
  border-color: #8a2be2;
  box-shadow: 0 0 15px rgba(138, 43, 226, 0.3);
}

.video-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-wrapper video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1); /* Mirror local/remote video for natural feel */
}

.avatar-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar-fallback img {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  background: #333;
}

.participant-label {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}

.tile-badges {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
}

.badge {
  width: 28px;
  height: 28px;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.hand-badge { color: #ffeb3b; }
.mute-badge { color: #ff4961; }

/* Controls */
.meeting-controls {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  padding: 12px;
  background: rgba(26, 26, 26, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 40px;
  z-index: 100;
}

.ctrl-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.1);
  color: #fff;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.ctrl-btn:active { transform: scale(0.9); }

.ctrl-btn.off {
  background: #ff4961;
  color: #fff;
}

.ctrl-btn.sharing {
  background: #00e676;
  color: #000;
}

.ctrl-btn.active {
  background: #ffeb3b;
  color: #000;
}

.ctrl-btn.end-btn, .ctrl-btn.leave-btn {
  background: #ff4961;
  margin-left: 8px;
}

.ctrl-btn.end-btn:hover { background: #d32f2f; }

@media (max-width: 480px) {
  .meeting-viewport {
     margin-bottom: 120px;
  }
  .meeting-controls {
     gap: 8px;
     padding: 8px;
  }
  .ctrl-btn {
     width: 42px;
     height: 42px;
     font-size: 18px;
  }
}
</style>
