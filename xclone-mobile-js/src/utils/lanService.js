/**
 * lanService.js — NexFi LAN-First P2P Messaging
 *
 * Architecture:
 *   • Socket.IO (existing server) = signaling channel only
 *   • WebRTC DataChannel = actual message transport (P2P)
 *   • IndexedDB (Dexie) = local persistence with status tracking
 *
 * Message Status Lifecycle:
 *   local → delivered → synced
 */

import { saveLocalMessage, markMessageDelivered } from './offlineDb.js';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

const MAX_BINARY_SIZE = 1024 * 1024; // 1 MB cap for LAN transfer

class LanService {
    constructor() {
        this.myUserId = null;
        this.socket = null;

        // Map<peerId (user_id string), { pc: RTCPeerConnection, dc: RTCDataChannel, state: 'connecting'|'open'|'closed' }>
        this.peers = new Map();

        // Callbacks registered by DMPage
        this._onMessageCallbacks = [];
        this._onStatusChange = null;
    }

    // ─────────────────────────────────────────────
    //  Initialise with socket + userId
    // ─────────────────────────────────────────────
    init(socket, userId) {
        if (this.myUserId === userId && this.socket === socket) return; // already initialised
        this.myUserId = String(userId);
        this.socket = socket;
        this._listenSignaling();
        console.log('[LAN] Service initialised for user', this.myUserId);
    }

    // ─────────────────────────────────────────────
    //  Attach inbound message handler from DMPage
    // ─────────────────────────────────────────────
    onMessage(callback) {
        this._onMessageCallbacks.push(callback);
    }

    onStatusChange(callback) {
        this._onStatusChange = callback;
    }

    // ─────────────────────────────────────────────
    //  Public: check if we have an OPEN data channel
    //  to a specific peer
    // ─────────────────────────────────────────────
    isPeerReachable(toUserId) {
        const peer = this.peers.get(String(toUserId));
        return peer && peer.dc && peer.dc.readyState === 'open';
    }

    // ─────────────────────────────────────────────
    //  Public: initiate a connection to a peer
    //  Called when the user opens a chat
    // ─────────────────────────────────────────────
    async connectToPeer(toUserId) {
        const id = String(toUserId);
        if (this.peers.has(id)) {
            const existing = this.peers.get(id);
            if (existing.state === 'open') return;
            if (existing.state === 'connecting') return;
        }

        console.log('[LAN] Initiating connection to', id);
        const pc = this._createPeerConnection(id);
        const dc = pc.createDataChannel('nexfi-dm', { ordered: true });
        this._setupDataChannel(dc, id);

        this.peers.set(id, { pc, dc, state: 'connecting' });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.socket.emit('dm:webrtc_offer', {
            from: this.myUserId,
            to: id,
            sdp: pc.localDescription,
        });
    }

    // ─────────────────────────────────────────────
    //  Public: send a message over DataChannel
    //  Returns true on success, false if not reachable
    // ─────────────────────────────────────────────
    sendMessage(toUserId, messageObj) {
        const id = String(toUserId);
        const peer = this.peers.get(id);
        if (!peer || peer.dc.readyState !== 'open') return false;

        try {
            const payload = JSON.stringify({ type: 'dm', ...messageObj });
            if (payload.length > MAX_BINARY_SIZE) {
                console.warn('[LAN] Payload too large for DataChannel, falling back.');
                return false;
            }
            peer.dc.send(payload);
            console.log('[LAN] Message sent via DataChannel to', id);
            return true;
        } catch (err) {
            console.error('[LAN] DataChannel send error:', err);
            return false;
        }
    }

    // ─────────────────────────────────────────────
    //  Internal: listen for signaling events from
    //  Socket.IO and handle offer/answer/ICE
    // ─────────────────────────────────────────────
    _listenSignaling() {
        if (!this.socket) return;

        // Inbound offer from a remote peer
        this.socket.on('dm:webrtc_offer', async (data) => {
            if (!data || String(data.to) !== this.myUserId) return;
            const fromId = String(data.from);
            console.log('[LAN] Received offer from', fromId);

            const pc = this._createPeerConnection(fromId);
            this.peers.set(fromId, { pc, dc: null, state: 'connecting' });

            pc.ondatachannel = (event) => {
                const dc = event.channel;
                this._setupDataChannel(dc, fromId);
                const peer = this.peers.get(fromId);
                if (peer) peer.dc = dc;
            };

            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            this.socket.emit('dm:webrtc_answer', {
                from: this.myUserId,
                to: fromId,
                sdp: pc.localDescription,
            });
        });

        // Inbound answer
        this.socket.on('dm:webrtc_answer', async (data) => {
            if (!data || String(data.to) !== this.myUserId) return;
            const fromId = String(data.from);
            console.log('[LAN] Received answer from', fromId);
            const peer = this.peers.get(fromId);
            if (!peer) return;
            await peer.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        });

        // ICE candidate relay
        this.socket.on('dm:webrtc_ice', async (data) => {
            if (!data || String(data.to) !== this.myUserId) return;
            const fromId = String(data.from);
            const peer = this.peers.get(fromId);
            if (!peer) return;
            try {
                await peer.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.warn('[LAN] ICE candidate error:', e);
            }
        });
    }

    // ─────────────────────────────────────────────
    //  Internal: create RTCPeerConnection with ICE
    // ─────────────────────────────────────────────
    _createPeerConnection(peerId) {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onicecandidate = (event) => {
            if (event.candidate && this.socket) {
                this.socket.emit('dm:webrtc_ice', {
                    from: this.myUserId,
                    to: peerId,
                    candidate: event.candidate,
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[LAN] Connection to ${peerId}: ${pc.connectionState}`);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                const peer = this.peers.get(peerId);
                if (peer) peer.state = 'closed';
                if (this._onStatusChange) this._onStatusChange(peerId, 'closed');
            }
        };

        return pc;
    }

    // ─────────────────────────────────────────────
    //  Internal: wire up DataChannel events
    // ─────────────────────────────────────────────
    _setupDataChannel(dc, peerId) {
        dc.onopen = () => {
            console.log('[LAN] DataChannel OPEN with', peerId);
            const peer = this.peers.get(peerId);
            if (peer) peer.state = 'open';
            if (this._onStatusChange) this._onStatusChange(peerId, 'open');
        };

        dc.onclose = () => {
            console.log('[LAN] DataChannel CLOSED with', peerId);
            const peer = this.peers.get(peerId);
            if (peer) peer.state = 'closed';
            if (this._onStatusChange) this._onStatusChange(peerId, 'closed');
        };

        dc.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type !== 'dm') return;

                console.log('[LAN] Message received from', peerId, data);

                // Save into local IndexedDB as 'delivered'
                const msg = {
                    id: data.local_id,
                    from_user_id: data.from_user_id,
                    to_user_id: data.to_user_id,
                    text: data.text || '',
                    image: data.image || '',
                    voice: data.voice || '',
                    mood: data.mood || null,
                    timestamp: data.timestamp || new Date().toISOString(),
                    read: false,
                    sent_by_me: false,
                    status: 'delivered',
                };

                await saveLocalMessage(msg);

                // Ack back to sender
                dc.send(JSON.stringify({ type: 'dm:ack', local_id: data.local_id }));

                // Notify DMPage to refresh messages
                this._onMessageCallbacks.forEach(cb => cb(msg));
            } catch (err) {
                console.error('[LAN] Error handling DataChannel message:', err);
            }
        };
    }

    // ─────────────────────────────────────────────
    //  Close all peer connections (on logout)
    // ─────────────────────────────────────────────
    destroy() {
        this.peers.forEach(({ pc }) => {
            try { pc.close(); } catch (_) { }
        });
        this.peers.clear();
        this._onMessageCallbacks = [];
        console.log('[LAN] Service destroyed');
    }
}

// Singleton
const lanService = new LanService();
export default lanService;
