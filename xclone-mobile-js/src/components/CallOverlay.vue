<template>
  <div v-if="callStatus !== 'idle'" class="call-overlay">
    <ion-modal :is-open="callStatus !== 'idle'" backdrop-dismiss="false">
      <ion-header>
        <ion-toolbar color="primary">
          <ion-title>
            {{ isCaller ? (callStatus === 'calling' ? 'Calling...' : 'In Call') : (callStatus === 'ringing' ? 'Incoming Call' : 'In Call') }}
          </ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <div class="call-container">
          <div v-if="callStatus === 'ringing' || callStatus === 'calling'" class="call-info">
             <div class="caller-name">{{ otherUser?.username || 'User' }}</div>
             <div class="call-media-type">{{ callMedia === 'video' ? 'Video Call' : 'Audio Call' }}</div>
          </div>

          <div v-show="callMedia === 'video'" class="video-call">
            <video ref="remoteVideo" autoplay playsinline class="remote-video"></video>
            <video ref="localVideo" autoplay muted playsinline class="local-video"></video>
          </div>
          <audio v-show="callMedia === 'voice'" ref="remoteAudio" autoplay></audio>

          <div class="call-controls">
            <template v-if="!isCaller && callStatus === 'ringing'">
              <ion-button color="success" shape="round" class="action-btn" @click="acceptCall()">
                <ion-icon slot="icon-only" :icon="callIcon"></ion-icon>
              </ion-button>
              <ion-button color="danger" shape="round" class="action-btn" @click="hangupCall()">
                <ion-icon slot="icon-only" :icon="closeIcon"></ion-icon>
              </ion-button>
            </template>
            <template v-else>
              <ion-button color="danger" shape="round" class="hangup-btn" @click="hangupCall()">
                <ion-icon slot="start" :icon="closeIcon"></ion-icon>
                Hang Up
              </ion-button>
            </template>
          </div>
        </div>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script>
import { 
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon 
} from '@ionic/vue';
import { callOutline, closeOutline, videocamOutline } from 'ionicons/icons';
import axios from 'axios';

export default {
  name: 'CallOverlay',
  components: {
    IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon
  },
  data() {
    return {
      callStatus: 'idle', // idle, calling, ringing, in_call
      callMedia: 'voice',
      isCaller: false,
      currentCallId: null,
      localStream: null,
      pc: null,
      otherUser: null,
      API_URL: '',
      userId: null,
      incomingPollInterval: null,
      callPollInterval: null,
      knownCallerCandidates: [],
      knownCalleeCandidates: [],
      iceConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      },
      callIcon: callOutline,
      closeIcon: closeOutline,
      videoIcon: videocamOutline,
      callTimeout: null
    };
  },
  mounted() {
    this.API_URL = import.meta.env.VITE_API_URL || '';
    this.userId = localStorage.getItem('userId');

    window.addEventListener('start-call', (e) => {
      const { media, user } = e.detail;
      this.startCall(media, user);
    });

    this.startGlobalPolling();
  },
  beforeUnmount() {
    this.stopGlobalPolling();
    this.hangupCall();
  },
  methods: {
    startGlobalPolling() {
      this.stopGlobalPolling();
      if (!this.userId) return;
      this.incomingPollInterval = setInterval(() => {
        if (this.callStatus === 'idle') {
          this.pollIncomingCalls();
        }
      }, 3000);
    },
    stopGlobalPolling() {
      if (this.incomingPollInterval) {
        clearInterval(this.incomingPollInterval);
        this.incomingPollInterval = null;
      }
    },

    async pollIncomingCalls() {
      if (!this.userId) return;
      try {
        const res = await axios.get(`${this.API_URL}/api/call/incoming`, { params: { user_id: this.userId } });
        const calls = (res.data && res.data.calls) || [];
        if (calls.length > 0) {
          const match = calls[0];
          this.incomingCall(match);
        }
      } catch (_) {}
    },

    incomingCall(match) {
      this.currentCallId = match.call_id;
      this.callMedia = match.media || 'voice';
      this.isCaller = false;
      this.callStatus = 'ringing';
      this.otherUser = { user_id: match.caller_id, username: 'Incoming Call' };
      // Fetch user details if possible
      this.fetchOtherUserDetails(match.caller_id);
    },

    async fetchOtherUserDetails(userId) {
       try {
         // Assuming there's a way to get user info by ID, otherwise just show ID
         // For now, we'll just keep the generic 'Incoming Call'
       } catch (_) {}
    },

    async requestCapacitorPermissions(media) {
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
          if (navigator.permissions && navigator.permissions.query) {
             const cam = await navigator.permissions.query({ name: 'camera' });
             const mic = await navigator.permissions.query({ name: 'microphone' });
             if (cam.state === 'denied' || mic.state === 'denied') {
               alert('Camera or Microphone permission is denied. Please enable them in Android Settings.');
               return false;
             }
          }
        } catch (e) {
          console.warn('Silent permission check failed:', e);
        }
      }
      return true;
    },

    async startCall(media, otherUser) {
      if (this.callStatus !== 'idle') return;
      try {
        this.otherUser = otherUser;
        this.callMedia = media;
        this.isCaller = true;
        this.callStatus = 'calling';

        const hasPerms = await this.requestCapacitorPermissions(media);
        if (!hasPerms) {
          this.hangupCall();
          return;
        }

        await this.attachLocalMedia(media);
        
        const res = await axios.post(`${this.API_URL}/api/call/start`, {
          caller_id: this.userId,
          callee_id: otherUser.user_id,
          media: media
        });

        if (res.data && res.data.call_id) {
          this.currentCallId = res.data.call_id;
          await this.setupPeerConnection('caller');
          this.callPollInterval = setInterval(() => this.pollCallState(), 2000);
          
          // Set a timeout for no-answer
          this.callTimeout = setTimeout(() => {
             if (this.callStatus === 'calling') {
                alert('No answer.');
                this.hangupCall();
             }
          }, 45000);
        } else {
          throw new Error('Could not start call');
        }
      } catch (e) {
        alert('Call failed: ' + e.message);
        this.hangupCall();
      }
    },

    async acceptCall() {
      if (this.callStatus !== 'ringing') return;
      try {
        const hasPerms = await this.requestCapacitorPermissions(this.callMedia);
        if (!hasPerms) {
          this.hangupCall();
          return;
        }
        await this.attachLocalMedia(this.callMedia);
        await this.setupPeerConnection('callee');
        this.callStatus = 'in_call';
        this.callPollInterval = setInterval(() => this.pollCallState(), 2000);
      } catch (e) {
        alert('Could not accept call: ' + e.message);
        this.hangupCall();
      }
    },

    async hangupCall() {
      if (this.currentCallId) {
        axios.post(`${this.API_URL}/api/call/hangup`, { call_id: this.currentCallId }).catch(() => {});
      }
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
        this.localStream = null;
      }
      if (this.pc) {
        this.pc.close();
        this.pc = null;
      }
      if (this.callPollInterval) {
        clearInterval(this.callPollInterval);
        this.callPollInterval = null;
      }
      if (this.callTimeout) {
        clearTimeout(this.callTimeout);
        this.callTimeout = null;
      }
      this.callStatus = 'idle';
      this.currentCallId = null;
      this.knownCallerCandidates = [];
      this.knownCalleeCandidates = [];
    },

    async pollCallState() {
      if (!this.currentCallId) return;
      try {
        const res = await axios.get(`${this.API_URL}/api/call/state`, { params: { call_id: this.currentCallId } });
        const call = res.data && res.data.call;
        if (!call) return;

        if (call.status === 'ended') {
          this.hangupCall();
          return;
        }

        if (this.isCaller && call.answer && this.pc && this.pc.signalingState !== 'stable') {
          await this.pc.setRemoteDescription(new RTCSessionDescription(call.answer));
          this.callStatus = 'in_call';
          if (this.callTimeout) clearTimeout(this.callTimeout);
        }

        const addIfNew = async (cand, seenArr) => {
          const key = JSON.stringify(cand);
          if (!seenArr.includes(key)) {
            seenArr.push(key);
            try { await this.pc.addIceCandidate(cand); } catch (_) {}
          }
        };

        if (this.pc) {
          if (this.isCaller && Array.isArray(call.callee_candidates)) {
            for (const c of call.callee_candidates) await addIfNew(c, this.knownCalleeCandidates);
          }
          if (!this.isCaller && Array.isArray(call.caller_candidates)) {
            for (const c of call.caller_candidates) await addIfNew(c, this.knownCallerCandidates);
          }
        }
      } catch (_) {}
    },

    async setupPeerConnection(role) {
      if (this.pc) this.pc.close();
      this.pc = new RTCPeerConnection(this.iceConfig);

      this.localStream.getTracks().forEach(track => {
        this.pc.addTrack(track, this.localStream);
      });

      this.pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (this.callMedia === 'video' && this.$refs.remoteVideo) {
          this.$refs.remoteVideo.srcObject = stream;
        } else if (this.$refs.remoteAudio) {
          this.$refs.remoteAudio.srcObject = stream;
        }
      };

      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          axios.post(`${this.API_URL}/api/call/candidate`, {
            call_id: this.currentCallId,
            role: role,
            candidate: event.candidate
          }).catch(() => {});
        }
      };

      if (role === 'caller') {
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        await axios.post(`${this.API_URL}/api/call/offer`, { call_id: this.currentCallId, sdp: offer });
      } else {
        const res = await axios.get(`${this.API_URL}/api/call/state`, { params: { call_id: this.currentCallId } });
        const call = res.data.call;
        await this.pc.setRemoteDescription(new RTCSessionDescription(call.offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await axios.post(`${this.API_URL}/api/call/answer`, { call_id: this.currentCallId, sdp: answer });
      }
    },

    async attachLocalMedia(media) {
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
      }
      try {
        const constraints = media === 'video' ? { audio: true, video: { facingMode: 'user' } } : { audio: true };
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (media === 'video' && this.$refs.localVideo) {
          this.$refs.localVideo.srcObject = this.localStream;
        }
      } catch (e) {
        throw new Error('Could not access camera/microphone. ' + e.message);
      }
    }
  }
};
</script>

<style scoped>
.call-overlay {
  position: fixed;
  z-index: 10000;
}
.call-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-around;
  background: #1a1a1a;
  color: white;
  padding: 20px;
}
.call-info {
  text-align: center;
}
.caller-name {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 8px;
}
.call-media-type {
  font-size: 16px;
  color: #ccc;
}
.video-call {
  position: relative;
  width: 100%;
  height: 60vh;
  background: black;
  border-radius: 12px;
  overflow: hidden;
}
.remote-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.local-video {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 100px;
  height: 150px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid white;
}
.call-controls {
  display: flex;
  gap: 20px;
  margin-bottom: 40px;
}
.action-btn {
  --padding-start: 20px;
  --padding-end: 20px;
  height: 60px;
  width: 60px;
}
.hangup-btn {
  --border-radius: 28px;
  height: 56px;
  padding: 0 30px;
}
</style>
