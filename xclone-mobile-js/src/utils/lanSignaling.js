/**
 * lanSignaling.js — Serverless LAN Signaling via WebRTC + QR Code
 *
 * Works on: iOS Safari, Android APK, Android Browser, Desktop
 * Requires: No internet, no server, no native plugins.
 *
 * Flow:
 *   Initiator: createLanOffer() → encode QR → partner scans
 *   Joiner:    acceptLanOffer() → encode answer QR → initiator scans
 *   Initiator: completeLanHandshake() → DataChannel OPEN ✅
 */

import { db, updatePeerLanInfo, getPeerLanIP, getAllPeerInfo, getOfflineConversations } from './offlineDb.js';
import api from './api.js';

// ─────────────────────────────────────────────────────────────
//  Discover own local IP via WebRTC SDP trick (no server needed)
// ─────────────────────────────────────────────────────────────
export async function getLocalIP() {
    // 1. If in Electron (Desktop), use Node's os module
    const isElectron = navigator.userAgent.toLowerCase().includes(' electron/');
    if (isElectron) {
        try {
            const os = window.require?.('os');
            if (os) {
                const interfaces = os.networkInterfaces();
                for (const name of Object.keys(interfaces)) {
                    for (const iface of interfaces[name]) {
                        if (iface.family === 'IPv4' && !iface.internal) {
                            return iface.address;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[LAN] Electron IP detection failed, falling back...');
        }
    }

    // 2. WebRTC Trick (Browser fallback)
    return new Promise((resolve) => {
        try {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('ip-detect');
            pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {});

            const found = new Set();
            pc.onicecandidate = (e) => {
                if (!e.candidate) {
                    pc.close();
                    const ips = [...found].filter(ip => ip !== '127.0.0.1' && ip !== '0.0.0.0');
                    resolve(ips[0] || null);
                    return;
                }
                const match = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
                if (match) found.add(match[1]);
            };

            setTimeout(() => {
                try { pc.close(); } catch (_) {}
                const ips = [...found].filter(ip => ip !== '127.0.0.1' && ip !== '0.0.0.0');
                resolve(ips[0] || null);
            }, 3000);
        } catch (e) {
            resolve(null);
        }
    });
}

// ─────────────────────────────────────────────────────────────
//  Wait for ICE gathering to complete (collect all local candidates)
// ─────────────────────────────────────────────────────────────
function waitForIceGathering(pc, timeoutMs = 5000) {
    return new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const check = () => { if (pc.iceGatheringState === 'complete') { resolve(); } };
        pc.addEventListener('icegatheringstatechange', check);
        setTimeout(() => { pc.removeEventListener('icegatheringstatechange', check); resolve(); }, timeoutMs);
    });
}

// ─────────────────────────────────────────────────────────────
//  Initiator: create offer with local ICE candidates
// ─────────────────────────────────────────────────────────────
export async function createLanOffer(userId, username) {
    const pc = new RTCPeerConnection({ iceServers: [] }); // No STUN = LAN only
    const dc = pc.createDataChannel('nexfi-lan', { ordered: true });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for all local ICE candidates to be gathered
    await waitForIceGathering(pc);

    const localIP = await getLocalIP();

    const payload = {
        sdp: pc.localDescription.sdp,
        type: pc.localDescription.type,
        userId: String(userId),
        username: String(username || 'User'),
        ip: localIP,
        v: 1
    };

    return { pc, dc, payload };
}

// ─────────────────────────────────────────────────────────────
//  Joiner: accept offer, create answer
// ─────────────────────────────────────────────────────────────
export async function acceptLanOffer(offerPayload, myUserId, myUsername) {
    const pc = new RTCPeerConnection({ iceServers: [] });

    // Store peer IP on receipt
    if (offerPayload.ip && offerPayload.userId) {
        await storePeerLanIP(offerPayload.userId, offerPayload.ip);
    }

    await pc.setRemoteDescription({ type: offerPayload.type, sdp: offerPayload.sdp });

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await waitForIceGathering(pc);

    const localIP = await getLocalIP();

    const answerPayload = {
        sdp: pc.localDescription.sdp,
        type: pc.localDescription.type,
        userId: String(myUserId),
        username: String(myUsername || 'User'),
        ip: localIP,
        v: 1
    };

    return { pc, answerPayload };
}

// ─────────────────────────────────────────────────────────────
//  Initiator: complete handshake by applying the answer
// ─────────────────────────────────────────────────────────────
export async function completeLanHandshake(pc, answerPayload) {
    await pc.setRemoteDescription({ type: answerPayload.type, sdp: answerPayload.sdp });
    if (answerPayload.ip && answerPayload.userId) {
        await storePeerLanIP(answerPayload.userId, answerPayload.ip);
    }
}

// ─────────────────────────────────────────────────────────────
//  Encode/Decode payload for QR code
// ─────────────────────────────────────────────────────────────
export function encodeLanPayload(payload) {
    try {
        return btoa(encodeURIComponent(JSON.stringify(payload)));
    } catch (e) {
        return null;
    }
}

export function decodeLanPayload(encoded) {
    try {
        return JSON.parse(decodeURIComponent(atob(encoded)));
    } catch (e) {
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
//  QR Generation — uses qrcode npm package if installed,
//  otherwise returns null (text fallback shown in UI)
// ─────────────────────────────────────────────────────────────
export async function generateQRDataUrl(text) {
    // QR generation via npm package is optional.
    // The LanModePanel shows a copy-paste code when this returns null.
    // To enable QR images: npm install qrcode  then uncomment below.
    //
    // try {
    //   const mod = await import(/* @vite-ignore */ 'qrcode');
    //   return await mod.default.toDataURL(text, { width: 280, margin: 2 });
    // } catch (_) { return null; }
    return null;
}

// ─────────────────────────────────────────────────────────────
//  QR Scanning — uses BarcodeDetector (built into Chrome/Android)
//  No npm package needed. Falls back to null for manual entry.
// ─────────────────────────────────────────────────────────────
export async function decodeQRFromImageFile(file) {
    try {
        if (!('BarcodeDetector' in window)) return null;
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const img = await createImageBitmap(file);
        const codes = await detector.detect(img);
        return codes.length > 0 ? codes[0].rawValue : null;
    } catch (_) {
        return null;
    }
}

export async function decodeQRFromVideoFrame(videoEl) {
    try {
        if (!('BarcodeDetector' in window)) return null;
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const codes = await detector.detect(videoEl);
        return codes.length > 0 ? codes[0].rawValue : null;
    } catch (_) {
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
//  IndexedDB: Store/get peer LAN IPs
// ─────────────────────────────────────────────────────────────
export async function storePeerLanIP(userId, ip) {
    try {
        await updatePeerLanInfo(String(userId), { last_resolved_ip: ip });
    } catch (e) {
        console.error('[LAN] Failed to store peer IP:', e);
    }
}

export async function getStoredPeerLanIP(userId) {
    try {
        return await getPeerLanIP(String(userId));
    } catch (_) {
        return null;
    }
}

export async function getAllStoredPeers() {
    try {
        return await db.peerInfo.toArray();
    } catch (_) {
        return [];
    }
}

// ─────────────────────────────────────────────────────────────
//  Backend-assisted LAN Peer Discovery
//  Announce own LAN IP to server, fetch others on same subnet
// ─────────────────────────────────────────────────────────────
export async function announceLanPresence(userId, username, localIP) {
    if (!localIP) return;
    try {
        await api.post('/api/lan/announce', { userId, username, localIP });
    } catch (_) {
        // Silently fail — offline is expected
    }
}

export async function fetchLanPeers(myUserId, myLocalIP) {
    if (!myLocalIP) return [];
    try {
        const res = await api.get(`/api/lan/peers?myIP=${encodeURIComponent(myLocalIP)}&userId=${myUserId}`);
        return res.peers || [];
    } catch (_) {
        return []; // Offline — return empty
    }
}

// ─────────────────────────────────────────────────────────────
//  Scan LAN for a running NexFi backend (port 5000)
//
//  When internet is off, one device on the LAN may still be
//  running the NexFi backend locally (python app.py).
//  We scan the current subnet in parallel to find it.
//  Once found, the app can connect Socket.IO to it and use
//  it as a local signaling hub — enabling zero-interaction
//  automatic peer discovery and WebRTC connection.
//
//  Returns: "http://192.168.x.y:5000" or null
// ─────────────────────────────────────────────────────────────
export async function scanForLocalNexfiBackend(myLocalIP) {
    if (!myLocalIP) return null;

    const parts = myLocalIP.split('.');
    if (parts.length !== 4) return null;
    const subnet = parts.slice(0, 3).join('.');
    const myOctet = parseInt(parts[3], 10);

    // Build candidate IPs: own IP first (backend on same device),
    // then scan the full subnet in parallel
    const candidates = [myLocalIP];
    for (let i = 1; i <= 254; i++) {
        if (i !== myOctet) candidates.push(`${subnet}.${i}`);
    }

    // Run all probes in parallel with a 500ms timeout each
    let found = null;
    const results = await Promise.allSettled(
        candidates.map(async (ip) => {
            if (found) return; // Early exit once found
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 500);
            try {
                const res = await fetch(`http://${ip}:5000/api/ping`, {
                    signal: controller.signal,
                    cache: 'no-store',
                    // Note: no-cors would give opaque response, but we
                    // need to read the body to confirm it's NexFi
                    mode: 'cors',
                    headers: { 'Accept': 'application/json' }
                });
                clearTimeout(timer);
                if (res.ok) {
                    const data = await res.json().catch(() => null);
                    // Confirm it's a NexFi backend
                    if (data && (data.app === 'nexfi' || data.status === 'ok')) {
                        if (!found) found = `http://${ip}:5000`;
                    }
                }
            } catch (_) {
                clearTimeout(timer);
            }
        })
    );

    return found;
}

// ─────────────────────────────────────────────────────────────
//  Scan LAN for a Desktop/Mobile Local Signaling Hub (port 5174)
//
//  This allows pure Web Browsers to find an offline local hub
//  to relay their WebRTC SDPs without scanning QR codes.
// ─────────────────────────────────────────────────────────────
export async function scanForLocalHubs(myLocalIP) {
    if (!myLocalIP) return null;

    const parts = myLocalIP.split('.');
    if (parts.length !== 4) return null;
    const subnet = parts.slice(0, 3).join('.');
    const myOctet = parseInt(parts[3], 10);

    const candidates = [myLocalIP];
    for (let i = 1; i <= 254; i++) {
        if (i !== myOctet) candidates.push(`${subnet}.${i}`);
    }

    let found = null;
    await Promise.allSettled(
        candidates.map(async (ip) => {
            if (found) return;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 500);
            try {
                const res = await fetch(`http://${ip}:5174/ping`, {
                    signal: controller.signal,
                    cache: 'no-store',
                    mode: 'cors',
                    headers: { 'Accept': 'application/json' }
                });
                clearTimeout(timer);
                if (res.ok) {
                    const data = await res.json().catch(() => null);
                    if (data && data.app === 'nexfi-hub') {
                        if (!found) found = `http://${ip}:5174`;
                    }
                }
            } catch (_) {
                clearTimeout(timer);
            }
        })
    );

    return found;
}

// ─────────────────────────────────────────────────────────────
//  Extract peer's LAN IP from their SDP ICE candidates.
//  Called after WebRTC offer/answer so we can cache the IP.
// ─────────────────────────────────────────────────────────────
export function extractPeerIPFromSDP(sdp) {
    if (!sdp) return null;
    // Look for "typ host" candidates — these are the real LAN IPs
    const lines = (typeof sdp === 'string' ? sdp : sdp.sdp || '').split('\n');
    for (const line of lines) {
        if (line.includes('typ host')) {
            const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
            if (match) {
                const ip = match[1];
                // Skip loopback and link-local
                if (!ip.startsWith('127.') && !ip.startsWith('169.254.')) {
                    return ip;
                }
            }
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────
//  Offline Subnet Scanner
//
//  When there's no internet and no backend, we can still find
//  known NexFi peers on the current LAN by:
//  1. Getting our own current subnet (e.g. 10.0.0)
//  2. Checking if any stored peer's known_subnets match the pattern
//     of the current subnet last octet range (heuristic)
//  3. Trying to fetch http://[ip]:5173/nexfi-ping for each candidate
//
//  Returns: [{ userId, username, candidateIP }]
// ─────────────────────────────────────────────────────────────
export async function getKnownContactsOffline() {
    // Return all contacts we have conversation history with,
    // merged with any cached peerInfo
    try {
        const [conversations, peers] = await Promise.all([
            getOfflineConversations(),
            getAllPeerInfo()
        ]);
        const peerMap = {};
        peers.forEach(p => { peerMap[String(p.user_id)] = p; });

        return conversations.map(conv => ({
            userId: String(conv.user_id),
            username: conv.username || conv.user_id,
            avatar: conv.avatar,
            lastLanIP: peerMap[String(conv.user_id)]?.last_resolved_ip || null,
            knownSubnets: peerMap[String(conv.user_id)]?.known_subnets || [],
        }));
    } catch (_) {
        return [];
    }
}

export async function scanSubnetForKnownPeers(myLocalIP, knownContacts) {
    if (!myLocalIP || !knownContacts?.length) return [];
    const myParts = myLocalIP.split('.');
    if (myParts.length !== 4) return [];
    const mySubnet = myParts.slice(0, 3).join('.'); // e.g. "10.0.0"

    // Only scan contacts whose last known subnet differs from current
    // (same-subnet contacts are handled by backend-assisted discovery)
    const toScan = knownContacts.filter(c =>
        c.knownSubnets.length > 0 &&
        !c.knownSubnets.includes(mySubnet)
    );
    if (!toScan.length) return [];

    console.log('[LAN Scan] Scanning for', toScan.length, 'known contacts on subnet', mySubnet);

    // Build candidate IPs: try last octet of each known IP on current subnet
    const candidatePairs = [];
    toScan.forEach(contact => {
        if (contact.lastLanIP) {
            const lastOctet = contact.lastLanIP.split('.')[3];
            if (lastOctet) {
                candidatePairs.push({ contact, ip: `${mySubnet}.${lastOctet}` });
            }
        }
    });

    // Also add a few surrounding octets in case DHCP shifted slightly
    const extraPairs = [];
    candidatePairs.forEach(({ contact, ip }) => {
        const parts = ip.split('.');
        const base = parseInt(parts[3], 10);
        [-3, -2, -1, 1, 2, 3].forEach(offset => {
            const octet = base + offset;
            if (octet > 0 && octet < 255) {
                extraPairs.push({ contact, ip: `${mySubnet}.${octet}` });
            }
        });
    });

    const allPairs = [...candidatePairs, ...extraPairs];
    const found = [];

    // Probe each candidate IP
    const probes = allPairs.map(async ({ contact, ip }) => {
        try {
            // Try fetching /nexfi-ping with a 400ms timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 400);
            const res = await fetch(`http://${ip}:5173/nexfi-ping`, {
                signal: controller.signal,
                mode: 'no-cors',
                cache: 'no-store'
            });
            clearTimeout(timeout);
            // If we got a response (opaque or otherwise), the host is alive
            found.push({ contact, ip, reachable: true });
        } catch (_) {
            // Unreachable — expected for most IPs
        }
    });

    await Promise.allSettled(probes);

    console.log('[LAN Scan] Found', found.length, 'reachable hosts');
    return found;
}
