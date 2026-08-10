<template>
  <ion-modal
    :is-open="callStatus !== 'idle'"
    :backdrop-dismiss="false"
    css-class="call-modal-fullscreen"
    @didDismiss="callStatus = 'idle'"
  >
    <div class="call-screen" :class="[callStatus, { 'video-mode': callMedia === 'video' }]">

      <!-- ══════════════════════════════════════════════════
           VIDEO STREAMS (video calls only)
      ══════════════════════════════════════════════════ -->
      <template v-if="callMedia === 'video'">
        <video ref="remoteVideo" autoplay playsinline class="remote-video-bg"></video>
        <video ref="localVideo"  autoplay muted playsinline class="local-video-pip"></video>
      </template>

      <!-- ══════════════════════════════════════════════════
           ANIMATED BACKGROUND (audio calls)
      ══════════════════════════════════════════════════ -->
      <div v-else class="call-bg-waves">
        <div class="wave wave1"></div>
        <div class="wave wave2"></div>
        <div class="wave wave3"></div>
      </div>

      <!-- ══════════════════════════════════════════════════
           CALLER INFO HEADER
      ══════════════════════════════════════════════════ -->
      <div class="call-header">
        <div class="call-status-label">
          <template v-if="callStatus === 'ringing' && !isCaller">📞 Incoming {{ callMedia === 'video' ? 'Video' : 'Voice' }} Call</template>
          <template v-else-if="callStatus === 'calling'">🔔 Calling...</template>
          <template v-else-if="callStatus === 'in_call'">
            <span class="timer-dot">●</span>
            {{ formattedCallDuration }}
          </template>
        </div>

        <!-- Avatar with pulsing ring animation -->
        <div class="avatar-ring-wrap" :class="{ pulse: callStatus === 'ringing' || callStatus === 'calling' }">
          <div class="avatar-ring r1"></div>
          <div class="avatar-ring r2"></div>
          <div class="avatar-ring r3"></div>
          <div class="caller-avatar">
            <img v-if="otherUser?.profile_pic" :src="getAvatarUrl(otherUser.profile_pic)" alt="avatar" />
            <div v-else class="avatar-initials">{{ callerInitials }}</div>
          </div>
        </div>

        <div class="caller-name">{{ otherUser?.full_name || otherUser?.username || 'Unknown' }}</div>
        <div class="caller-handle" v-if="otherUser?.username">@{{ otherUser.username }}</div>
      </div>

      <!-- ══════════════════════════════════════════════════
           INCOMING CALL CONTROLS (ringing, callee side)
      ══════════════════════════════════════════════════ -->
      <div v-if="!isCaller && callStatus === 'ringing'" class="incoming-controls">
        <div class="inc-action decline" @click="hangupCall">
          <div class="inc-btn-circle decline-circle">
            <ion-icon :icon="callIcon" class="rotated-icon"></ion-icon>
          </div>
          <span>Decline</span>
        </div>
        <div class="inc-action accept" @click="acceptCall">
          <div class="inc-btn-circle accept-circle">
            <ion-icon :icon="callIcon"></ion-icon>
          </div>
          <span>Accept</span>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════
           OUTGOING CALL CONTROLS (calling, caller side)
      ══════════════════════════════════════════════════ -->
      <div v-else-if="isCaller && callStatus === 'calling'" class="outgoing-controls">
        <div class="calling-dots">
          <span></span><span></span><span></span>
        </div>
        <button class="end-call-btn" @click="hangupCall">
          <ion-icon :icon="callIcon" class="rotated-icon"></ion-icon>
          <span>Cancel</span>
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════
           ACTIVE CALL CONTROLS (in_call)
      ══════════════════════════════════════════════════ -->
      <div v-else-if="callStatus === 'in_call'" class="active-controls">
        <div class="controls-row">

          <!-- Mute -->
          <div class="ctrl-btn" :class="{ active: isMuted }" @click="toggleMute">
            <div class="ctrl-circle">
              <ion-icon :icon="isMuted ? micOffIcon : micIcon"></ion-icon>
            </div>
            <span>{{ isMuted ? 'Unmute' : 'Mute' }}</span>
          </div>

          <!-- Speaker -->
          <div class="ctrl-btn" :class="{ active: isSpeakerOn }" @click="toggleSpeaker">
            <div class="ctrl-circle">
              <ion-icon :icon="isSpeakerOn ? volumeHighIcon : volumeMuteIcon"></ion-icon>
            </div>
            <span>Speaker</span>
          </div>

          <!-- Flip Camera (video only) -->
          <div v-if="callMedia === 'video'" class="ctrl-btn" @click="flipCamera">
            <div class="ctrl-circle">
              <ion-icon :icon="cameraReverseIcon"></ion-icon>
            </div>
            <span>Flip</span>
          </div>

          <!-- Camera Toggle (video only) -->
          <div v-if="callMedia === 'video'" class="ctrl-btn" :class="{ active: isCameraOff }" @click="toggleCamera">
            <div class="ctrl-circle">
              <ion-icon :icon="isCameraOff ? videocamOffIcon : videocamIcon"></ion-icon>
            </div>
            <span>{{ isCameraOff ? 'Camera' : 'Hide' }}</span>
          </div>

        </div>

        <!-- End Call -->
        <button class="end-call-btn" @click="hangupCall">
          <ion-icon :icon="callIcon" class="rotated-icon"></ion-icon>
          <span>End Call</span>
        </button>
      </div>

    </div>
  </ion-modal>
</template>

<script>
import { IonModal, IonIcon } from '@ionic/vue';
import {
  callOutline,
  micOutline,
  micOffOutline,
  volumeHighOutline,
  volumeMuteOutline,
  cameraReverseOutline,
  videocamOutline,
  videocamOffOutline
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config/index.js';
import lanService from '@/utils/lanService';

export default {
  name: 'CallOverlay',
  components: { IonModal, IonIcon },

  data() {
    return {
      // ── Call state ───────────────────────────────────────────────────────
      callStatus: 'idle',   // idle | calling | ringing | in_call
      callMedia: 'voice',
      isCaller: false,
      currentCallId: null,
      otherUser: null,
      isLanCall: false,
      lastHungUpCallId: null,

      // ── WebRTC ───────────────────────────────────────────────────────────
      localStream: null,
      pc: null,
      iceConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      },
      knownCallerCandidates: [],
      knownCalleeCandidates: [],
      _pendingOffer: null,

      // ── Timers & polling ─────────────────────────────────────────────────
      callTimeout: null,
      ringtone: null,
      incomingPollInterval: null,
      callPollInterval: null,

      // ── Call timer ───────────────────────────────────────────────────────
      callStartTime: null,
      callDurationSeconds: 0,
      callTimerInterval: null,

      // ── Controls state ───────────────────────────────────────────────────
      isMuted: false,
      isSpeakerOn: false,
      isCameraOff: false,
      facingMode: 'user',   // 'user' | 'environment'

      // ── Socket handlers ──────────────────────────────────────────────────
      _socketCallIncomingHandler: null,
      _socketCallAnsweredHandler: null,
      _socketCallEndedHandler: null,

      // ── Config ───────────────────────────────────────────────────────────
      API_URL: '',
      userId: null,

      // ── Icons ────────────────────────────────────────────────────────────
      callIcon:         callOutline,
      micIcon:          micOutline,
      micOffIcon:       micOffOutline,
      volumeHighIcon:   volumeHighOutline,
      volumeMuteIcon:   volumeMuteOutline,
      cameraReverseIcon: cameraReverseOutline,
      videocamIcon:     videocamOutline,
      videocamOffIcon:  videocamOffOutline,
    };
  },

  computed: {
    callerInitials() {
      const name = this.otherUser?.full_name || this.otherUser?.username || '?';
      return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    },

    formattedCallDuration() {
      const s = this.callDurationSeconds;
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      const pad = n => String(n).padStart(2, '0');
      return h > 0
        ? `${pad(h)}:${pad(m)}:${pad(sec)}`
        : `${pad(m)}:${pad(sec)}`;
    }
  },

  mounted() {
    this.API_URL = config.api.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
    this.userId = localStorage.getItem('userId');

    // Ringtone
    this.ringtone = new Audio('/call-ton.mp3');
    this.ringtone.loop = true;

    // Listen for start-call events from DMPage
    window.addEventListener('start-call', (e) => {
      const { media, user } = e.detail;
      this.startCall(media, user);
    });

    // Listen for native decline action (from CallNotificationReceiver via MainActivity)
    window.addEventListener('nexfi:declineCall', (e) => {
      if (this.currentCallId === e.detail?.call_id || this.callStatus === 'ringing') {
        this.hangupCall();
      }
    });

    this.setupSocketListeners();
    this.startGlobalPolling();
    this.checkIncomingCallQuery();

    window.addEventListener('stop-ringtone', this.stopRingtone);

    lanService.onCallSignal((peerId, data) => {
      this.handleLanSignal(peerId, data);
    });
  },

  watch: {
    '$route.query': {
      handler(newQuery) {
        if (newQuery && newQuery.incomingCall === '1') {
          this.checkIncomingCallQuery();
        }
      },
      deep: true
    },
    callStatus(newStatus, oldStatus) {
      if (newStatus === 'in_call' && oldStatus !== 'in_call') {
        this.startCallTimer();
      } else if (newStatus === 'idle' && oldStatus !== 'idle') {
        this.stopCallTimer();
      }
    }
  },

  beforeUnmount() {
    this.stopGlobalPolling();
    this.cleanupSocketListeners();
    this.hangupCall();
    this.stopCallTimer();
    if (this.ringtone) {
      this.ringtone.pause();
      this.ringtone = null;
    }
  },

  methods: {
    // ──────────────────────────────────────────────────────────────────
    // CALL TIMER
    // ──────────────────────────────────────────────────────────────────
    startCallTimer() {
      this.callDurationSeconds = 0;
      this.callStartTime = Date.now();
      this.stopCallTimer();
      this.callTimerInterval = setInterval(() => {
        this.callDurationSeconds = Math.floor((Date.now() - this.callStartTime) / 1000);
      }, 1000);
    },

    stopCallTimer() {
      if (this.callTimerInterval) {
        clearInterval(this.callTimerInterval);
        this.callTimerInterval = null;
      }
      this.callDurationSeconds = 0;
    },

    // ──────────────────────────────────────────────────────────────────
    // SOCKET LISTENERS
    // ──────────────────────────────────────────────────────────────────
    setupSocketListeners() {
      const socket = this.$socket;
      if (!socket || typeof socket.on !== 'function') return;

      this._socketCallIncomingHandler = (payload) => {
        if (this.callStatus !== 'idle') return;
        this.incomingCall({
          call_id: payload.call_id,
          caller_id: payload.caller_id,
          media: payload.media || 'voice'
        });
        this.otherUser = {
          user_id: payload.caller_id,
          username: payload.caller_username || 'Incoming Call',
          full_name: payload.caller_username || null
        };
      };

      this._socketCallAnsweredHandler = (payload) => {
        if (this.isCaller && this.currentCallId === payload.call_id) {
          this.handleCallAnswered(payload.answer);
        }
      };

      this._socketCallEndedHandler = (payload) => {
        if (this.currentCallId === payload.call_id) {
          this.hangupCall();
        }
      };

      socket.on('call:incoming', this._socketCallIncomingHandler);
      socket.on('call:answered', this._socketCallAnsweredHandler);
      socket.on('call:ended', this._socketCallEndedHandler);
    },

    cleanupSocketListeners() {
      const socket = this.$socket;
      if (socket) {
        if (this._socketCallIncomingHandler) socket.off('call:incoming', this._socketCallIncomingHandler);
        if (this._socketCallAnsweredHandler) socket.off('call:answered', this._socketCallAnsweredHandler);
        if (this._socketCallEndedHandler)    socket.off('call:ended',    this._socketCallEndedHandler);
      }
    },

    // ──────────────────────────────────────────────────────────────────
    // LAN CALL SIGNALS
    // ──────────────────────────────────────────────────────────────────
    handleLanSignal(peerId, data) {
      if (data.signalType === 'offer') {
        if (this.callStatus !== 'idle') return;
        this.isLanCall = true;
        this.otherUser = { user_id: peerId, username: data.from_username || 'LAN Peer' };
        this.incomingCall({
          call_id: data.call_id || `lan-${Date.now()}`,
          caller_id: peerId,
          media: data.media || 'voice',
          offer: data.sdp
        });
      } else if (data.signalType === 'answer') {
        if (this.currentCallId === data.call_id) this.handleCallAnswered(data.sdp);
      } else if (data.signalType === 'candidate') {
        if (this.currentCallId === data.call_id && this.pc) {
          this.pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        }
      } else if (data.signalType === 'hangup') {
        if (this.currentCallId === data.call_id) this.hangupCall(true);
      }
    },

    async handleCallAnswered(answer) {
      if (!this.pc || !answer) return;
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
        this.callStatus = 'in_call';
        if (this.callTimeout) { clearTimeout(this.callTimeout); this.callTimeout = null; }
      } catch (e) {
        console.error('Error handling answer:', e);
      }
    },

    // ──────────────────────────────────────────────────────────────────
    // RINGTONE
    // ──────────────────────────────────────────────────────────────────
    playRingtone() {
      if (this.ringtone) this.ringtone.play().catch(() => {});
    },
    stopRingtone() {
      if (this.ringtone) {
        this.ringtone.pause();
        this.ringtone.currentTime = 0;
      }
    },

    // ──────────────────────────────────────────────────────────────────
    // POLLING (fallback when Socket.IO is unavailable)
    // ──────────────────────────────────────────────────────────────────
    startGlobalPolling() {
      this.stopGlobalPolling();
      if (!this.userId) return;
      this.incomingPollInterval = setInterval(() => {
        if (this.callStatus === 'idle') this.pollIncomingCalls();
      }, 4000);
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
        if (calls.length > 0) this.incomingCall(calls[0]);
      } catch (_) {}
    },

    // ──────────────────────────────────────────────────────────────────
    // INCOMING CALL ENTRY POINT
    // ──────────────────────────────────────────────────────────────────
    checkIncomingCallQuery() {
      const q = this.$route && this.$route.query ? this.$route.query : {};
      if (q.incomingCall === '1' && q.callId) {
        this.otherUser = {
          user_id: q.callerId || null,
          username: q.caller || 'Incoming Call',
          full_name: q.caller || null
        };
        const autoAccept = q.autoAccept === '1';
        this.incomingCall({
          call_id: q.callId,
          caller_id: q.callerId,
          media: q.media || 'voice'
        });
        if (autoAccept) {
          // Small delay to let the overlay render first
          setTimeout(() => this.acceptCall(), 800);
        }
      }
    },

    incomingCall(match) {
      if (this.callStatus !== 'idle') return;
      if (match.call_id === this.lastHungUpCallId) return;

      this.currentCallId = match.call_id;
      this.callMedia = match.media || 'voice';
      this.isCaller = false;
      this.callStatus = 'ringing';
      this.otherUser = this.otherUser || { user_id: match.caller_id, username: 'Incoming Call' };

      if (match.offer) this._pendingOffer = match.offer;

      this.playRingtone();
    },

    // ──────────────────────────────────────────────────────────────────
    // START CALL (caller side)
    // ──────────────────────────────────────────────────────────────────
    async startCall(media, otherUser) {
      if (this.callStatus !== 'idle') return;
      try {
        this.otherUser = otherUser;
        this.callMedia = media;
        this.isCaller = true;
        this.callStatus = 'calling';

        const hasPerms = await this.requestCapacitorPermissions(media);
        if (!hasPerms) { this.hangupCall(); return; }

        await this.attachLocalMedia(media);

        if (lanService.isPeerReachable(otherUser.user_id)) {
          this.isLanCall = true;
          this.currentCallId = `lan-${Date.now()}-${this.userId}`;
          await this.setupPeerConnection('caller');
        } else {
          this.isLanCall = false;
          const res = await axios.post(`${this.API_URL}/api/call/start`, {
            caller_id: this.userId,
            callee_id: otherUser.user_id,
            media
          });
          if (res.data && res.data.call_id) {
            this.currentCallId = res.data.call_id;
            await this.setupPeerConnection('caller');
            this.callPollInterval = setInterval(() => this.pollCallState(), 2000);
          } else {
            throw new Error('Could not start call');
          }
        }

        this.callTimeout = setTimeout(() => {
          if (this.callStatus === 'calling') {
            this.hangupCall();
          }
        }, 50000);

      } catch (e) {
        alert('Call failed: ' + e.message);
        this.hangupCall();
      }
    },

    // ──────────────────────────────────────────────────────────────────
    // ACCEPT CALL (callee side)
    // ──────────────────────────────────────────────────────────────────
    async acceptCall() {
      if (this.callStatus !== 'ringing') return;
      try {
        this.stopRingtone();

        const hasPerms = await this.requestCapacitorPermissions(this.callMedia);
        if (!hasPerms) { this.hangupCall(); return; }

        await this.attachLocalMedia(this.callMedia);
        await this.setupPeerConnection('callee');

        if (this._pendingOffer && this.pc) {
          await this.pc.setRemoteDescription(new RTCSessionDescription(this._pendingOffer));
          this._pendingOffer = null;
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          lanService.sendCallSignal(this.otherUser.user_id, {
            signalType: 'answer',
            call_id: this.currentCallId,
            sdp: answer
          });
        }

        this.callStatus = 'in_call';

        if (!this.isLanCall) {
          this.callPollInterval = setInterval(() => this.pollCallState(), 2000);
        }
      } catch (e) {
        alert('Could not accept call: ' + e.message);
        this.hangupCall();
      }
    },

    // ──────────────────────────────────────────────────────────────────
    // HANG UP
    // ──────────────────────────────────────────────────────────────────
    async hangupCall() {
      this.stopRingtone();
      this.stopCallTimer();

      const callIdToHangup = this.currentCallId;
      if (callIdToHangup) {
        this.lastHungUpCallId = callIdToHangup;
        setTimeout(() => {
          if (this.lastHungUpCallId === callIdToHangup) this.lastHungUpCallId = null;
        }, 10000);
      }

      this.callStatus = 'idle';
      this.currentCallId = null;
      this.isCaller = false;
      this.otherUser = null;
      this.isMuted = false;
      this.isSpeakerOn = false;
      this.isCameraOff = false;

      if (callIdToHangup) {
        if (this.isLanCall) {
          lanService.sendCallSignal(this.otherUser?.user_id, {
            type: 'call:signal', signalType: 'hangup', call_id: callIdToHangup
          });
        } else {
          axios.post(`${this.API_URL}/api/call/hangup`, { call_id: callIdToHangup }).catch(() => {});
        }
      }

      if (this.localStream) {
        try { this.localStream.getTracks().forEach(t => t.stop()); } catch (_) {}
        this.localStream = null;
      }
      if (this.pc) {
        try { this.pc.close(); } catch (_) {}
        this.pc = null;
      }
      if (this.callPollInterval) { clearInterval(this.callPollInterval); this.callPollInterval = null; }
      if (this.callTimeout)      { clearTimeout(this.callTimeout);      this.callTimeout = null; }

      this.knownCallerCandidates = [];
      this.knownCalleeCandidates = [];
      this.isLanCall = false;
    },

    // ──────────────────────────────────────────────────────────────────
    // ACTIVE CALL CONTROLS
    // ──────────────────────────────────────────────────────────────────
    toggleMute() {
      if (!this.localStream) return;
      this.isMuted = !this.isMuted;
      this.localStream.getAudioTracks().forEach(t => { t.enabled = !this.isMuted; });
    },

    toggleSpeaker() {
      this.isSpeakerOn = !this.isSpeakerOn;
      // On native Android, use the AudioManager via Capacitor if available
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        // Signal to the native layer to switch audio output
        window.dispatchEvent(new CustomEvent('nexfi:setSpeaker', { detail: { enabled: this.isSpeakerOn } }));
      }
    },

    toggleCamera() {
      if (!this.localStream) return;
      this.isCameraOff = !this.isCameraOff;
      this.localStream.getVideoTracks().forEach(t => { t.enabled = !this.isCameraOff; });
    },

    async flipCamera() {
      if (!this.localStream) return;
      this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
      try {
        this.localStream.getVideoTracks().forEach(t => t.stop());
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this.facingMode },
          audio: false
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (this.pc) {
          const sender = this.pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(newVideoTrack);
        }
        // Update local preview
        const oldTrack = this.localStream.getVideoTracks()[0];
        if (oldTrack) this.localStream.removeTrack(oldTrack);
        this.localStream.addTrack(newVideoTrack);
        if (this.$refs.localVideo) this.$refs.localVideo.srcObject = this.localStream;
      } catch (e) {
        console.error('Camera flip error:', e);
      }
    },

    // ──────────────────────────────────────────────────────────────────
    // WEBRTC INFRASTRUCTURE
    // ──────────────────────────────────────────────────────────────────
    async pollCallState() {
      if (!this.currentCallId || this.isLanCall) return;
      try {
        const res = await axios.get(`${this.API_URL}/api/call/state`, { params: { call_id: this.currentCallId } });
        const call = res.data && res.data.call;
        if (!call) return;
        if (call.status === 'ended') { this.hangupCall(); return; }
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
          if (this.isCaller && Array.isArray(call.callee_candidates))
            for (const c of call.callee_candidates) await addIfNew(c, this.knownCalleeCandidates);
          if (!this.isCaller && Array.isArray(call.caller_candidates))
            for (const c of call.caller_candidates) await addIfNew(c, this.knownCallerCandidates);
        }
      } catch (_) {}
    },

    async setupPeerConnection(role) {
      if (this.pc) this.pc.close();
      this.pc = new RTCPeerConnection(this.iceConfig);

      this.localStream.getTracks().forEach(track => this.pc.addTrack(track, this.localStream));

      this.pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (this.callMedia === 'video' && this.$refs.remoteVideo) {
          this.$refs.remoteVideo.srcObject = stream;
        } else if (this.$refs.remoteAudio) {
          this.$refs.remoteAudio.srcObject = stream;
        }
      };

      this.pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        if (this.isLanCall) {
          lanService.sendCallSignal(this.otherUser.user_id, {
            signalType: 'candidate', call_id: this.currentCallId, candidate: event.candidate
          });
        } else {
          axios.post(`${this.API_URL}/api/call/candidate`, {
            call_id: this.currentCallId, role, candidate: event.candidate
          }).catch(() => {});
        }
      };

      if (role === 'caller') {
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        if (this.isLanCall) {
          lanService.sendCallSignal(this.otherUser.user_id, {
            signalType: 'offer', call_id: this.currentCallId,
            sdp: offer, media: this.callMedia,
            from_username: localStorage.getItem('username')
          });
        } else {
          await axios.post(`${this.API_URL}/api/call/offer`, { call_id: this.currentCallId, sdp: offer });
        }
      } else {
        if (!this.isLanCall) {
          const res = await axios.get(`${this.API_URL}/api/call/state`, { params: { call_id: this.currentCallId } });
          const offer = res.data.call.offer;
          await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
        }
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        if (this.isLanCall) {
          lanService.sendCallSignal(this.otherUser.user_id, {
            signalType: 'answer', call_id: this.currentCallId, sdp: answer
          });
        } else {
          await axios.post(`${this.API_URL}/api/call/answer`, { call_id: this.currentCallId, sdp: answer });
        }
      }
    },

    async attachLocalMedia(media) {
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
      }
      try {
        const constraints = media === 'video'
          ? { audio: true, video: { facingMode: this.facingMode } }
          : { audio: true };
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (media === 'video' && this.$refs.localVideo) {
          this.$refs.localVideo.srcObject = this.localStream;
        }
      } catch (e) {
        throw new Error('Could not access camera/microphone. ' + e.message);
      }
    },

    async requestCapacitorPermissions(media) {
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
          if (navigator.permissions && navigator.permissions.query) {
            const cam = await navigator.permissions.query({ name: 'camera' });
            const mic = await navigator.permissions.query({ name: 'microphone' });
            if (cam.state === 'denied' || mic.state === 'denied') {
              alert('Camera or Microphone permission denied. Please enable in Android Settings.');
              return false;
            }
          }
        } catch (_) {}
      }
      return true;
    },

    getAvatarUrl(pic) {
      if (!pic) return '';
      if (pic.startsWith('http')) return pic;
      return `${this.API_URL}${pic}`;
    }
  }
};
</script>

<style>
/* Make the Ionic modal truly full-screen */
.call-modal-fullscreen .modal-wrapper {
  --height: 100%;
  --width: 100%;
  --border-radius: 0;
}
</style>

<style scoped>
/* ══════════════════════════════════════════════════════════════
   CALL SCREEN — Base
══════════════════════════════════════════════════════════════ */
.call-screen {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #0a0a0f;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  font-family: 'Inter', -apple-system, sans-serif;
  color: #fff;
}

/* ══════════════════════════════════════════════════════════════
   ANIMATED WAVE BACKGROUND (audio calls)
══════════════════════════════════════════════════════════════ */
.call-bg-waves {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center bottom, #1a0a2e 0%, #0a0a0f 70%);
  z-index: 0;
}
.wave {
  position: absolute;
  border-radius: 50%;
  opacity: 0.07;
  animation: waveExpand 4s ease-in-out infinite;
}
.wave1 { width: 300px; height: 300px; background: #d4af37; bottom: 30%; left: 50%; transform: translateX(-50%); animation-delay: 0s; }
.wave2 { width: 500px; height: 500px; background: #7c3aed; bottom: 20%; left: 50%; transform: translateX(-50%); animation-delay: 1.2s; }
.wave3 { width: 700px; height: 700px; background: #3b82f6; bottom: 10%; left: 50%; transform: translateX(-50%); animation-delay: 2.4s; }

@keyframes waveExpand {
  0%   { transform: translateX(-50%) scale(0.8); opacity: 0.07; }
  50%  { opacity: 0.12; }
  100% { transform: translateX(-50%) scale(1.2); opacity: 0.02; }
}

/* ══════════════════════════════════════════════════════════════
   VIDEO STREAMS
══════════════════════════════════════════════════════════════ */
.remote-video-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
  background: #000;
}
.local-video-pip {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 110px;
  height: 160px;
  object-fit: cover;
  border-radius: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  z-index: 10;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

/* ══════════════════════════════════════════════════════════════
   HEADER / CALLER INFO
══════════════════════════════════════════════════════════════ */
.call-header {
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 60px;
  gap: 8px;
}

.call-status-label {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255,255,255,0.7);
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;
}

.timer-dot {
  color: #22c55e;
  animation: blink 1.2s infinite;
  font-size: 10px;
}
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }

/* ── Avatar with pulsing rings ── */
.avatar-ring-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 20px 0 12px;
}

.avatar-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid rgba(212,175,55,0.3);
  animation: none;
}
.r1 { width: 120px; height: 120px; }
.r2 { width: 160px; height: 160px; }
.r3 { width: 200px; height: 200px; }

.avatar-ring-wrap.pulse .avatar-ring {
  animation: ringPulse 2s ease-out infinite;
}
.avatar-ring-wrap.pulse .r2 { animation-delay: 0.5s; }
.avatar-ring-wrap.pulse .r3 { animation-delay: 1s; }

@keyframes ringPulse {
  0%   { transform: scale(1);    opacity: 0.4; }
  70%  { transform: scale(1.15); opacity: 0; }
  100% { transform: scale(1.15); opacity: 0; }
}

.caller-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #2d1a5e, #1a3a6e);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid rgba(212,175,55,0.6);
  z-index: 2;
  box-shadow: 0 0 30px rgba(212,175,55,0.25);
}
.caller-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-initials {
  font-size: 36px;
  font-weight: 700;
  color: #d4af37;
}

.caller-name {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 12px rgba(0,0,0,0.5);
}
.caller-handle {
  font-size: 14px;
  color: rgba(255,255,255,0.55);
}

/* ══════════════════════════════════════════════════════════════
   INCOMING CALL CONTROLS
══════════════════════════════════════════════════════════════ */
.incoming-controls {
  position: absolute;
  bottom: 60px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 40px;
  z-index: 10;
}

.inc-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.inc-action span {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.8);
  letter-spacing: 0.03em;
}

.inc-btn-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 6px 24px rgba(0,0,0,0.4);
}
.inc-btn-circle:active { transform: scale(0.92); }

.accept-circle {
  background: #16a34a;
  box-shadow: 0 6px 30px rgba(22,163,74,0.5);
  animation: callPulse 2s infinite;
}
@keyframes callPulse {
  0%, 100% { box-shadow: 0 6px 30px rgba(22,163,74,0.5); }
  50%       { box-shadow: 0 6px 50px rgba(22,163,74,0.8); }
}

.decline-circle {
  background: #dc2626;
  box-shadow: 0 6px 30px rgba(220,38,38,0.5);
}

.rotated-icon {
  transform: rotate(135deg);
}

/* ══════════════════════════════════════════════════════════════
   OUTGOING CALL CONTROLS
══════════════════════════════════════════════════════════════ */
.outgoing-controls {
  position: absolute;
  bottom: 60px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  z-index: 10;
}

.calling-dots {
  display: flex;
  gap: 8px;
}
.calling-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(212,175,55,0.7);
  animation: dotBounce 1.4s ease-in-out infinite;
}
.calling-dots span:nth-child(2) { animation-delay: 0.2s; }
.calling-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dotBounce {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40%            { transform: scale(1.2); opacity: 1; }
}

/* ══════════════════════════════════════════════════════════════
   ACTIVE CALL CONTROLS
══════════════════════════════════════════════════════════════ */
.active-controls {
  position: absolute;
  bottom: 40px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  z-index: 10;
}

.controls-row {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
  padding: 0 20px;
}

.ctrl-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  min-width: 64px;
}
.ctrl-btn span {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.65);
  letter-spacing: 0.02em;
}

.ctrl-circle {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: #fff;
  transition: all 0.2s;
  border: 1.5px solid rgba(255,255,255,0.15);
}
.ctrl-btn.active .ctrl-circle {
  background: #d4af37;
  color: #0a0a0f;
  border-color: #d4af37;
}
.ctrl-circle:active { transform: scale(0.9); }

/* End Call / Cancel button */
.end-call-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: #dc2626;
  border: none;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  color: #fff;
  font-size: 28px;
  cursor: pointer;
  box-shadow: 0 6px 30px rgba(220,38,38,0.5);
  transition: transform 0.15s, box-shadow 0.15s;
}
.end-call-btn span {
  font-size: 11px;
  font-weight: 600;
  position: absolute;
  bottom: -22px;
  white-space: nowrap;
}
.end-call-btn:active { transform: scale(0.92); }
.outgoing-controls .end-call-btn,
.active-controls .end-call-btn {
  position: relative;
  margin-bottom: 24px;
}
</style>
