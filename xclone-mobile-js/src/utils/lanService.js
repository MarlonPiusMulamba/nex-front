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

import { saveLocalMessage, markMessageDelivered, updatePeerLanInfo, getPeerLanIP } from './offlineDb.js';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();
let Zeroconf = null;

// Only import native plugin if we are on a real device
if (isNative) {
    import('capacitor-zeroconf').then(m => {
        Zeroconf = m.Zeroconf;
    }).catch(e => console.warn('[LAN] Zeroconf plugin not found'));
}

const isElectron = navigator.userAgent.toLowerCase().includes(' electron/');

const LAN_SERVICE_TYPE = '_nexfi._tcp.';
const LAN_SERVICE_PORT = 5000; // Symbolic, since we use P2P signaling

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

const MAX_BINARY_SIZE = 1024 * 1024; // 1 MB cap for LAN transfer

class LanService {
    constructor() {
        this.myUserId = null;
        this.socket = null;
        this.keepAliveInterval = null;

        // Map<peerId (user_id string), { pc: RTCPeerConnection, dc: RTCDataChannel, state: 'connecting'|'open'|'closed' }>
        this.peers = new Map();

        // Callbacks registered by DMPage / CallOverlay
        this._onMessageCallbacks = [];
        this._onCallSignalCallbacks = [];
        this._onHeartbeatCallbacks = [];
        this._onStatusChange = null;

        this.isDiscoveryActive = false;
        this.discoveredPeers = new Map(); // userId -> { ip, port, name }
    }

    // ─────────────────────────────────────────────
    //  Initialise with socket + userId
    // ─────────────────────────────────────────────
    init(socket, userId, username) {
        if (this.myUserId === userId && this.socket === socket) return;
        this.myUserId = String(userId);
        this._myUsername = username || String(userId);
        this.socket = socket;
        this._listenSignaling();
        
        // Start LAN discovery
        this.startDiscovery();
        this.publishPresence();
        this._startKeepAlive();
        this._startDesktopDiscovery(); // For Electron

        console.log('[LAN] Service initialised for user', this.myUserId);
    }

    // ─────────────────────────────────────────────
    //  Attach inbound message handler from DMPage
    // ─────────────────────────────────────────────
    onMessage(callback) {
        this._onMessageCallbacks.push(callback);
    }

    onCallSignal(callback) {
        this._onCallSignalCallbacks.push(callback);
    }

    onHeartbeat(callback) {
        this._onHeartbeatCallbacks.push(callback);
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
    //  Public: send a Call Signal over DataChannel
    //  (Bypasses backend for audio/video signaling)
    // ─────────────────────────────────────────────
    sendCallSignal(toUserId, signalData) {
        const id = String(toUserId);
        const peer = this.peers.get(id);
        if (!peer || peer.dc.readyState !== 'open') return false;

        try {
            const payload = JSON.stringify({ 
                type: 'call:signal', 
                from_user_id: this.myUserId,
                ...signalData 
            });
            peer.dc.send(payload);
            return true;
        } catch (err) {
            console.error('[LAN] Call signal send error:', err);
            return false;
        }
    }

    sendHeartbeat(toUserId, isTyping = false) {
        const id = String(toUserId);
        const peer = this.peers.get(id);
        if (!peer || peer.dc.readyState !== 'open') return false;

        try {
            peer.dc.send(JSON.stringify({ 
                type: 'presence:heartbeat', 
                from_user_id: this.myUserId,
                is_typing: isTyping 
            }));
            return true;
        } catch (_) {
            return false;
        }
    }

    // ─────────────────────────────────────────────
    //  Register external connection (from QR Handshake)
    // ─────────────────────────────────────────────
    _registerExternalPeerConnection(peerId, pc, dc) {
        const id = String(peerId);
        this.peers.set(id, { pc, dc, state: dc.readyState });
        this._setupDataChannel(dc, id);
        
        pc.onconnectionstatechange = () => {
            console.log(`[LAN] External Connection to ${id}: ${pc.connectionState}`);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                const peer = this.peers.get(id);
                if (peer) peer.state = 'closed';
                if (this._onStatusChange) this._onStatusChange(id, 'closed');
            }
        };
        console.log('[LAN] Registered external peer connection for', id);
    }

    _startKeepAlive() {
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = setInterval(() => {
            this.peers.forEach((peer, id) => {
                if (peer.dc && peer.dc.readyState === 'open') {
                    try {
                        peer.dc.send(JSON.stringify({ type: 'presence:keepalive' }));
                    } catch (e) {
                        console.warn('[LAN] Keepalive failed for', id);
                    }
                }
            });
        }, 15000); // Ping every 15s
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

        // ── LAN Auto-Discovery: incoming connection request ──────────
        // Peer A tapped "Connect" on the nearby list → we receive their offer
        // We auto-accept and send back an answer (no user input needed)
        this.socket.on('dm:lan_offer', async (data) => {
            const fromId = String(data.from_user_id || '');
            if (!fromId || !data.offer) return;
            console.log('[LAN] Auto-discovery offer from', fromId);

            try {
                const { acceptLanOffer, encodeLanPayload } = await import('./lanSignaling.js');
                const { pc, answerPayload } = await acceptLanOffer(
                    data.offer,
                    this.myUserId,
                    this._myUsername || this.myUserId
                );

                // Wire the incoming data channel
                pc.ondatachannel = (ev) => {
                    const dc = ev.channel;
                    this._setupDataChannel(dc, fromId);
                    this.peers.set(fromId, { pc, dc, state: dc.readyState });
                    if (this._onStatusChange) this._onStatusChange(fromId, 'open');
                    console.log('[LAN] Auto-connected to', fromId);
                };

                // Relay the answer back to the initiator
                this.socket.emit('dm:lan_answer', {
                    from_user_id: this.myUserId,
                    to_user_id: fromId,
                    answer: answerPayload
                });
            } catch (e) {
                console.error('[LAN] Auto-accept offer failed:', e);
            }
        });

        // ── LAN Auto-Discovery: incoming answer to our offer ─────────
        // After we sent dm:lan_offer, we get the answer here
        // LanModePanel.connectToPeer() also listens for this directly,
        // but this handler covers the case where lanService initiated it
        this.socket.on('dm:lan_answer', async (data) => {
            const fromId = String(data.from_user_id || '');
            if (!fromId || !data.answer) return;
            const peer = this.peers.get(fromId);
            if (!peer) return; // LanModePanel handles it directly
            try {
                const { completeLanHandshake } = await import('./lanSignaling.js');
                await completeLanHandshake(peer.pc, data.answer);
                console.log('[LAN] Auto-discovery handshake complete with', fromId);
            } catch (e) {
                console.error('[LAN] Auto-answer complete failed:', e);
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
                
                // Handle Call Signaling
                if (data.type === 'call:signal') {
                    console.log('[LAN] Call signal received from', peerId, data);
                    this._onCallSignalCallbacks.forEach(cb => cb(peerId, data));
                    return;
                }

                // Handle Heartbeat
                if (data.type === 'presence:heartbeat') {
                    this._onHeartbeatCallbacks?.forEach(cb => cb(peerId, data.is_typing));
                    return;
                }

                // Handle Keepalive
                if (data.type === 'presence:keepalive') {
                    // Do nothing, just keeps connection active
                    return;
                }

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
    //  ZeroConf: Discovery & Presence
    // ─────────────────────────────────────────────

    async publishPresence() {
        if (!this.myUserId || !isNative || !Zeroconf) return;
        try {
            await Zeroconf.register({
                type: LAN_SERVICE_TYPE,
                name: `nexfi-${this.myUserId}`,
                port: LAN_SERVICE_PORT,
                txt: {
                    userId: this.myUserId,
                    username: localStorage.getItem('username') || 'Unknown'
                }
            });
            console.log('[LAN] Presence published as', this.myUserId);
        } catch (e) {
            console.error('[LAN] Failed to publish presence:', e);
        }
    }

    async startDiscovery() {
        if (this.isDiscoveryActive) return;
        this.isDiscoveryActive = true;

        // 1. Native Mobile Discovery (mDNS)
        if (isNative && Zeroconf) {
            try {
                await Zeroconf.watch({ type: LAN_SERVICE_TYPE }, (result) => {
                    const { action, service } = result;
                    if (action === 'resolved') {
                        const userId = service.txt?.userId || service.name.replace('nexfi-', '');
                        const ip = service.ipv4Addresses?.[0] || service.host;
                        
                        if (userId && ip) {
                            this._onPeerDiscovered(userId, ip, service.name);
                        }
                    }
                });
            } catch (e) {
                console.error('[LAN] Mobile discovery failed:', e);
            }
        }

        // 2. Browser/Web Discovery (Heuristic Scan)
        // This runs in the background and probes likely IPs
        if (!isNative && !isElectron) {
            this._startWebSubnetScanner();
        }
    }

    _onPeerDiscovered(userId, ip, name) {
        if (userId === this.myUserId) return;
        console.log(`[LAN] Discovered peer: ${userId} at ${ip}`);
        this.discoveredPeers.set(userId, { ip, port: LAN_SERVICE_PORT, name });
        updatePeerLanInfo(userId, { last_resolved_ip: ip, zeroconf_name: name });
        
        // Notify UI if needed
        if (this._onStatusChange) this._onStatusChange(userId, 'discovered');
    }

    _startDesktopDiscovery() {
        if (!isElectron) return;
        // In Electron, we use UDP Broadcast to find peers
        try {
            // Capacitor Electron provides node access via window.CapacitorCustomPlatform
            const dgram = window.require?.('dgram');
            if (!dgram) return;

            const server = dgram.createSocket('udp4');
            const PORT = 41234;

            server.on('message', (msg, rinfo) => {
                try {
                    const data = JSON.parse(msg.toString());
                    if (data.app === 'nexfi' && data.userId !== this.myUserId) {
                        this._onPeerDiscovered(data.userId, rinfo.address, data.username);
                    }
                } catch (e) {}
            });

            server.bind(PORT, () => {
                server.setBroadcast(true);
                // Broadcast our presence every 5 seconds
                setInterval(() => {
                    const message = JSON.stringify({
                        app: 'nexfi',
                        userId: this.myUserId,
                        username: this._myUsername
                    });
                    server.send(message, PORT, '255.255.255.255');
                }, 5000);
            });
        } catch (e) {
            console.error('[LAN] Desktop UDP discovery failed:', e);
        }
    }

    async _startWebSubnetScanner() {
        // This is a placeholder for the browser-based discovery 
        // using the fetch() probe method we discussed earlier.
        // It helps find peers when running as a normal website.
    }

    stopDiscovery() {
        if (!isNative || !Zeroconf) return;
        try { Zeroconf.unwatch({ type: LAN_SERVICE_TYPE }); } catch (_) {}
        try { Zeroconf.unregister({ type: LAN_SERVICE_TYPE, name: `nexfi-${this.myUserId}` }); } catch (_) {}
        this.isDiscoveryActive = false;
    }

    // ─────────────────────────────────────────────
    //  Close all peer connections (on logout)
    // ─────────────────────────────────────────────
    destroy() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        this.stopDiscovery();
        this.peers.forEach(({ pc }) => {
            try { pc.close(); } catch (_) { }
        });
        this.peers.clear();
        this._onMessageCallbacks = [];
        this._onCallSignalCallbacks = [];
        console.log('[LAN] Service destroyed');
    }
}

// Singleton
const lanService = new LanService();
export default lanService;
