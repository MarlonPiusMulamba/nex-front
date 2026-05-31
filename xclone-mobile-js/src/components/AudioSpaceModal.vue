<template>
  <ion-modal :is-open="isOpen" @did-dismiss="closeModal" class="audio-space-modal">
    <div class="space-container">
      <!-- Top Header -->
      <div class="meeting-header">
        <div class="header-left">
          <div class="live-indicator">
            <div class="dot"></div>
            <span>LIVE</span>
          </div>
          <h2 class="meeting-title">{{ space?.title || 'NexFi Talk' }}</h2>
          <div class="timer-badge" v-if="formattedTime">{{ formattedTime }}</div>
          <div class="recording-badge" v-if="isRecording">
            <div class="rec-dot"></div> REC
          </div>
        </div>
        <div class="header-right">
          <!-- Pending Requests -->
          <ion-button v-if="isHost && pendingRequests.length > 0" fill="clear" @click="showRequests = true" class="badge-btn">
             <ion-icon :icon="notificationsOutline"></ion-icon>
             <span class="badge-count">{{ pendingRequests.length }}</span>
          </ion-button>
          
          <!-- Sidebar Toggles -->
          <ion-button fill="clear" @click="toggleSidebar('participants')" :class="{ 'active-btn': activeSidebar === 'participants' }">
            <ion-icon :icon="peopleOutline"></ion-icon>
            <span class="btn-label">{{ participantCount }}</span>
          </ion-button>
          <ion-button fill="clear" @click="toggleSidebar('chat')" :class="{ 'active-btn': activeSidebar === 'chat' }">
            <ion-icon :icon="chatbubbleOutline"></ion-icon>
            <div v-if="unreadChatCount > 0" class="unread-dot"></div>
          </ion-button>
          
          <ion-button fill="clear" @click="minimize" class="icon-only-btn minimize-btn">
            <ion-icon :icon="chevronDownOutline"></ion-icon>
          </ion-button>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="main-content">
        <!-- Video Grid -->
        <div class="meeting-viewport" :class="[gridClass, { 'sidebar-open': activeSidebar }]">
          
          <!-- Floating Reactions -->
          <div class="floating-reactions">
            <transition-group name="float-up">
              <div v-for="r in activeReactions" :key="r.id" class="floating-emoji" :style="{ left: r.left + '%' }">
                {{ r.emoji }}
                <span class="reactor-name">{{ r.username }}</span>
              </div>
            </transition-group>
          </div>

          <!-- Local Participant -->
          <div class="participant-tile local" :class="{ 'is-speaking': isSpeaking }">
            <div class="video-wrapper">
               <video ref="localVideo" autoplay playsinline muted v-show="isVideoOn"></video>
               <div class="avatar-fallback" v-if="!isVideoOn">
                 <img :src="getAvatarUrl(currentUser?.profile_pic)" />
               </div>
               
               <div class="tile-overlays">
                 <div class="participant-label">
                   <ion-icon v-if="isHost" :icon="star" class="role-icon host"></ion-icon>
                   You
                 </div>
                 <div class="tile-badges">
                   <div v-if="handRaised" class="badge hand-badge"><ion-icon :icon="handLeft"></ion-icon></div>
                   <div v-if="isMuted" class="badge mute-badge"><ion-icon :icon="micOff"></ion-icon></div>
                 </div>
               </div>
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
               
               <div class="tile-overlays">
                 <div class="participant-label">
                   <ion-icon v-if="String(p.id) === String(space?.host_user_id)" :icon="star" class="role-icon host"></ion-icon>
                   {{ p.first_name || p.username }}
                 </div>
                 <div class="tile-badges">
                   <div v-if="p.handRaised" class="badge hand-badge"><ion-icon :icon="handLeft"></ion-icon></div>
                   <div v-if="p.isMuted" class="badge mute-badge"><ion-icon :icon="micOff"></ion-icon></div>
                 </div>
               </div>
               
               <!-- Host Controls Overlay -->
               <div v-if="isHost" class="host-controls-overlay">
                 <button @click.stop="forceMute(p.id)" title="Force Mute" class="hc-btn"><ion-icon :icon="micOff"></ion-icon></button>
                 <button @click.stop="removeParticipant(p.id)" title="Remove" class="hc-btn danger"><ion-icon :icon="closeOutline"></ion-icon></button>
               </div>
            </div>
          </div>
        </div>

        <!-- Right Sidebar -->
        <div class="sidebar-panel" v-if="activeSidebar">
          <div class="sidebar-header">
            <h3>{{ activeSidebar === 'participants' ? 'Participants' : 'In-call Messages' }}</h3>
            <button @click="activeSidebar = null" class="close-sidebar-btn"><ion-icon :icon="closeOutline"></ion-icon></button>
          </div>
          
          <!-- Participants List -->
          <div class="sidebar-body" v-if="activeSidebar === 'participants'">
             <div class="participant-list-item local-user">
               <img :src="getAvatarUrl(currentUser?.profile_pic)" class="p-avatar" />
               <div class="p-info">
                 <span class="p-name">You ({{ currentUser?.username }})</span>
                 <span class="p-role" v-if="isHost">Host</span>
               </div>
               <div class="p-status">
                 <ion-icon v-if="handRaised" :icon="handLeft" class="text-warning"></ion-icon>
                 <ion-icon :icon="isMuted ? micOff : mic" :class="isMuted ? 'text-danger' : 'text-success'"></ion-icon>
               </div>
             </div>
             
             <div v-for="p in sortedRemoteParticipants" :key="p.id" class="participant-list-item">
               <img :src="getAvatarUrl(p.profile_pic)" class="p-avatar" />
               <div class="p-info">
                 <span class="p-name">{{ p.first_name || p.username }}</span>
                 <span class="p-role" v-if="String(p.id) === String(space?.host_user_id)">Host</span>
               </div>
               <div class="p-status">
                 <ion-icon v-if="p.handRaised" :icon="handLeft" class="text-warning"></ion-icon>
                 <ion-icon :icon="p.isMuted ? micOff : mic" :class="p.isMuted ? 'text-danger' : 'text-success'"></ion-icon>
               </div>
               
               <div class="p-actions" v-if="isHost">
                 <ion-button fill="clear" size="small" @click="forceMute(p.id)" :disabled="p.isMuted">
                   <ion-icon :icon="micOff" slot="icon-only"></ion-icon>
                 </ion-button>
                 <ion-button fill="clear" size="small" color="danger" @click="removeParticipant(p.id)">
                   <ion-icon :icon="logOutOutline" slot="icon-only"></ion-icon>
                 </ion-button>
               </div>
             </div>
          </div>
          
          <!-- Chat -->
          <div class="sidebar-body chat-body" v-if="activeSidebar === 'chat'">
             <div class="chat-messages" ref="chatContainer">
               <div v-if="chatMessages.length === 0" class="empty-chat">
                 <ion-icon :icon="chatbubblesOutline"></ion-icon>
                 <p>Messages sent here will be seen by everyone in the call.</p>
               </div>
               <div v-for="(msg, idx) in chatMessages" :key="idx" class="chat-message" :class="{'my-message': String(msg.sender.user_id) === String(currentUser?.id)}">
                 <div class="msg-header">
                   <span class="msg-sender">{{ String(msg.sender.user_id) === String(currentUser?.id) ? 'You' : msg.sender.username }}</span>
                   <span class="msg-time">{{ formatChatTime(msg.timestamp) }}</span>
                 </div>
                 <div class="msg-bubble">{{ msg.message }}</div>
               </div>
             </div>
             <div class="chat-input-area">
               <input v-model="chatInput" @keyup.enter="sendChatMessage" placeholder="Send a message..." class="chat-input" />
               <button @click="sendChatMessage" class="send-btn" :disabled="!chatInput.trim()">
                 <ion-icon :icon="sendOutline"></ion-icon>
               </button>
             </div>
          </div>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="meeting-controls-wrapper">
        <div class="meeting-controls">
          <div class="controls-left">
             <span class="meeting-time">{{ formattedTime }}</span>
          </div>
          
          <div class="controls-center">
            <button class="ctrl-btn main-btn" :class="{ 'danger': isMuted }" @click="toggleMic" :title="isMuted ? 'Turn on microphone' : 'Turn off microphone'">
              <ion-icon :icon="isMuted ? micOffOutline : micOutline"></ion-icon>
            </button>
            <button class="ctrl-btn main-btn" :class="{ 'danger': !isVideoOn }" @click="toggleCamera" :title="isVideoOn ? 'Turn off camera' : 'Turn on camera'">
              <ion-icon :icon="isVideoOn ? videocamOutline : videocamOffOutline"></ion-icon>
            </button>
            <button class="ctrl-btn" :class="{ 'active-share': isScreenSharing }" @click="toggleScreenShare" title="Present now">
              <ion-icon :icon="desktopOutline"></ion-icon>
            </button>
            <button class="ctrl-btn" :class="{ 'active-hand': handRaised }" @click="toggleHand" title="Raise hand">
              <ion-icon :icon="handLeftOutline"></ion-icon>
            </button>
            
            <div class="reactions-container">
              <button class="ctrl-btn" @click="showReactions = !showReactions" title="Send reaction">
                <ion-icon :icon="happyOutline"></ion-icon>
              </button>
              <div class="reactions-popup" v-if="showReactions">
                <button v-for="emoji in ['👍', '❤️', '😂', '🔥', '👏', '😮', '🎉', '🙌']" :key="emoji" @click="sendReaction(emoji)" class="reaction-btn">
                  {{ emoji }}
                </button>
              </div>
            </div>
            
            <button class="ctrl-btn end-btn" @click="confirmEnd" v-if="isHost" title="End call for everyone">
              <ion-icon :icon="powerOutline"></ion-icon>
            </button>
            <button class="ctrl-btn leave-btn" @click="confirmLeave" v-else title="Leave call">
              <ion-icon :icon="logOutOutline"></ion-icon>
            </button>
          </div>
          
          <div class="controls-right">
             <!-- Sidebar toggles also available here -->
             <button class="ctrl-btn small-btn" @click="toggleSidebar('participants')" :class="{ 'active-btn': activeSidebar === 'participants' }">
                <ion-icon :icon="peopleOutline"></ion-icon>
             </button>
             <button class="ctrl-btn small-btn" @click="toggleSidebar('chat')" :class="{ 'active-btn': activeSidebar === 'chat' }">
                <ion-icon :icon="chatbubbleOutline"></ion-icon>
             </button>
          </div>
        </div>
      </div>
      
      <!-- Locked Talk Requests Overlay -->
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
                <img :src="getAvatarUrl(req.profile_pic)" class="req-avatar" />
                <div class="user-names">
                  <span class="full-name">{{ req.first_name }} {{ req.last_name }}</span>
                  <span class="username">@{{ req.username }}</span>
                </div>
              </div>
              <div class="req-actions">
                <button class="req-btn approve" @click="handleRequest(req.id, 'approved')">Admit</button>
                <button class="req-btn deny" @click="handleRequest(req.id, 'denied')">Deny</button>
              </div>
            </div>
            <div v-if="pendingRequests.length === 0" class="no-requests">No pending requests</div>
          </div>
        </div>
      </div>

      <!-- Waiting for Approval Guest State -->
      <div v-if="!isHost && space?.is_locked && !isApproved" class="waiting-overlay">
        <div class="waiting-content">
          <div class="loading-pulse"></div>
          <h3>Asking to join...</h3>
          <p>You'll join the call when someone lets you in.</p>
          <button class="cancel-join-btn" @click="confirmLeave">Return to Home</button>
        </div>
      </div>

    </div>
  </ion-modal>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { IonModal, IonButton, IonIcon } from '@ionic/vue';
import { 
  chevronDownOutline, powerOutline, mic, micOff, 
  micOutline, micOffOutline, handLeftOutline, handLeft,
  videocamOutline, videocamOffOutline, desktopOutline, logOutOutline, closeOutline,
  notificationsOutline, close, peopleOutline, chatbubbleOutline, chatbubblesOutline,
  sendOutline, happyOutline, star
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

// Media State
const isMuted = ref(true);
const isVideoOn = ref(false);
const isScreenSharing = ref(false);
const handRaised = ref(false);
const isSpeaking = ref(false);

const localStream = ref(null);
const localVideo = ref(null);
const remoteParticipants = ref([]);

// Audio Analysis for speaking indicator
let audioContext = null;
let analyser = null;
let microphone = null;
let audioCheckInterval = null;

// UI State
const activeSidebar = ref(null); // 'participants', 'chat', null
const showReactions = ref(false);
const activeReactions = ref([]);
const chatMessages = ref([]);
const chatInput = ref('');
const unreadChatCount = ref(0);
const chatContainer = ref(null);

// Timer State
const startTime = ref(null);
const formattedTime = ref('00:00');
let timerInterval = null;

// Recording
const mediaRecorder = ref(null);
const recordedChunks = [];
const isRecording = ref(false);

// Locked State
const pendingRequests = ref([]);
const showRequests = ref(false);
const isApproved = ref(false);

// Computed
const isHost = computed(() => props.currentUser && props.space && String(props.currentUser.id) === String(props.space.host_user_id));
const participantCount = computed(() => 1 + remoteParticipants.value.length);
const sortedRemoteParticipants = computed(() => {
   return [...remoteParticipants.value].sort((a, b) => {
      if (a.handRaised && !b.handRaised) return -1;
      if (!a.handRaised && b.handRaised) return 1;
      return 0;
   });
});

const gridClass = computed(() => {
  const count = participantCount.value;
  if (count === 1) return 'grid-1';
  if (count === 2) return 'grid-2';
  if (count <= 4) return 'grid-4';
  if (count <= 6) return 'grid-6';
  return 'grid-many';
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

const setupAudioAnalysis = (stream) => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.5;
    
    // Check if stream has audio tracks
    if (stream.getAudioTracks().length > 0) {
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        audioCheckInterval = setInterval(() => {
          if (isMuted.value) {
            isSpeaking.value = false;
            return;
          }
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const average = sum / dataArray.length;
          isSpeaking.value = average > 15; // Threshold for speaking
        }, 200);
    }
  } catch (err) {
    console.error("Audio analysis setup failed:", err);
  }
};

const stopAudioAnalysis = () => {
    if (audioCheckInterval) clearInterval(audioCheckInterval);
    if (microphone) microphone.disconnect();
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    audioContext = null;
};

// Handlers
const toggleSidebar = (panel) => {
   if (activeSidebar.value === panel) {
      activeSidebar.value = null;
   } else {
      activeSidebar.value = panel;
      if (panel === 'chat') {
         unreadChatCount.value = 0;
         scrollToBottom();
      }
   }
};

const formatChatTime = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const scrollToBottom = () => {
   nextTick(() => {
      if (chatContainer.value) {
         chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
      }
   });
};

const sendChatMessage = async () => {
  if (!chatInput.value.trim()) return;
  const msg = chatInput.value;
  chatInput.value = '';
  try {
    await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/chat`, {
      user_id: props.currentUser.id,
      message: msg
    });
  } catch (err) {
    console.error('Chat error:', err);
  }
};

const sendReaction = async (emoji) => {
   showReactions.value = false;
   try {
    await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/reaction`, {
      user_id: props.currentUser.id,
      reaction: emoji
    });
  } catch (err) {
    console.error('Reaction error:', err);
  }
};

const forceMute = async (targetId) => {
   if (!isHost.value) return;
   try {
      await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/force-mute`, {
         host_id: props.currentUser.id,
         target_user_id: targetId
      });
   } catch (err) {
      console.error('Force mute error:', err);
   }
};

const removeParticipant = async (targetId) => {
   if (!isHost.value) return;
   if (!confirm("Remove this participant from the call?")) return;
   try {
      await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/remove-participant`, {
         host_id: props.currentUser.id,
         target_user_id: targetId
      });
      remoteParticipants.value = remoteParticipants.value.filter(p => String(p.id) !== String(targetId));
   } catch (err) {
      console.error('Remove error:', err);
   }
};

// Requests
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
       console.log('New participant joined:', e.detail.user_id);
    }
  }
};

const handleParticipantLeft = (e) => {
    if (String(e.detail.space_id) === String(props.space?.id)) {
        remoteParticipants.value = remoteParticipants.value.filter(p => String(p.id) !== String(e.detail.user_id));
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
    } else {
       // Participant might be new, fetch details or add placeholder
       remoteParticipants.value.push({
           id: user_id,
           username: `User ${user_id}`,
           first_name: `User`,
           profile_pic: '',
           isMuted: state.is_muted ?? true,
           isVideoOn: state.is_video_on ?? false,
           handRaised: state.hand_raised ?? false,
           isSpeaking: false
       });
    }
  }
};

const handleForceMuted = (e) => {
   if (String(e.detail.space_id) === String(props.space?.id)) {
      if (!isMuted.value) {
         toggleMic(); // Turn off mic
         alert("You have been muted by the host.");
      }
   }
};

const handleRemoved = (e) => {
    if (String(e.detail.space_id) === String(props.space?.id)) {
       alert("You have been removed from the call by the host.");
       emit('leave');
    }
};

const handleChatMessage = (e) => {
    if (String(e.detail.space_id) === String(props.space?.id)) {
        chatMessages.value.push(e.detail);
        if (activeSidebar.value !== 'chat') {
            unreadChatCount.value++;
        } else {
            scrollToBottom();
        }
    }
};

const handleReaction = (e) => {
    if (String(e.detail.space_id) === String(props.space?.id)) {
        const id = Date.now() + Math.random();
        activeReactions.value.push({
            id,
            emoji: e.detail.reaction,
            username: e.detail.username,
            left: Math.floor(Math.random() * 80) + 10 // Random horizontal position
        });
        setTimeout(() => {
            activeReactions.value = activeReactions.value.filter(r => r.id !== id);
        }, 4000);
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

const updateTimer = () => {
   if (!startTime.value) return;
   const diff = Math.floor((Date.now() - startTime.value) / 1000);
   const m = Math.floor(diff / 60).toString().padStart(2, '0');
   const s = (diff % 60).toString().padStart(2, '0');
   formattedTime.value = `${m}:${s}`;
};

onMounted(() => {
  if (props.isOpen) {
    if (props.space) {
        socketService.joinRoom(`space_${props.space.id}`);
        if (props.currentUser) {
            socketService.joinRoom(`user_${props.currentUser.id}`);
        }
        startTime.value = new Date(props.space.created_at || Date.now()).getTime();
        timerInterval = setInterval(updateTimer, 1000);
        updateTimer();
    }

    if (props.space?.is_locked) {
        if (isHost.value) {
            fetchPendingRequests();
        } else {
            checkMyApproval();
        }
    }

    syncState();
    
    window.addEventListener('space:ended', handleSpaceEnded);
    window.addEventListener('space:participant_joined', handleParticipantJoined);
    window.addEventListener('space:participant_left', handleParticipantLeft);
    window.addEventListener('space:state_updated', handleStateUpdated);
    window.addEventListener('space:force_muted', handleForceMuted);
    window.addEventListener('space:removed', handleRemoved);
    window.addEventListener('space:chat_message', handleChatMessage);
    window.addEventListener('space:reaction', handleReaction);
    window.addEventListener('join_request', handleJoinRequest);
    window.addEventListener('join_request_status', handleJoinRequestStatus);

    if (props.space?.host_user_id === props.currentUser?.id) {
       startRecording();
    }
  }
});

const startRecording = () => {
  if (!localStream.value) return;
  try {
    recordedChunks.length = 0;
    const options = { mimeType: 'video/webm; codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options.mimeType = 'video/webm';
    
    mediaRecorder.value = new MediaRecorder(localStream.value, options);
    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.value.onstop = uploadRecording;
    mediaRecorder.value.start();
    isRecording.value = true;
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
        await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/recording`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    } catch (err) {
        console.error('Failed to upload recording:', err);
    }
};

const stopTracks = () => {
  if (localStream.value) {
    localStream.value.getTracks().forEach(track => track.stop());
    localStream.value = null;
  }
  stopAudioAnalysis();
};

onUnmounted(() => {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop();
  }
  stopTracks();
  if (timerInterval) clearInterval(timerInterval);
  window.removeEventListener('space:ended', handleSpaceEnded);
  window.removeEventListener('space:participant_joined', handleParticipantJoined);
  window.removeEventListener('space:participant_left', handleParticipantLeft);
  window.removeEventListener('space:state_updated', handleStateUpdated);
  window.removeEventListener('space:force_muted', handleForceMuted);
  window.removeEventListener('space:removed', handleRemoved);
  window.removeEventListener('space:chat_message', handleChatMessage);
  window.removeEventListener('space:reaction', handleReaction);
  window.removeEventListener('join_request', handleJoinRequest);
  window.removeEventListener('join_request_status', handleJoinRequestStatus);
});

watch(() => props.space, (newSpace) => {
  if (newSpace) remoteParticipants.value = [];
}, { immediate: true });

const getAvatarUrl = (path) => {
  if (!path) return 'https://ionicframework.com/docs/img/demos/avatar.svg';
  if (path.startsWith('http')) return path;
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

const closeModal = () => emit('close');
const minimize = () => emit('minimize');
const confirmLeave = () => { if (confirm('Leave this call?')) emit('leave'); };

const toggleMic = async () => {
    // If we don't have a stream yet, get one
    if (!localStream.value) {
        try {
            localStream.value = await navigator.mediaDevices.getUserMedia({ video: isVideoOn.value, audio: true });
            if (localVideo.value) localVideo.value.srcObject = localStream.value;
            setupAudioAnalysis(localStream.value);
            isMuted.value = false;
        } catch (e) {
            console.error("Mic error", e);
            alert("Microphone access required.");
            return;
        }
    } else {
        isMuted.value = !isMuted.value;
        localStream.value.getAudioTracks().forEach(t => t.enabled = !isMuted.value);
    }
    syncState();
};

const toggleCamera = async () => {
    try {
      if (!isVideoOn.value) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: !isMuted.value });
        if (localStream.value) {
           const videoTrack = stream.getVideoTracks()[0];
           const existingTracks = localStream.value.getTracks();
           existingTracks.forEach(t => { if(t.kind==='video') t.stop(); });
           localStream.value.addTrack(videoTrack);
        } else {
           localStream.value = stream;
           setupAudioAnalysis(stream);
        }
        if (localVideo.value) localVideo.value.srcObject = localStream.value;
        isVideoOn.value = true;
        
        if (props.space?.host_user_id === props.currentUser?.id && !isRecording.value) {
            startRecording();
        }
      } else {
        if(localStream.value) localStream.value.getVideoTracks().forEach(t => t.stop());
        isVideoOn.value = false;
      }
      syncState();
    } catch (err) {
      console.error('Camera error:', err);
      alert('Camera access failed');
    }
};

const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing.value) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        isScreenSharing.value = true;
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
    if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') mediaRecorder.value.stop();
    try {
        const res = await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/end`, {
            user_id: props.currentUser.id
        });
        if (res.data.success) emit('leave');
    } catch (err) {
        console.error('End space error:', err);
    }
};

const confirmEnd = () => {
    if (confirm('End this meeting for everyone?')) endSpace();
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.audio-space-modal {
  --background: #0d1117;
  --height: 100%;
  --width: 100%;
  font-family: 'Inter', sans-serif;
}

.space-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  color: #fff;
  overflow: hidden;
}

/* Header */
.meeting-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  z-index: 10;
  height: 60px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(220, 38, 38, 0.15);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(220, 38, 38, 0.3);
}

.live-indicator .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #ef4444; box-shadow: 0 0 8px #ef4444;
  animation: pulse 1.5s infinite;
}

.live-indicator span { font-size: 11px; font-weight: 700; color: #ef4444; }

.meeting-title { margin: 0; font-size: 16px; font-weight: 600; color: #e6edf3; }

.timer-badge { font-size: 14px; font-weight: 500; color: #8b949e; border-left: 1px solid #30363d; padding-left: 12px; font-variant-numeric: tabular-nums; }

.recording-badge {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; color: #8b949e;
}
.rec-dot { width: 6px; height: 6px; background: #8b949e; border-radius: 50%; }

.header-right { display: flex; align-items: center; gap: 8px; }

.header-right ion-button {
  --color: #8b949e;
  font-size: 20px;
  margin: 0;
  position: relative;
}
.header-right ion-button.active-btn { --color: #58a6ff; background: rgba(88,166,255,0.1); border-radius: 8px; }

.badge-count {
  position: absolute; top: 4px; right: 4px;
  background: #ef4444; color: #fff; font-size: 10px;
  padding: 2px 5px; border-radius: 10px; font-weight: 700;
}
.unread-dot {
  position: absolute; top: 6px; right: 6px;
  width: 8px; height: 8px; border-radius: 50%; background: #58a6ff;
}
.btn-label { font-size: 12px; margin-left: 4px; font-weight: 600; }

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.meeting-viewport {
  flex: 1;
  display: grid;
  padding: 16px;
  gap: 16px;
  align-content: center;
  transition: all 0.3s ease;
  position: relative;
}

.grid-1 { grid-template-columns: 1fr; max-width: 800px; margin: 0 auto; width: 100%; }
.grid-2 { grid-template-columns: 1fr 1fr; }
.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.grid-6 { grid-template-columns: repeat(3, 1fr); grid-template-rows: 1fr 1fr; }
.grid-many { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }

.sidebar-panel {
  width: 320px;
  background: #161b22;
  border-left: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  z-index: 5;
}

.sidebar-header {
  padding: 16px; border-bottom: 1px solid #30363d;
  display: flex; justify-content: space-between; align-items: center;
}
.sidebar-header h3 { margin: 0; font-size: 15px; font-weight: 600; color: #e6edf3; }
.close-sidebar-btn { background: none; border: none; color: #8b949e; font-size: 20px; cursor: pointer; }

.sidebar-body { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; }

/* Participants List */
.participant-list-item {
  display: flex; align-items: center; padding: 8px; border-radius: 8px; gap: 12px;
}
.participant-list-item:hover { background: rgba(255,255,255,0.05); }
.p-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: #21262d; }
.p-info { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.p-name { font-size: 14px; font-weight: 500; color: #e6edf3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.p-role { font-size: 11px; color: #8b949e; }
.p-status { display: flex; gap: 8px; font-size: 16px; }
.text-warning { color: #f59e0b; }
.text-danger { color: #f87171; }
.text-success { color: #34d399; }
.p-actions { display: flex; gap: 4px; margin-left: 8px; }

/* Chat */
.chat-body { padding: 0; }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.empty-chat { text-align: center; color: #8b949e; margin-top: 40px; font-size: 14px; }
.empty-chat ion-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
.chat-message { display: flex; flex-direction: column; align-items: flex-start; max-width: 90%; }
.chat-message.my-message { align-self: flex-end; align-items: flex-end; }
.msg-header { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
.msg-sender { font-size: 13px; font-weight: 600; color: #e6edf3; }
.msg-time { font-size: 11px; color: #8b949e; }
.msg-bubble { background: #21262d; padding: 8px 12px; border-radius: 0 12px 12px 12px; font-size: 14px; line-height: 1.4; color: #c9d1d9; word-break: break-word; }
.my-message .msg-bubble { background: #1f6feb; color: #fff; border-radius: 12px 0 12px 12px; }
.chat-input-area { padding: 12px 16px; border-top: 1px solid #30363d; display: flex; gap: 8px; background: #161b22; }
.chat-input { flex: 1; background: #0d1117; border: 1px solid #30363d; border-radius: 20px; padding: 8px 16px; color: #e6edf3; font-size: 14px; outline: none; }
.chat-input:focus { border-color: #58a6ff; }
.send-btn { background: #1f6feb; color: #fff; border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
.send-btn:disabled { background: #30363d; color: #8b949e; cursor: not-allowed; }

/* Participant Tiles */
.participant-tile {
  background: #21262d;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  transition: all 0.2s ease;
  aspect-ratio: 16/9;
  border: 3px solid transparent;
}
.participant-tile.is-speaking { border-color: #22c55e; box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.4); }

.video-wrapper { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
.video-wrapper video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }

.avatar-fallback img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; background: #30363d; }

.tile-overlays {
  position: absolute; inset: 0; pointer-events: none;
  display: flex; flex-direction: column; justify-content: space-between; padding: 12px;
}
.participant-label {
  align-self: flex-start; margin-top: auto;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 500;
  display: flex; align-items: center; gap: 6px; color: #fff;
}
.role-icon { font-size: 12px; }
.role-icon.host { color: #f59e0b; }

.tile-badges { align-self: flex-end; display: flex; gap: 6px; margin-bottom: auto; }
.badge { width: 28px; height: 28px; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.hand-badge { color: #f59e0b; background: #fff; }
.mute-badge { color: #ef4444; }

.host-controls-overlay {
  position: absolute; top: 12px; left: 12px; display: none; gap: 8px; z-index: 10;
}
.participant-tile:hover .host-controls-overlay { display: flex; }
.hc-btn { width: 32px; height: 32px; border-radius: 8px; background: rgba(0,0,0,0.7); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; backdrop-filter: blur(4px); transition: 0.2s; }
.hc-btn:hover { background: #30363d; }
.hc-btn.danger:hover { background: #ef4444; }

/* Reactions */
.floating-reactions { position: absolute; bottom: 0; left: 0; right: 0; height: 200px; pointer-events: none; z-index: 50; overflow: hidden; }
.floating-emoji {
  position: absolute; bottom: 0; font-size: 40px; display: flex; flex-direction: column; align-items: center;
  animation: floatUp 4s ease-out forwards;
}
.reactor-name { font-size: 11px; background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 4px; color: #fff; margin-top: 4px; white-space: nowrap; }

@keyframes floatUp {
  0% { transform: translateY(50px) scale(0.5); opacity: 0; }
  10% { transform: translateY(0) scale(1.2); opacity: 1; }
  20% { transform: translateY(-20px) scale(1); opacity: 1; }
  100% { transform: translateY(-300px) scale(1); opacity: 0; }
}

/* Controls Bar */
.meeting-controls-wrapper { padding: 16px; background: #0d1117; z-index: 20; border-top: 1px solid #30363d; }
.meeting-controls { display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto; width: 100%; }

.controls-left, .controls-right { display: flex; gap: 8px; flex: 1; align-items: center; }
.controls-right { justify-content: flex-end; }
.controls-center { display: flex; gap: 12px; justify-content: center; flex: 2; }

.meeting-time { font-size: 14px; font-weight: 500; color: #e6edf3; }

.ctrl-btn { width: 44px; height: 44px; border-radius: 50%; border: none; background: #30363d; color: #e6edf3; font-size: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
.ctrl-btn:hover { background: #484f58; }
.ctrl-btn.danger { background: #da3633; color: #fff; }
.ctrl-btn.danger:hover { background: #b3261e; }
.ctrl-btn.active-share { background: #58a6ff; color: #000; }
.ctrl-btn.active-hand { background: #f59e0b; color: #000; }

.end-btn, .leave-btn { width: auto; padding: 0 16px; border-radius: 24px; font-size: 24px; }

.reactions-container { position: relative; }
.reactions-popup { position: absolute; bottom: 56px; left: 50%; transform: translateX(-50%); background: #21262d; border: 1px solid #30363d; border-radius: 12px; padding: 8px; display: flex; gap: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
.reaction-btn { background: none; border: none; font-size: 24px; cursor: pointer; padding: 4px; transition: 0.2s; border-radius: 8px; }
.reaction-btn:hover { background: #30363d; transform: scale(1.2); }

/* Overlays */
.requests-overlay, .waiting-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.requests-panel { background: #161b22; border: 1px solid #30363d; border-radius: 16px; width: 100%; max-width: 400px; max-height: 80vh; display: flex; flex-direction: column; }
.panel-header { padding: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; }
.panel-header h3 { margin: 0; font-size: 16px; color: #e6edf3; }
.requests-list { padding: 12px; overflow-y: auto; }
.request-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #21262d; border-radius: 8px; margin-bottom: 8px; }
.user-info { display: flex; align-items: center; gap: 12px; }
.req-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.user-names { display: flex; flex-direction: column; }
.full-name { font-weight: 500; font-size: 14px; color: #e6edf3; }
.username { font-size: 12px; color: #8b949e; }
.req-actions { display: flex; gap: 8px; }
.req-btn { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; }
.req-btn.approve { background: #238636; color: #fff; }
.req-btn.deny { background: transparent; border: 1px solid #8b949e; color: #c9d1d9; }

.waiting-content { text-align: center; }
.loading-pulse { width: 40px; height: 40px; border: 3px solid #58a6ff; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
@keyframes spin { to { transform: rotate(360deg); } }
.waiting-content h3 { color: #e6edf3; font-size: 20px; margin: 0 0 8px; }
.waiting-content p { color: #8b949e; margin-bottom: 24px; }
.cancel-join-btn { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 8px 16px; border-radius: 8px; font-weight: 500; cursor: pointer; }

@media (max-width: 768px) {
  .main-content { flex-direction: column; }
  .sidebar-panel { width: 100%; height: 40vh; border-left: none; border-top: 1px solid #30363d; }
  .meeting-controls-wrapper { padding: 12px 8px; }
  .controls-left, .controls-right { display: none; }
  .grid-many { grid-template-columns: 1fr 1fr; }
}
</style>
