<template>
  <div v-if="isOwnProfile" class="lan-panel">
    <!-- ── Header ─────────────────────────────── -->
    <div class="lan-header" @click="panelOpen = !panelOpen">
      <div class="lan-title-row">
        <span class="lan-icon">⚡</span>
        <span class="lan-title">LAN Mode</span>
        <span v-if="connectedCount > 0" class="lan-live-badge">{{ connectedCount }} LIVE</span>
      </div>
      <div class="lan-toggle-track" :class="{ active: lanEnabled }" @click.stop="toggleLan">
        <div class="lan-toggle-thumb"></div>
      </div>
    </div>

    <!-- ── Body (collapsible) ──────────────────── -->
    <transition name="lan-expand">
      <div v-if="lanEnabled && panelOpen" class="lan-body">

        <!-- Status row -->
        <div class="lan-status-row">
          <div class="lan-ip-chip">
            <span class="chip-label">Your LAN IP</span>
            <span class="chip-value">{{ localIP || 'Detecting…' }}</span>
          </div>
          <div class="lan-status-dot" :class="statusDotClass"></div>
        </div>

        <!-- Offline scan status -->
        <div v-if="!$online && lanEnabled" class="scan-status-row">
          <span v-if="lanScanStatus === 'scanning'" class="scan-chip scanning">
            🔍 Finding NexFi devices…
          </span>
          <span v-else-if="lanScanStatus === 'found'" class="scan-chip found">
            ⚡ Local hub: {{ localBackendUrl?.replace('http://', '').replace(':5000', '') }}
          </span>
          <span v-else-if="lanScanStatus === 'not-found'" class="scan-chip offline">
            📡 No hub found — use invite code
          </span>
        </div>

        <!-- Connected peers list -->
        <div v-if="lanPeers.length > 0" class="lan-peers">
          <div v-for="peer in lanPeers" :key="peer.userId" class="lan-peer-row">
            <span class="peer-avatar">{{ peer.username?.[0]?.toUpperCase() || '?' }}</span>
            <span class="peer-name">@{{ peer.username || peer.userId }}</span>
            <span class="peer-status" :class="peer.connected ? 'peer-live' : 'peer-stored'">
              {{ peer.connected ? '⚡ LAN' : '📥 Saved' }}
            </span>
          </div>
        </div>

        <!-- Nearby Users (auto-discovered on same LAN) -->
        <div v-if="nearbyPeers.length > 0 || lanPeers.length > 0" class="nearby-section">
          <div class="nearby-label">📡 Nearby on this Network</div>

          <!-- Live discovered peers -->
          <div v-for="peer in nearbyPeers" :key="'near-' + peer.userId" class="nearby-peer-row">
            <span class="peer-avatar near">{{ peer.username?.[0]?.toUpperCase() || '?' }}</span>
            <div class="peer-meta">
              <span class="peer-name">@{{ peer.username }}</span>
              <span class="peer-sub">{{ peer.localIP }}</span>
            </div>
            <button class="connect-btn"
              :class="{ connected: isConnected(peer.userId), connecting: isConnecting(peer.userId) }"
              @click="connectToPeer(peer)">
              {{ isConnected(peer.userId) ? '⚡ Connected' : isConnecting(peer.userId) ? '…' : 'Connect' }}
            </button>
          </div>

          <!-- Previously known peers -->
          <div v-for="peer in lanPeers.filter(p => !nearbyPeers.find(n => n.userId === p.userId))" :key="'saved-' + peer.userId" class="nearby-peer-row saved">
            <span class="peer-avatar">{{ peer.username?.[0]?.toUpperCase() || '?' }}</span>
            <div class="peer-meta">
              <span class="peer-name">@{{ peer.username || peer.userId }}</span>
              <span class="peer-sub">{{ peer.connected ? 'Connected' : 'Last seen on LAN' }}</span>
            </div>
            <span class="peer-status" :class="peer.connected ? 'peer-live' : 'peer-stored'">
              {{ peer.connected ? '⚡' : '📥' }}
            </span>
          </div>
        </div>

        <!-- No peers yet -->
        <div v-else-if="lanEnabled && localIP" class="no-peers-hint">
          <p>👀 Scanning for NexFi users on this network…</p>
          <p class="sub-hint">Others must have NexFi open to appear here.</p>
        </div>

        <!-- Known Contacts (offline / cross-subnet) -->
        <div v-if="knownContacts.length > 0 && nearbyPeers.length === 0" class="known-section">
          <div class="nearby-label">📱 Known Contacts — Tap to Connect</div>
          <p class="known-hint">
            {{ localIP ? 'No one online yet. If they\'re nearby, tap their name to generate a quick invite.' : 'Enable LAN mode to connect.' }}
          </p>
          <div
            v-for="contact in knownContacts.slice(0, 8)"
            :key="'known-' + contact.userId"
            class="nearby-peer-row"
            @click="connectToPeerOrInvite(contact)"
          >
            <span class="peer-avatar" :class="{ near: isConnected(contact.userId) }">
              {{ contact.username?.[0]?.toUpperCase() || '?' }}
            </span>
            <div class="peer-meta">
              <span class="peer-name">@{{ contact.username }}</span>
              <span class="peer-sub">{{ isConnected(contact.userId) ? '⚡ Connected' : contact.lastLanIP ? 'Last seen: ' + contact.lastLanIP : 'Tap to invite' }}</span>
            </div>
            <button class="connect-btn" :class="{ connected: isConnected(contact.userId), connecting: isConnecting(contact.userId) }">
              {{ isConnected(contact.userId) ? '⚡' : isConnecting(contact.userId) ? '…' : '📲' }}
            </button>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="lan-actions" v-if="step === 'idle'">
          <button class="lan-btn primary" @click="startCreateInvite">
            <span>📲</span> Create LAN Invite
          </button>
          <button class="lan-btn secondary" @click="startScan('offer')">
            <span>📷</span> Scan Partner's QR
          </button>
        </div>

        <!-- ── Step: Generating offer ────────── -->
        <div v-if="step === 'generating'" class="lan-step">
          <div class="lan-spinner"></div>
          <p>Generating secure connection…</p>
        </div>

        <!-- ── Step: Showing offer QR ────────── -->
        <div v-if="step === 'showing_offer'" class="lan-step">
          <p class="step-label">📲 Share this code with your partner</p>

          <div class="code-display">
            <div class="code-label">Connection Code</div>
            <div class="code-value" @click="copyCode(offerPayloadStr)" title="Tap to copy">
              {{ offerPayloadStr ? offerPayloadStr.slice(0, 40) + '…' : '' }}
            </div>
            <button class="copy-btn" @click="copyCode(offerPayloadStr)">
              {{ codeCopied ? '✅ Copied!' : '📋 Copy Full Code' }}
            </button>
          </div>

          <div class="step-actions">
            <button class="lan-btn primary" @click="startScan('answer')">
              📷 Scan / Paste Their Answer
            </button>
            <button class="lan-btn ghost" @click="resetStep">Cancel</button>
          </div>
        </div>

        <!-- ── Step: Showing answer QR ───────── -->
        <div v-if="step === 'showing_answer'" class="lan-step">
          <p class="step-label">📲 Share your answer code back</p>

          <div class="code-display">
            <div class="code-label">Answer Code</div>
            <div class="code-value" @click="copyCode(answerPayloadStr)" title="Tap to copy">
              {{ answerPayloadStr ? answerPayloadStr.slice(0, 40) + '…' : '' }}
            </div>
            <button class="copy-btn" @click="copyCode(answerPayloadStr)">
              {{ codeCopied ? '✅ Copied!' : '📋 Copy Full Code' }}
            </button>
          </div>

          <p class="hint">Send via WhatsApp, SMS, or any messaging app → they paste it in NexFi</p>
          <button class="lan-btn ghost mt" @click="resetStep">Cancel</button>
        </div>

        <!-- ── Step: Scanning ────────────────── -->
        <div v-if="step === 'scanning'" class="lan-step">
          <p class="step-label">📷 {{ scanMode === 'offer' ? 'Scan Partner\'s Invite QR' : 'Scan Their Answer QR' }}</p>

          <!-- Video scanner (Android/Desktop) -->
          <div v-if="!useFileInput" class="scanner-wrapper">
            <video ref="scanVideo" autoplay playsinline muted class="scan-video"></video>
            <div class="scan-overlay">
              <div class="scan-corners"></div>
            </div>
          </div>

          <!-- File input (iOS Safari) -->
          <div v-if="useFileInput" class="file-scan-wrapper">
            <label class="file-scan-btn">
              📸 Take Photo of QR
              <input type="file" accept="image/*" capture="environment"
                     @change="onFileScanned" style="display:none" />
            </label>
          </div>

          <!-- Manual paste fallback -->
          <div class="manual-entry">
            <textarea v-model="manualCode" placeholder="Or paste the code here…"
                      class="manual-code" rows="3"></textarea>
            <button class="lan-btn secondary" @click="applyManualCode" :disabled="!manualCode">
              Apply Code
            </button>
          </div>

          <button class="lan-btn ghost mt" @click="cancelScan">Cancel</button>
        </div>

        <!-- ── Step: Connected ───────────────── -->
        <div v-if="step === 'connected'" class="lan-step success-step">
          <div class="success-ring">🎉</div>
          <p class="success-title">LAN Connected!</p>
          <p class="success-sub">Messages now travel directly between devices at LAN speed.</p>
          <button class="lan-btn primary mt" @click="resetStep">Done</button>
        </div>

        <!-- ── Step: Error ───────────────────── -->
        <div v-if="step === 'error'" class="lan-step error-step">
          <p class="error-icon">⚠️</p>
          <p class="error-msg">{{ errorMsg }}</p>
          <button class="lan-btn secondary mt" @click="resetStep">Try Again</button>
        </div>

      </div>
    </transition>
  </div>
</template>

<script>
import {
  getLocalIP,
  createLanOffer,
  acceptLanOffer,
  completeLanHandshake,
  encodeLanPayload,
  decodeLanPayload,
  generateQRDataUrl,
  decodeQRFromImageFile,
  decodeQRFromVideoFrame,
  getAllStoredPeers,
  announceLanPresence,
  fetchLanPeers,
  extractPeerIPFromSDP,
  getKnownContactsOffline,
  scanForLocalNexfiBackend,
  scanForLocalHubs
} from '@/utils/lanSignaling.js';
import { updatePeerLanInfo } from '@/utils/offlineDb.js';
import lanService from '@/utils/lanService.js';

export default {
  name: 'LanModePanel',

  props: {
    isOwnProfile: { type: Boolean, default: false },
    currentUserId: { type: [String, Number], default: null },
    currentUsername: { type: String, default: '' }
  },

  data() {
    return {
      lanEnabled: false,
      panelOpen: true,
      localIP: null,
      step: 'idle',      // idle | generating | showing_offer | scanning | showing_answer | connected | error
      scanMode: 'offer', // 'offer' | 'answer'
      offerQrUrl: null,
      answerQrUrl: null,
      offerPayloadStr: '',
      answerPayloadStr: '',
      manualCode: '',
      errorMsg: '',
      codeCopied: false,
      useFileInput: false, // true on iOS Safari
      lanPeers: [],
      connectedCount: 0,
      lanConnectedPeers: {},
      nearbyPeers: [],       // Discovered from backend (same subnet)
      knownContacts: [],     // From conversation history (offline use)
      connectingPeers: {},   // { userId: boolean }
      localBackendUrl: null,   // Found LAN backend URL (e.g. http://192.168.1.5:5000)
      lanScanStatus: 'idle',   // idle | scanning | found | not-found
      _announceInterval: null,
      _discoveryInterval: null,

      // In-progress handshake state
      _pc: null,
      _dc: null,
      _offerPayload: null,

      // Scanner loop
      _scanInterval: null,
      _scanStream: null,
    };
  },

  computed: {
    statusDotClass() {
      if (this.connectedCount > 0) return 'dot-live';
      if (this.lanEnabled) return 'dot-ready';
      return 'dot-off';
    },
    $online() {
      return navigator.onLine;
    }
  },

  mounted() {
    this.lanEnabled = localStorage.getItem('nexfi_lan_mode') === 'true';
    this.useFileInput = this.detectIOS();
    if (this.lanEnabled) {
      this.init();
    }
  },

  beforeUnmount() {
    this.stopScanStream();
    this.stopDiscoveryLoops();
  },

  methods: {
    detectIOS() {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    },

    async toggleLan() {
      this.lanEnabled = !this.lanEnabled;
      localStorage.setItem('nexfi_lan_mode', this.lanEnabled);
      if (this.lanEnabled) {
        this.panelOpen = true;
        await this.init();
      } else {
        this.resetStep();
        this.localIP = null;
        this.lanPeers = [];
      }
    },

    async init() {
      this.localIP = await getLocalIP();
      await this.loadStoredPeers();
      await this.loadKnownContacts();
      this.updateConnectedCount();
      this.startDiscoveryLoops();
    },

    startDiscoveryLoops() {
      this.stopDiscoveryLoops();

      // Announce + discover while online
      this.announcePresence();
      this._announceInterval = setInterval(() => this.announcePresence(), 30000);
      this.fetchPeers();
      this._discoveryInterval = setInterval(() => this.fetchPeers(), 10000);

      // When offline: silently scan for a local NexFi backend
      if (!navigator.onLine) {
        this.findLocalBackend();
      }
      window.addEventListener('offline', this._onOffline = () => this.findLocalBackend());
      window.addEventListener('online',  this._onOnline  = () => {
        this.localBackendUrl = null;
        this.lanScanStatus = 'idle';
      });
    },

    stopDiscoveryLoops() {
      if (this._announceInterval) { clearInterval(this._announceInterval); this._announceInterval = null; }
      if (this._discoveryInterval) { clearInterval(this._discoveryInterval); this._discoveryInterval = null; }
      if (this._onOffline) { window.removeEventListener('offline', this._onOffline); this._onOffline = null; }
      if (this._onOnline)  { window.removeEventListener('online',  this._onOnline);  this._onOnline  = null; }
    },

    async findLocalBackend() {
      if (this.lanScanStatus === 'scanning' || !this.localIP) return;
      this.lanScanStatus = 'scanning';
      console.log('[LAN] Scanning for local NexFi backend...');

      const backendUrl = await scanForLocalNexfiBackend(this.localIP);

      if (backendUrl) {
        this.localBackendUrl = backendUrl;
        this.lanScanStatus = 'found';
        console.log('[LAN] Found local backend at', backendUrl);

        // Reconnect Socket.IO to the local backend so signaling works
        const socket = window.socketService?.socket;
        if (socket && !socket.connected) {
          socket.io.uri = backendUrl;
          socket.connect();
        } else if (window.socketService && !window.socketService.isConnected) {
          window.socketService.connectToUrl(backendUrl, this.currentUserId);
        }

        // Trigger peer fetch now that signaling is available
        setTimeout(() => this.fetchPeers(), 1500);
      } else {
        this.lanScanStatus = 'not-found';
        console.log('[LAN] No local backend found on this subnet.');
        // Retry in 30s
        setTimeout(() => { this.lanScanStatus = 'idle'; this.findLocalBackend(); }, 30000);
      }
    },
    async announcePresence() {
      if (!this.lanEnabled || !this.localIP || !this.currentUserId) return;
      await announceLanPresence(this.currentUserId, this.currentUsername, this.localIP);
    },

    async fetchPeers() {
      if (!this.lanEnabled || !this.localIP) return;
      const peers = await fetchLanPeers(this.currentUserId, this.localIP);
      this.nearbyPeers = peers;
    },

    async loadKnownContacts() {
      // Load conversation partners for offline use
      this.knownContacts = await getKnownContactsOffline();
    },

    // ── Connect to a known contact (offline-first) ───────────
    // If internet is up → try socket relay (auto handshake)
    // If offline → try direct HTTP hub, else generate invite code
    async connectToPeerOrInvite(contact) {
      if (this.isConnected(contact.userId)) return;

      this.connectingPeers[contact.userId] = true;

      const socket = lanService.socket;
      if (socket && socket.connected) {
        // Online path — let the socket relay handle it
        await this.connectToPeer(contact);
      } else {
        // Offline path — attempt auto-connect via their Local Hub
        const autoSuccess = await this.connectViaLocalHub(contact);
        if (!autoSuccess) {
          // Fallback — generate an invite code for them to paste
          this._pendingInviteForUser = contact;
          await this.startCreateInvite();
        }
      }
      
      delete this.connectingPeers[contact.userId];
    },

    async connectViaLocalHub(contact) {
      // 1. We need their IP. If not known, we can't connect directly via HTTP.
      if (!contact.lastLanIP) return false;

      try {
        console.log(`[LAN] Attempting auto-connect to ${contact.username} at ${contact.lastLanIP}:5174...`);
        const { pc, dc, payload } = await createLanOffer(
          this.currentUserId,
          this.currentUsername
        );

        // Send offer via HTTP to their Local Hub
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        
        const res = await fetch(`http://${contact.lastLanIP}:5174/offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offer: payload,
            from_user_id: this.currentUserId,
            username: this.currentUsername
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) return false;

        const data = await res.json();
        if (data && data.answer) {
          // Complete handshake
          await completeLanHandshake(pc, data.answer);
          
          return new Promise((resolve) => {
            dc.onopen = () => {
              lanService._registerExternalPeerConnection(contact.userId, pc, dc);
              this.loadStoredPeers();
              this.updateConnectedCount();
              resolve(true);
            };
            setTimeout(() => resolve(false), 3000);
          });
        }
      } catch (err) {
        console.log(`[LAN] Auto-connect to ${contact.username} failed (hub offline or unreachable).`);
      }
      return false;
    },

    isConnected(userId) {
      return lanService.isPeerReachable(userId);
    },

    isConnecting(userId) {
      return !!this.connectingPeers[userId];
    },

    async connectToPeer(peer) {
      if (this.isConnected(peer.userId) || this.isConnecting(peer.userId)) return;
      
      this.connectingPeers[peer.userId] = true;
      try {
        // We're the initiator — send an offer via backend
        const { pc, dc, payload } = await createLanOffer(
          this.currentUserId,
          this.currentUsername
        );
        
        // This is a "Cold Call" — send the offer via Socket.IO
        const socket = lanService.socket;
        if (socket) {
          socket.emit('dm:lan_offer', {
              from_user_id: String(this.currentUserId),
              to_user_id: peer.userId,
              offer: payload
            });
          
          // Wait for answer
          const onAnswer = async (data) => {
            if (String(data.from_user_id) === String(peer.userId)) {
              socket.off('dm:lan_answer', onAnswer);
              await completeLanHandshake(pc, data.answer);
              dc.onopen = () => {
                lanService._registerExternalPeerConnection(peer.userId, pc, dc);
                delete this.connectingPeers[peer.userId];
                this.loadStoredPeers();
                this.updateConnectedCount();
              };
            }
          };
          socket.on('dm:lan_answer', onAnswer);
          
          // Timeout after 30s
          setTimeout(() => {
            socket.off('dm:lan_answer', onAnswer);
            delete this.connectingPeers[peer.userId];
          }, 30000);
        }
      } catch (e) {
        console.error('[LAN] Manual connect failed:', e);
        delete this.connectingPeers[peer.userId];
      }
    },

    async loadStoredPeers() {
      const stored = await getAllStoredPeers();
      this.lanPeers = stored.map(p => ({
        userId: p.user_id,
        username: p.username || p.user_id,
        ip: p.last_resolved_ip,
        connected: lanService.isPeerReachable(p.user_id)
      }));
    },

    updateConnectedCount() {
      this.connectedCount = this.lanPeers.filter(p => p.connected).length;
    },

    // ── Create Invite ─────────────────────────
    async startCreateInvite() {
      this.step = 'generating';
      try {
        const { pc, dc, payload } = await createLanOffer(
          this.currentUserId,
          this.currentUsername
        );
        this._pc = pc;
        this._dc = dc;
        this._offerPayload = payload;

        const encoded = encodeLanPayload(payload);
        this.offerPayloadStr = encoded;
        this.offerQrUrl = await generateQRDataUrl(encoded);
        this.step = 'showing_offer';
      } catch (e) {
        console.error('[LAN Panel] Create invite error:', e);
        this.errorMsg = 'Failed to generate invite. Make sure WebRTC is available.';
        this.step = 'error';
      }
    },

    // ── Start Scan ────────────────────────────
    async startScan(mode) {
      this.scanMode = mode;
      this.step = 'scanning';
      this.manualCode = '';

      if (!this.useFileInput) {
        await this.startVideoScan();
      }
    },

    async startVideoScan() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        this._scanStream = stream;
        await this.$nextTick();
        if (this.$refs.scanVideo) {
          this.$refs.scanVideo.srcObject = stream;
        }
        this._scanInterval = setInterval(async () => {
          if (this.$refs.scanVideo && this.step === 'scanning') {
            const data = await decodeQRFromVideoFrame(this.$refs.scanVideo);
            if (data) {
              clearInterval(this._scanInterval);
              this.stopScanStream();
              await this.handleScannedData(data);
            }
          }
        }, 300);
      } catch (e) {
        console.warn('[LAN] Camera failed, switching to file input:', e);
        this.useFileInput = true;
      }
    },

    stopScanStream() {
      if (this._scanInterval) { clearInterval(this._scanInterval); this._scanInterval = null; }
      if (this._scanStream) {
        this._scanStream.getTracks().forEach(t => t.stop());
        this._scanStream = null;
      }
    },

    async onFileScanned(e) {
      const file = e.target.files[0];
      if (!file) return;
      const data = await decodeQRFromImageFile(file);
      if (data) {
        await this.handleScannedData(data);
      } else {
        this.errorMsg = 'Could not read QR code from photo. Try again.';
        this.step = 'error';
      }
    },

    async applyManualCode() {
      if (!this.manualCode.trim()) return;
      this.stopScanStream();
      await this.handleScannedData(this.manualCode.trim());
    },

    cancelScan() {
      this.stopScanStream();
      this.resetStep();
    },

    // ── Handle Scanned Data ───────────────────
    async handleScannedData(raw) {
      const payload = decodeLanPayload(raw);
      if (!payload || payload.v !== 1) {
        this.errorMsg = 'Invalid QR code. Not a NexFi LAN invite.';
        this.step = 'error';
        return;
      }

      if (this.scanMode === 'offer') {
        // We're the joiner — generate an answer
        try {
          const { pc, answerPayload } = await acceptLanOffer(
            payload,
            this.currentUserId,
            this.currentUsername
          );
          this._pc = pc;

          // Wire up data channel from peer
          pc.ondatachannel = (ev) => {
            lanService._registerExternalPeerConnection(payload.userId, pc, ev.channel);
            this.connectedCount = lanService.peers.size;
            this.step = 'connected';
          };

          const encoded = encodeLanPayload(answerPayload);
          this.answerPayloadStr = encoded;
          this.answerQrUrl = await generateQRDataUrl(encoded);
          this.step = 'showing_answer';
        } catch (e) {
          this.errorMsg = 'Failed to process invite: ' + e.message;
          this.step = 'error';
        }
      } else {
        // We're the initiator — apply the answer
        try {
          await completeLanHandshake(this._pc, payload);

          // Store peer's LAN IP from their SDP
          const peerIP = extractPeerIPFromSDP(payload.sdp || payload);
          if (peerIP && payload.userId) {
            updatePeerLanInfo(String(payload.userId), { last_resolved_ip: peerIP });
          }

          // Wire up the data channel we created
          if (this._dc) {
            this._dc.onopen = () => {
              lanService._registerExternalPeerConnection(payload.userId, this._pc, this._dc);
              this.connectedCount = lanService.peers.size;
              this.step = 'connected';
            };
          }
        } catch (e) {
          this.errorMsg = 'Failed to complete handshake: ' + e.message;
          this.step = 'error';
        }
      }
    },

    resetStep() {
      this.stopScanStream();
      this.step = 'idle';
      this.offerQrUrl = null;
      this.answerQrUrl = null;
      this.offerPayloadStr = '';
      this.answerPayloadStr = '';
      this.manualCode = '';
      this.errorMsg = '';
      this.codeCopied = false;
      this._offerPayload = null;
      // Don't close PC — let it live for messaging
    },

    async copyCode(text) {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        this.codeCopied = true;
        setTimeout(() => { this.codeCopied = false; }, 2000);
      } catch (_) {
        // Fallback: select the text
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        this.codeCopied = true;
        setTimeout(() => { this.codeCopied = false; }, 2000);
      }
    }
  }
};
</script>

<style scoped>
/* ── Panel Container ──────────────────────────── */
.lan-panel {
  margin: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(218, 165, 32, 0.2);
  overflow: hidden;
  backdrop-filter: blur(12px);
}

/* ── Header ───────────────────────────────────── */
.lan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  cursor: pointer;
  user-select: none;
}

.lan-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lan-icon { font-size: 18px; }

.lan-title {
  font-size: 15px;
  font-weight: 700;
  color: #daa520;
  letter-spacing: 0.05em;
}

.lan-live-badge {
  font-size: 9px;
  font-weight: 800;
  background: rgba(0, 201, 107, 0.2);
  color: #00c96b;
  border: 1px solid rgba(0, 201, 107, 0.4);
  border-radius: 20px;
  padding: 2px 8px;
  letter-spacing: 0.1em;
  animation: livePulse 2s ease-in-out infinite;
}

@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* ── Toggle ──────────────────────────────────── */
.lan-toggle-track {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  position: relative;
  transition: all 0.3s ease;
  cursor: pointer;
}

.lan-toggle-track.active {
  background: rgba(218, 165, 32, 0.25);
  border-color: #daa520;
}

.lan-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  transition: all 0.3s ease;
}

.lan-toggle-track.active .lan-toggle-thumb {
  left: 20px;
  background: #daa520;
  box-shadow: 0 0 8px rgba(218, 165, 32, 0.6);
}

/* ── Body ────────────────────────────────────── */
.lan-body {
  padding: 0 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Status Row ───────────────────────────────── */
.lan-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lan-ip-chip {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chip-label {
  font-size: 10px;
  opacity: 0.45;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chip-value {
  font-size: 13px;
  font-weight: 600;
  color: #daa520;
  font-variant-numeric: tabular-nums;
}

.lan-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-live { background: #00c96b; box-shadow: 0 0 8px #00c96b; animation: livePulse 1.5s ease-in-out infinite; }
.dot-ready { background: #daa520; box-shadow: 0 0 6px rgba(218,165,32,0.5); }
.dot-off { background: rgba(255,255,255,0.2); }

/* ── Peers List ───────────────────────────────── */
.lan-peers {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lan-peer-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
}

.peer-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(218,165,32,0.2);
  color: #daa520;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 12px;
  flex-shrink: 0;
}

.peer-name { flex: 1; font-size: 13px; font-weight: 500; }

.peer-status { font-size: 10px; font-weight: 700; }
.peer-live { color: #00c96b; }
.peer-stored { color: rgba(255,255,255,0.35); }

/* ── Action Buttons ───────────────────────────── */
.lan-actions {
  display: flex;
  gap: 10px;
}

.lan-btn {
  flex: 1;
  padding: 11px 8px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}

.lan-btn.primary {
  background: linear-gradient(135deg, #daa520, #b8860b);
  color: #000;
  box-shadow: 0 4px 15px rgba(218,165,32,0.3);
}

.lan-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(218,165,32,0.4); }

.lan-btn.secondary {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.85);
  border: 1px solid rgba(255,255,255,0.12);
}

.lan-btn.ghost {
  background: transparent;
  color: rgba(255,255,255,0.4);
  font-size: 12px;
  flex: none;
  padding: 8px 16px;
}

.lan-btn.danger { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.25); }

.lan-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.mt { margin-top: 8px; }

/* ── Steps ────────────────────────────────────── */
.lan-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.step-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
}

.step-actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

/* ── QR Code ──────────────────────────────────── */
.qr-wrapper {
  padding: 12px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.3);
}

.qr-img {
  display: block;
  width: 220px;
  height: 220px;
  image-rendering: pixelated;
}

.qr-fallback {
  width: 100%;
}

.fallback-label {
  font-size: 11px;
  opacity: 0.5;
  margin-bottom: 6px;
}

.fallback-code, .manual-code {
  width: 100%;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #daa520;
  font-family: monospace;
  font-size: 11px;
  padding: 8px;
  resize: none;
  box-sizing: border-box;
}

/* ── Scanner ──────────────────────────────────── */
.scanner-wrapper {
  position: relative;
  width: 100%;
  max-width: 260px;
}

.scan-video {
  width: 100%;
  border-radius: 14px;
  background: #000;
  aspect-ratio: 1;
  object-fit: cover;
}

.scan-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.scan-corners {
  width: 160px;
  height: 160px;
  border: 2px solid #daa520;
  border-radius: 4px;
  box-shadow: 0 0 0 9999px rgba(0,0,0,0.4);
}

.file-scan-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 24px;
  border-radius: 14px;
  background: rgba(218,165,32,0.1);
  border: 2px dashed rgba(218,165,32,0.4);
  color: #daa520;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  gap: 8px;
}

.manual-entry {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

/* ── Success ──────────────────────────────────── */
.success-step { padding: 12px 0; }

.success-ring {
  font-size: 52px;
  animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.success-title { font-size: 18px; font-weight: 800; color: #00c96b; }
.success-sub { font-size: 12px; opacity: 0.5; }

/* ── Error ────────────────────────────────────── */
.error-step { padding: 8px 0; }
.error-icon { font-size: 36px; }
.error-msg { font-size: 13px; color: #f87171; }

/* ── Spinner ──────────────────────────────────── */
.lan-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(218,165,32,0.2);
  border-top-color: #daa520;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.hint { font-size: 12px; opacity: 0.45; }

/* ── Code Display ─────────────────────────────── */
.code-display {
  width: 100%;
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(218,165,32,0.25);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.code-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(218,165,32,0.7);
  font-weight: 700;
}

.code-value {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  word-break: break-all;
  cursor: pointer;
  padding: 8px;
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  line-height: 1.4;
}

.code-value:active { background: rgba(218,165,32,0.1); }

.copy-btn {
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(218,165,32,0.2), rgba(218,165,32,0.1));
  border: 1px solid rgba(218,165,32,0.35);
  color: #daa520;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:active { transform: scale(0.98); }

/* ── Transition ───────────────────────────────── */
.lan-expand-enter-active,
.lan-expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.lan-expand-enter-from,
.lan-expand-leave-to {
  max-height: 0;
  opacity: 0;
  padding-bottom: 0;
}

/* ── Nearby Section ───────────────────────────── */
.nearby-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(0,0,0,0.2);
  border-radius: 14px;
  padding: 14px;
}

.nearby-label {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.nearby-peer-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.nearby-peer-row:last-child { border-bottom: none; }

.peer-avatar.near { background: rgba(0, 201, 107, 0.15); color: #00c96b; }

.peer-meta { flex: 1; display: flex; flex-direction: column; }
.peer-sub { font-size: 10px; opacity: 0.4; }

.connect-btn {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid rgba(218,165,32,0.4);
  background: transparent;
  color: #daa520;
  transition: all 0.2s;
}

.connect-btn.connected {
  background: rgba(0, 201, 107, 0.1);
  border-color: #00c96b;
  color: #00c96b;
}

.connect-btn.connecting { opacity: 0.6; pointer-events: none; }

.no-peers-hint {
  text-align: center;
  padding: 20px;
  opacity: 0.5;
}

.sub-hint { font-size: 10px; margin-top: 4px; }

/* ── Known Contacts (offline) ────────────────── */
.known-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(255,255,255,0.02);
  border: 1px dashed rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 14px;
}

.known-hint {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
  margin: 0 0 4px;
  line-height: 1.5;
}

/* ── Scan Status Row ───────────────────── */
.scan-status-row {
  display: flex;
  align-items: center;
}

.scan-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  letter-spacing: 0.04em;
}

.scan-chip.scanning {
  background: rgba(218,165,32,0.1);
  color: #daa520;
  animation: livePulse 1.5s ease-in-out infinite;
}

.scan-chip.found {
  background: rgba(0,201,107,0.12);
  color: #00c96b;
  border: 1px solid rgba(0,201,107,0.3);
}

.scan-chip.offline {
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.3);
}

.lan-expand-enter-to,
.lan-expand-leave-from {
  max-height: 1000px;
  opacity: 1;
}
</style>
