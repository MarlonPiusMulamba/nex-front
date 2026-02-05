// Socket.IO Service for Real-time Features and Presence Tracking
import { io } from 'socket.io-client';
import config from '../config/index.js';

class SocketService {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.isConnected = false;
        this.heartbeatInterval = null;
        this.onlineStatusCallbacks = [];
    }

    connect(userId) {
        if (this.socket && this.isConnected) {
            console.log('✅ Socket already connected');
            return;
        }

        this.userId = userId;
        const apiUrl = config.api?.baseURL || config.baseURL;

        console.log('🔌 Connecting to Socket.IO:', apiUrl);

        this.socket = io(apiUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        this.socket.on('connect', () => {
            console.log('✅ Socket.IO connected');
            this.isConnected = true;

            // Register user for presence tracking
            this.socket.emit('user:register', { user_id: this.userId });

            // Start heartbeat
            this.startHeartbeat();
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Socket.IO disconnected');
            this.isConnected = false;
            this.stopHeartbeat();
        });

        // Listen for online/offline events
        this.socket.on('user:online', (data) => {
            console.log('👤 User came online:', data.user_id);
            this.notifyOnlineStatusChange(data.user_id, true);
        });

        this.socket.on('user:offline', (data) => {
            console.log('👤 User went offline:', data.user_id);
            this.notifyOnlineStatusChange(data.user_id, false);
        });

        // Listen for notifications
        this.socket.on('notification:new', (data) => {
            console.log('🔔 New notification:', data);
            // Trigger notification display
            if (window.notificationService) {
                window.notificationService.handleIncomingNotification(data);
            }
        });

        // Listen for feed updates
        this.socket.on('feed:new_post', (data) => {
            console.log('📰 New post in feed:', data);
            // Trigger feed refresh
            window.dispatchEvent(new CustomEvent('feed:refresh'));
        });

        // Listen for call events
        this.socket.on('call:incoming', (data) => {
            console.log('📞 Incoming call:', data);
            window.dispatchEvent(new CustomEvent('call:incoming', { detail: data }));
        });

        this.socket.on('call:ended', (data) => {
            console.log('📞 Call ended:', data);
            window.dispatchEvent(new CustomEvent('call:ended', { detail: data }));
        });
    }

    disconnect() {
        if (this.socket) {
            this.stopHeartbeat();
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.userId = null;
        }
    }

    startHeartbeat() {
        // Send heartbeat every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.isConnected && this.userId) {
                this.socket.emit('user:heartbeat', { user_id: this.userId });
            }
        }, 30000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // Subscribe to online status changes
    onOnlineStatusChange(callback) {
        this.onlineStatusCallbacks.push(callback);
    }

    notifyOnlineStatusChange(userId, isOnline) {
        this.onlineStatusCallbacks.forEach(callback => {
            try {
                callback(userId, isOnline);
            } catch (err) {
                console.error('Error in online status callback:', err);
            }
        });
    }

    // Join a room (for DMs, etc.)
    joinRoom(roomId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('join', { room: roomId });
        }
    }
}

export default new SocketService();
