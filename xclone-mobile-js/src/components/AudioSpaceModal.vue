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
          <!-- Request Badge for Host -->
          <ion-button v-if="isHost && pendingRequests.length > 0" fill="clear" @click="showRequests = true" class="requests-badge-btn">
             <ion-icon :icon="notificationsOutline"></ion-icon>
             <span class="badge-count">{{ pendingRequests.length }}</span>
          </ion-button>
          
          <ion-button fill="clear" @click="minimize" class="icon-only-btn">
            <ion-icon :icon="chevronDownOutline"></ion-icon>
          </ion-button>
          <ion-button fill="clear" @click="confirmLeave" class="icon-only-btn danger">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </div>
      </div>

      <!-- Requests Panel Overlay -->
      <div v-if="showRequests" class="requests-overlay" @click="showRequests = false">
        <div class="requests-panel" @click.stop>
          <div class="panel-header">
            <h3>Join Requests</h3>
            <ion-button fill="clear" @click="showRequests = false">
              <ion-icon :icon="close"></ion-icon>
            </ion-button>
          </div>
          <div class="requests-list">
            <div v-for="req in pendingRequests" :key="req.id" class="request-item">
              <div class="user-info">
                <ion-avatar class="req-avatar">
                  <img :src="getAvatarUrl(req.profile_pic)" />
                </ion-avatar>
                <div class="user-names">
                  <span class="full-name">{{ req.first_name }} {{ req.last_name }}</span>
                  <span class="username">@{{ req.username }}</span>
                </div>
              </div>
              <div class="req-actions">
                <ion-button fill="clear" color="success" size="small" @click="handleRequest(req.id, 'approved')">Approve</ion-button>
                <ion-button fill="clear" color="danger" size="small" @click="handleRequest(req.id, 'denied')">Deny</ion-button>
              </div>
            </div>
            <div v-if="pendingRequests.length === 0" class="no-requests">
              No pending requests
            </div>
          </div>
        </div>
      </div>

      <!-- Waiting for Approval Guest State -->
      <div v-if="!isHost && props.space?.is_locked && !isApproved" class="waiting-overlay">
        <div class="waiting-content">
          <ion-spinner name="crescent" color="warning"></ion-spinner>
          <h3>Access Restricted</h3>
          <p>Waiting for the host to approve your join request…</p>
          <ion-button fill="outline" color="light" @click="confirmLeave">Cancel</ion-button>
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
  handLeft, notificationsOutline, close
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

// Recording State
const mediaRecorder = ref(null);
const recordedChunks = [];
const isRecording = ref(false);

// Locked Talk State
const pendingRequests = ref([]);
const showRequests = ref(false);
const isApproved = ref(false);

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

const handleJoinRequest = (e) => {
    if (String(e.detail.space_id) === String(props.space?.id)) {
        fetchPendingRequests();
    }
};

const handleJoinRequestStatus = (e) => {
    if (String(e.detail.space_id) === String(props.space?.id)) {
        if (e.detail.status === 'approved') {
            isApproved.value = true;
            syncState();
        } else if (e.detail.status === 'denied') {
            alert('Your request to join was denied.');
            emit('leave');
        }
    }
};

const fetchPendingRequests = async () => {
    if (!isHost.value || !props.space) return;
    try {
        const res = await axios.get(`${API_URL}/api/audio-spaces/${props.space.id}/requests`, {
            params: { host_id: props.currentUser.id }
        });
        if (res.data.success) {
            pendingRequests.value = res.data.requests;
        }
    } catch (err) {
        console.error('Fetch requests error:', err);
    }
};

const handleRequest = async (requestId, status) => {
    try {
        const res = await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/requests/${requestId}/approve`, {
            host_id: props.currentUser.id,
            status: status
        });
        if (res.data.success) {
            pendingRequests.value = pendingRequests.value.filter(r => r.id !== requestId);
        }
    } catch (err) {
        console.error('Handle request error:', err);
    }
};

const checkMyApproval = async () => {
    if (isHost.value || !props.space || !props.currentUser) return;
    try {
        const res = await axios.get(`${API_URL}/api/audio-spaces/${props.space.id}/request_status`, {
            params: { user_id: props.currentUser.id }
        });
        if (res.data.success && res.data.status === 'approved') {
            isApproved.value = true;
        }
    } catch (err) {
        console.error('Check approval error:', err);
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
    // Join socket room
    if (props.space) {
        socketService.joinRoom(`space_${props.space.id}`);
        // Also join personal room for notifications
        if (props.currentUser) {
            socketService.joinRoom(`user_${props.currentUser.id}`);
        }
    }

    if (props.space?.is_locked) {
        if (isHost.value) {
            fetchPendingRequests();
        } else {
            checkMyApproval();
        }
    }

    // Initial sync
    syncState();
    
    window.addEventListener('space:ended', handleSpaceEnded);
    window.addEventListener('space:participant_joined', handleParticipantJoined);
    window.addEventListener('space:state_updated', handleStateUpdated);
    window.addEventListener('join_request', handleJoinRequest);
    window.addEventListener('join_request_status', handleJoinRequestStatus);

    // Initial recording start if host
    if (props.space?.host_user_id === props.currentUser?.id) {
       startRecording();
    }
  }
});

const startRecording = () => {
  if (!localStream.value) {
     // Wait for stream if not ready (e.g. camera not yet toggled, but recording should capture what's there)
     // Actually, we should probably only record if there's a stream, or record a placeholder.
     // For now, let's start recording as soon as we have a stream.
     return;
  }
  try {
    recordedChunks.value = [];
    const options = { mimeType: 'video/webm; codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
       options.mimeType = 'video/webm';
    }
    
    mediaRecorder.value = new MediaRecorder(localStream.value, options);
    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    
    mediaRecorder.value.onstop = uploadRecording;
    mediaRecorder.value.start();
    isRecording.value = true;
    console.log('⏺️ Recording started');
  } catch (err) {
    console.error('Failed to start recording:', err);
  }
};

const uploadRecording = async () => {
    if (recordedChunks.length === 0) return;
    
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const formData = new FormData();
    formData.append('file', blob, 'meeting_recording.webm');
    
    try {
        console.log('📤 Uploading recording...');
        const res = await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/recording`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        console.log('✅ Recording uploaded:', res.data.recording_url);
    } catch (err) {
        console.error('Failed to upload recording:', err);
    }
};

onUnmounted(() => {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop();
  }
  stopTracks();
  window.removeEventListener('space:ended', handleSpaceEnded);
  window.removeEventListener('space:participant_joined', handleParticipantJoined);
  window.removeEventListener('space:state_updated', handleStateUpdated);
  window.removeEventListener('join_request', handleJoinRequest);
  window.removeEventListener('join_request_status', handleJoinRequestStatus);
});

const stopTracks = () => {
  if (localStream.value) {
    localStream.value.getTracks().forEach(track => track.stop());
    localStream.value = null;
  }
};

watch(() => props.space, (newSpace) => {
  if (newSpace) {
    // Initializing remote participants as empty for real-time join events
    remoteParticipants.value = [];
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

        // Auto-start recording if host and not already recording
        if (props.space?.host_user_id === props.currentUser?.id && !isRecording.value) {
            startRecording();
        }
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
    
    // Stop recording before ending
    if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
        mediaRecorder.value.stop();
    }
    
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
  background: rgba(255, 215, 0, 0.15); /* Gold background */
  padding: 4px 8px;
  border-radius: 4px;
  gap: 6px;
  margin-bottom: 4px;
  width: fit-content;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.live-indicator .dot {
  width: 6px;
  height: 6px;
  background: #FFD700; /* Gold dot */
  border-radius: 50%;
  box-shadow: 0 0 10px #FFD700;
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
  color: #FFD700; /* Gold text */
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
  --color: #FFD700; /* Use Gold instead of Red for consistency */
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
  border-color: #FFD700;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
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

.hand-badge { color: #FFD700; }
.mute-badge { color: #FFD700; }

/* Controls */
.meeting-controls {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  padding: 12px;
  background: rgba(18, 18, 18, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 215, 0, 0.2);
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
  background: rgba(255, 255, 255, 0.05);
  color: #555;
  border: 1px solid rgba(255, 215, 0, 0.1);
}

.ctrl-btn.sharing {
  background: #FFD700;
  color: #000;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.4);
}

.ctrl-btn.active {
  background: #FFD700;
  color: #000;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.4);
}

.ctrl-btn.end-btn, .ctrl-btn.leave-btn {
  background: rgba(255, 215, 0, 0.1);
  color: #FFD700;
  border: 1px solid #FFD700;
  margin-left: 8px;
}

.ctrl-btn.end-btn:hover { 
  background: #FFD700; 
  color: #000;
}

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

/* Locked Talk Styles */
.requests-badge-btn {
  position: relative;
  --color: #ffd700;
}

.badge-count {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #ff4444;
  color: #fff;
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  font-weight: 800;
  border: 1px solid #000;
}

.requests-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(10px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.requests-panel {
  background: #1a1a1a;
  border: 1px solid #ffd700;
  border-radius: 20px;
  width: 100%;
  max-width: 400px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
}

.panel-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
}

.panel-header h3 {
  margin: 0;
  color: #ffd700;
  font-size: 18px;
  font-weight: 700;
}

.requests-list {
  padding: 12px;
  overflow-y: auto;
}

.request-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  margin-bottom: 8px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.req-avatar {
  width: 40px;
  height: 40px;
  border: 1px solid #ffd700;
}

.user-names {
  display: flex;
  flex-direction: column;
}

.full-name { font-weight: 600; font-size: 14px; }
.username { font-size: 12px; color: #888; }

.req-actions {
  display: flex;
  gap: 4px;
}

.no-requests {
  text-align: center;
  padding: 40px;
  color: #888;
  font-style: italic;
}

/* Waiting Overlay */
.waiting-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #000;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 30px;
}

.waiting-content h3 {
  color: #ffd700;
  font-size: 24px;
  margin: 20px 0 10px;
}

.waiting-content p {
  color: #aaa;
  margin-bottom: 30px;
}
</style>
