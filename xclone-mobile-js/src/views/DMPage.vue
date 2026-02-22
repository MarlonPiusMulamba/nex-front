
<template>
  <ion-page>
    <!-- Main Conversations List View -->
    <ion-header v-if="!selectedChat" class="ion-no-border">
      <ion-toolbar>
        <ion-title>Messages</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="showSearchModal = true">
            <ion-icon :icon="search"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      
      <!-- Search Bar -->
      <ion-toolbar>
        <ion-searchbar 
          v-model="searchQuery"
          placeholder="Search conversations"
          @ionInput="filterConversations"
          :animated="true">
        </ion-searchbar>
      </ion-toolbar>
    </ion-header>

    <!-- Chat View Header -->
    <ion-header v-else class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="closeChat">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title class="chat-header">
          <div class="chat-header-content">
            <img :src="getImageUrl(selectedChat.profile_pic)" class="header-avatar" alt="Avatar" />
            <div class="header-info">
              <div class="header-username">{{ selectedChat.username }}</div>
              <div class="header-status">{{ selectedChat.online ? 'Online' : 'Offline' }}</div>
            </div>
          </div>
        </ion-title>
        <ion-buttons slot="end">
          <ion-button @click="startCall('voice')">
            <ion-icon :icon="call"></ion-icon>
          </ion-button>
          <ion-button @click="startCall('video')">
            <ion-icon :icon="videocam"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <!-- Pull to refresh for conversations -->
      <ion-refresher v-if="!selectedChat" slot="fixed" @ionRefresh="refreshConversations($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Conversations List -->
      <div v-if="!selectedChat" class="conversations-list">
        <!-- Loading State -->
        <div v-if="isLoading" class="loading-container">
          <ion-spinner></ion-spinner>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredConversations.length === 0" class="empty-state">
          <ion-icon :icon="chatbubbles" class="empty-icon"></ion-icon>
          <h3>No messages yet</h3>
          <p>Start a conversation by searching for users</p>
          <ion-button @click="showSearchModal = true" fill="solid" class="gold-btn">
            <ion-icon :icon="search" slot="start"></ion-icon>
            Find Users
          </ion-button>
        </div>

        <!-- Conversation Items -->
        <div 
          v-for="conv in filteredConversations" 
          :key="conv.user_id"
          class="conversation-item"
          @click="openChat(conv)">
          <div class="conv-avatar-container">
            <img :src="getImageUrl(conv.profile_pic)" class="conv-avatar" alt="Avatar" />
            <div v-if="conv.online" class="online-indicator"></div>
          </div>
          <div class="conv-content">
            <div class="conv-header">
              <span class="conv-username">{{ conv.username }}</span>
              <span class="conv-time">{{ formatTime(conv.last_message_time) }}</span>
            </div>
            <div class="conv-preview">
              <ion-icon 
                v-if="conv.last_message_sent_by_me" 
                :icon="conv.last_message_read ? checkmarkDone : checkmark"
                :class="['read-receipt', { 'read': conv.last_message_read }]">
              </ion-icon>
              <span :class="{ 'unread-text': conv.unread_count > 0 }">
                {{ conv.last_message || 'No messages yet' }}
              </span>
            </div>
          </div>
          <div v-if="conv.unread_count > 0" class="unread-badge">
            {{ conv.unread_count }}
          </div>
        </div>
      </div>

      <!-- Chat Messages View -->
      <div v-else class="chat-container" ref="chatContainer">
        <!-- Animated ambient background -->
        <div class="chat-ambient">
          <div class="ambient-orb orb-1"></div>
          <div class="ambient-orb orb-2"></div>
          <div class="ambient-orb orb-3"></div>
        </div>

        <div v-if="loadingMessages" class="loading-container nexfi-loading">
          <div class="loading-ring"></div>
        </div>
        
        <div v-else class="chat-messages">
          <!-- Date Separator -->
          <div class="date-separator" v-if="messages.length > 0">
            <span>{{ formatChatDate(messages[0]?.timestamp) }}</span>
          </div>

          <!-- Messages -->
          <div 
            v-for="msg in messages" 
            :key="msg.id"
            :class="['msg-row', msg.sent_by_me ? 'sent' : 'received']">

            <!-- Mood badge -->
            <div v-if="msg.mood" class="mood-label" :class="'mood-' + msg.mood">
              {{ moodMap[msg.mood]?.icon }} {{ moodMap[msg.mood]?.label }}
            </div>

            <div class="msg-card" :class="[
              msg.sent_by_me ? 'sent-card' : 'received-card',
              msg.mood ? 'mood-card mood-card--' + msg.mood : ''
            ]">
              <img v-if="msg.image" :src="getImageUrl(msg.image)" class="message-image" alt="Image" />
              
              <!-- Voice Note Player -->
              <div v-if="msg.voice" class="voice-player">
                <button class="voice-play-btn" @click="toggleVoicePlayback(msg)">
                  <span v-if="playingAudioId === msg.id">â¸</span>
                  <span v-else>â–¶</span>
                </button>
                <div class="voice-waveform">
                  <div 
                    v-for="n in 18" 
                    :key="n"
                    class="wave-bar"
                    :class="{ 'active': playingAudioId === msg.id && (n / 18) * 100 < getAudioProgress(msg.id) }"
                    :style="{ height: (Math.sin(n * 0.8) * 10 + 14) + 'px' }">
                  </div>
                </div>
                <span class="voice-duration">{{ formatDuration(getAudioDuration(msg.id)) }}</span>
              </div>

              <div v-if="msg.text" class="msg-text" v-html="formatPostContent(msg.text)" @click="onPostTextClick($event)"></div>
              <div class="msg-meta">
                <span class="msg-time">{{ formatMessageTime(msg.timestamp) }}</span>
                
                <!-- LAN/Sync Status -->
                <span v-if="msg.sent_by_me" class="msg-status-icon" :title="msg.status">
                  <span v-if="msg.status === 'local'" class="status-local">âŒ§</span>
                  <span v-else-if="msg.status === 'delivered'" class="status-delivered">ðŸ¤</span>
                  <span v-else class="msg-read" :class="{ 'seen': msg.read }">{{ msg.read ? 'âœ“âœ“' : 'âœ“' }}</span>
                </span>
              </div>
            </div>
          </div>

          <!-- Typing indicator -->
          <div v-if="partnerTyping" class="typing-row">
            <div class="typing-card">
              <span class="typing-label">crafting a thought</span>
              <div class="typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Message Input -->
      <div v-if="selectedChat" class="nexfi-input-area">
        <!-- Mood Picker -->
        <transition name="mood-fade">
          <div v-if="showMoodPicker" class="mood-picker">
            <button 
              v-for="(mood, key) in moodMap" 
              :key="key"
              class="mood-option"
              :class="{ 'selected': selectedMood === key }"
              @click="selectMood(key)">
              {{ mood.icon }}
              <span>{{ mood.label }}</span>
            </button>
          </div>
        </transition>

        <!-- Image preview strip -->
        <div v-if="imagePreview" class="image-preview-strip">
          <img :src="imagePreview" class="preview-thumb" />
          <button class="remove-preview" @click="imagePreview = null">âœ•</button>
        </div>

        <div class="input-bar">
          <button class="input-action-btn" @click="attachImage">
            <ion-icon :icon="add"></ion-icon>
          </button>

          <button 
            class="input-action-btn mood-trigger"
            :class="{ 'mood-active': selectedMood }"
            @click="showMoodPicker = !showMoodPicker"
            :title="selectedMood ? moodMap[selectedMood]?.label : 'Set mood'">
            <span v-if="selectedMood">{{ moodMap[selectedMood]?.icon }}</span>
            <span v-else>ðŸŽ­</span>
          </button>

          <div class="textarea-wrap">
            <ion-textarea
              v-model="messageText"
              :placeholder="inputPlaceholder"
              :auto-grow="true"
              :rows="1"
              class="nexfi-textarea"
              @ionInput="onTyping">
            </ion-textarea>
          </div>

          <button class="input-action-btn emoji-btn" @click="toggleEmojiPicker">
            <ion-icon :icon="happy"></ion-icon>
          </button>
          <EmojiPicker v-if="showEmojiPicker" @select="addEmoji" class="dm-emoji-picker" />

          <button 
            v-if="messageText.trim() || imagePreview"
            class="send-fab"
            @click="sendMessage"
            :disabled="isSending">
            <ion-spinner v-if="isSending" name="crescent"></ion-spinner>
            <ion-icon v-else :icon="send"></ion-icon>
          </button>
          <button 
            v-else
            class="mic-fab"
            :class="{ 'recording': isRecording }"
            @touchstart.prevent="startRecording"
            @touchend.prevent="stopRecording"
            @mousedown="startRecording"
            @mouseup="stopRecording">
            <ion-icon :icon="mic"></ion-icon>
            <div v-if="isRecording" class="mic-pulse"></div>
          </button>
        </div>

        <!-- Recording Bar -->
        <transition name="slide-up">
          <div v-if="isRecording" class="recording-bar">
            <button class="rec-cancel" @click.stop="cancelRecording">âœ• Cancel</button>
            <div class="rec-status">
              <span class="rec-dot"></span>
              <span class="rec-timer">{{ formatDuration(recordingDuration) }}</span>
            </div>
            <div class="rec-wave">
              <span v-for="n in 8" :key="n" class="rec-wave-bar" :style="{ animationDelay: (n * 0.1) + 's' }"></span>
            </div>
          </div>
        </transition>
      </div>
    </ion-content>

    <!-- Search Users Modal -->
    <ion-modal :is-open="showSearchModal" @did-dismiss="closeSearchModal">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button @click="closeSearchModal">Cancel</ion-button>
          </ion-buttons>
          <ion-title>New Message</ion-title>
        </ion-toolbar>
        <ion-toolbar>
          <ion-searchbar 
            v-model="userSearchQuery"
            placeholder="Search by username"
            @ionInput="searchUsers"
            :debounce="300">
          </ion-searchbar>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <div v-if="searchingUsers" class="loading-container">
          <ion-spinner></ion-spinner>
        </div>
        
        <div v-else-if="searchResults.length === 0 && userSearchQuery.length >= 2" class="empty-search">
          <p>No users found matching "{{ userSearchQuery }}"</p>
        </div>

        <div 
          v-for="user in searchResults" 
          :key="user.user_id"
          class="search-result-item"
          @click="startNewChat(user)">
          <img :src="getImageUrl(user.profile_pic)" class="result-avatar" alt="Avatar" />
          <div class="result-info">
            <div class="result-username">{{ user.full_name || user.username }}</div>
            <div class="result-handle">@{{ user.username }}</div>
          </div>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Hidden file input for images -->
  <input 
    type="file" 
    ref="fileInput"
    accept="image/*"
    style="display: none"
    @change="onImageSelect"
  />

  </ion-page>
</template>

<script>

import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
  IonButtons, IonIcon, IonSearchbar, IonModal, IonTextarea, IonSpinner,
  IonRefresher, IonRefresherContent
} from '@ionic/vue';
import { 
  search, arrowBack, send, mic, add, call, videocam, chatbubbles,
  checkmark, checkmarkDone, happy
} from 'ionicons/icons';
import api from '@/utils/api.js';
import EmojiPicker from '@/components/EmojiPicker.vue';
import { 
  saveConversationsOffline, getOfflineConversations, 
  saveMessagesOffline, getOfflineMessages, isNetworkOffline,
  saveLocalMessage
} from '@/utils/offlineDb.js';
import { 
  stop, trash, play, pause
} from 'ionicons/icons';
import lanService from '@/utils/lanService.js';
import { startSyncWatcher } from '@/utils/syncService.js';
import { v4 as uuidv4 } from 'uuid';

export default {
  name: 'DMPage',
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
    IonButtons, IonIcon, IonSearchbar, IonModal, IonTextarea, IonSpinner,
    IonRefresher, IonRefresherContent,
    EmojiPicker
  },
  data() {
    return {
      userId: localStorage.getItem('userId') || null,
      conversations: [],
      filteredConversations: [],
      selectedChat: null,
      messages: [],
      messageText: '',
      imagePreview: null,
      searchQuery: '',
      userSearchQuery: '',
      searchResults: [],
      showSearchModal: false,
      isLoading: false,
      loadingMessages: false,
      searchingUsers: false,
      isSending: false,
      showEmojiPicker: false,
      search, arrowBack, send, mic, add, call, videocam, chatbubbles,
      checkmark, checkmarkDone, happy,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E',
      _socketNewMessageHandler: null,
      // Voice Recording State
      isRecording: false,
      mediaRecorder: null,
      audioChunks: [],
      recordingDuration: 0,
      recordingTimer: null,
      stop, trash, play, pause,
      playingAudioId: null,
      audioElements: {},
      // Mood System
      selectedMood: null,
      showMoodPicker: false,
      moodMap: {
        bold:    { icon: 'ðŸ”¥', label: 'Bold',    glow: '#ff6b35' },
        deep:    { icon: 'ðŸ§ ', label: 'Deep',    glow: '#6c63ff' },
        casual:  { icon: 'ðŸ’¬', label: 'Casual',  glow: '#00c9a7' },
        serious: { icon: 'ðŸŽ¯', label: 'Serious', glow: '#daa520' },
      },
      // Typing indicator
      partnerTyping: false,
      typingTimeout: null,
      typingEmitTimeout: null,
    };
  },
  computed: {
    inputPlaceholder() {
      if (this.selectedMood) {
        const m = this.moodMap[this.selectedMood];
        return `${m.icon}  Drop a ${m.label.toLowerCase()} thought...`;
      }
      return 'Speak freely...';
    }
  },
  methods: {
    getImageUrl(imageData) {
      if (!imageData || imageData === '') return this.defaultAvatar;
      if (typeof imageData !== 'string') return this.defaultAvatar;
      if (imageData.startsWith('http')) return imageData;
      if (imageData.startsWith('data:image')) return imageData;
      if (imageData.startsWith('/static/')) return `${api.defaults.baseURL}${imageData}`;
      return `data:image/png;base64,${imageData}`;
    },

    formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    },

    formatChatDate(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
    },

    formatMessageTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    },

    filterConversations() {
      if (!this.searchQuery) {
        this.filteredConversations = this.conversations;
        return;
      }
      const query = this.searchQuery.toLowerCase();
      this.filteredConversations = this.conversations.filter(conv =>
        conv.username.toLowerCase().includes(query) ||
        conv.last_message?.toLowerCase().includes(query)
      );
    },

    async searchUsers() {
      const rawQuery = (this.userSearchQuery || '').trim();

      // Require at least 2 non-space characters before hitting the API
      if (!rawQuery || rawQuery.length < 2) {
        this.searchResults = [];
        return;
      }

      try {
        this.searchingUsers = true;
        console.log('ðŸ“¡ Searching users with query:', rawQuery);
        const res = await api.get('/api/search/users', {
          params: { 
            q: rawQuery,
            limit: 20,
            user_id: this.userId
          }
        });
        
        // Defensive: Handle both res.users and res.data.users
        // API wrapper returns response.data directly, but structure may vary
        const users = res.users || res.data?.users || res?.data || [];
        this.searchResults = Array.isArray(users) ? users : [];
        
        console.log(`âœ… Search results: ${this.searchResults.length} users`, res);
      } catch (err) {
        console.error('âŒ Search error:', err);
        console.error('Error response:', err.response?.data);
        this.searchResults = [];
      } finally {
        this.searchingUsers = false;
      }
    },

    startNewChat(user) {
      console.log('Starting chat with:', user.username);
      this.closeSearchModal();
      
      // Check if conversation already exists
      const existing = this.conversations.find(c => c.user_id === user.user_id);
      if (existing) {
        this.openChat(existing);
      } else {
        // Create new conversation placeholder
        const newConv = {
          user_id: user.user_id,
          username: user.username,
          profile_pic: user.profile_pic,
          last_message: '',
          last_message_time: new Date().toISOString(),
          unread_count: 0,
          online: false,
          last_message_sent_by_me: false,
          last_message_read: false
        };
        this.conversations.unshift(newConv);
        this.filteredConversations = [...this.conversations];
        this.openChat(newConv);
      }
    },

    openChat(conversation) {
      console.log('Opening chat with:', conversation.username);
      this.selectedChat = conversation;
      this.loadMessages(conversation.user_id);
      this.checkUserOnlineStatus(conversation.user_id);
      
      // Connect to peer via LAN/WebRTC
      if (this.userId && conversation.user_id) {
        lanService.connectToPeer(conversation.user_id);
      }

      // Mark as read
      if (conversation.unread_count > 0) {
        this.markAsRead(conversation.user_id);
        conversation.unread_count = 0;
      }
    },

    closeChat() {
      console.log('Closing chat');
      this.selectedChat = null;
      this.messages = [];
      this.messageText = '';
      this.imagePreview = null;
      this.showEmojiPicker = false;
      
      // Reload conversations to get updated list
      this.loadConversations();
      window.dispatchEvent(new Event('dm-refresh'));
    },

    toggleEmojiPicker() {
      this.showEmojiPicker = !this.showEmojiPicker;
    },

    addEmoji(emoji) {
      this.messageText += emoji;
    },

    async loadMessages(otherUserId) {
      try {
        this.loadingMessages = true;
        console.log(`ðŸ“¡ Loading messages with user ${otherUserId}`);
        
        // Handle offline
        if (isNetworkOffline()) {
          console.log('ðŸ“¡ OFFLINE: Loading messages from IndexedDB');
          const cachedMessages = await getOfflineMessages(this.userId, otherUserId);
          if (cachedMessages) {
            this.messages = cachedMessages;
            this.$nextTick(() => this.scrollToBottom());
            return;
          }
        }

        const res = await api.get(`/api/messages/${otherUserId}`, {
          params: { user_id: this.userId }
        });
        
        this.messages = res.messages || [];
        console.log(`âœ… Loaded ${this.messages.length} messages`);
        
        // Save to offline DB
        if (this.messages.length > 0) {
          // Normalize messages for display if they don't have a status
          this.messages = this.messages.map(m => ({
            ...m,
            status: m.status || 'synced'
          }));
          await saveMessagesOffline(this.messages);
        }

        window.dispatchEvent(new Event('dm-refresh'));
        
        this.$nextTick(() => {
          this.scrollToBottom();
        });
      } catch (err) {
        console.error('âŒ Load messages error:', err);
        // Fallback to offline on error
        const cachedMessages = await getOfflineMessages(this.userId, otherUserId);
        if (cachedMessages) {
          this.messages = cachedMessages;
        } else {
          this.messages = [];
        }
      } finally {
        this.loadingMessages = false;
      }
    },

    async sendMessage() {
      if ((!this.messageText.trim() && !this.imagePreview) || this.isSending) return;

      const messageTextToSend = this.messageText.trim();
      const imageToSend = this.imagePreview;
      const moodToSend = this.selectedMood;
      const localId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      try {
        this.isSending = true;
        
        // Construct the local message object
        const newMessage = {
          id: localId,
          from_user_id: this.userId,
          to_user_id: this.selectedChat.user_id,
          text: messageTextToSend,
          image: imageToSend || '',
          mood: moodToSend || null,
          timestamp: timestamp,
          read: false,
          sent_by_me: true,
          status: 'local'
        };

        // 1. Optimistic UI update
        this.messages.push(newMessage);
        this.messageText = '';
        this.imagePreview = null;
        this.selectedMood = null;
        this.$nextTick(() => this.scrollToBottom());

        // 2. Persistent Local Storage
        await saveLocalMessage(newMessage);

        // 3. P2P LAN Dispatch (Primary)
        let sentViaLan = false;
        if (lanService.isPeerReachable(this.selectedChat.user_id)) {
          console.log('[LAN] Dispatching P2P to', this.selectedChat.user_id);
          sentViaLan = lanService.sendMessage(this.selectedChat.user_id, {
            local_id: localId,
            from_user_id: this.userId,
            to_user_id: this.selectedChat.user_id,
            text: messageTextToSend,
            image: imageToSend,
            mood: moodToSend,
            timestamp: timestamp
          });
          
          if (sentViaLan) {
            // Update local state to 'delivered'
            newMessage.status = 'delivered';
            await saveLocalMessage(newMessage); // Update in IndexedDB
          }
        }

        // 4. API Dispatch (Fallback or Parallel)
        // If we are online, we always send to API too (for broad persistence)
        // If offline, the syncService will handle it later.
        if (!isNetworkOffline()) {
          try {
            const res = await api.post('/api/messages/send', {
              from_user_id: this.userId,
              to_user_id: this.selectedChat.user_id,
              text: messageTextToSend,
              image: imageToSend || null,
              mood: moodToSend || null,
              local_id: localId // Backend uses this to avoid duplicates
            });

            if (res.success) {
              newMessage.status = 'synced';
              newMessage.server_id = res.message_id;
              await saveLocalMessage(newMessage);
            }
          } catch (apiErr) {
            console.warn('[DM] API send failed, relying on LAN/Sync', apiErr);
          }
        }

        window.dispatchEvent(new Event('dm-refresh'));
        
        // Update conversation preview
        const conv = this.conversations.find(c => String(c.user_id) === String(this.selectedChat.user_id));
        if (conv) {
          conv.last_message = messageTextToSend || 'ðŸ“· Photo';
          conv.last_message_time = timestamp;
          conv.last_message_sent_by_me = true;
          conv.last_message_read = false;
        }

      } catch (err) {
        console.error('Send message error:', err);
      } finally {
        this.isSending = false;
      }
    },

    async startRecording() {
      if (this.isRecording) return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];
        
        this.mediaRecorder.ondataavailable = (event) => {
          this.audioChunks.push(event.data);
        };
        
        this.mediaRecorder.onstop = async () => {
          if (this.audioChunks.length === 0) return;
          
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result;
            this.sendVoiceNote(base64Audio);
          };
          reader.readAsDataURL(audioBlob);
          
          // Stop all tracks in the stream
          stream.getTracks().forEach(track => track.stop());
        };
        
        this.mediaRecorder.start();
        this.isRecording = true;
        this.recordingDuration = 0;
        this.recordingTimer = setInterval(() => {
          this.recordingDuration++;
        }, 1000);
        
        console.log('ðŸŽ™ï¸ Recording started');
      } catch (err) {
        console.error('âŒ Error starting recording:', err);
        alert('Could not access microphone. Please ensure permissions are granted.');
      }
    },

    stopRecording() {
      if (!this.isRecording) return;
      
      this.isRecording = false;
      clearInterval(this.recordingTimer);
      
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      console.log('ðŸŽ™ï¸ Recording stopped');
    },

    cancelRecording() {
      if (!this.isRecording) return;
      
      this.isRecording = false;
      clearInterval(this.recordingTimer);
      
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = null; // Prevent sending on cancel
        this.mediaRecorder.stop();
        // Stop tracks
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
      
      this.audioChunks = [];
      console.log('ðŸŽ™ï¸ Recording cancelled');
    },

    async sendVoiceNote(base64Audio) {
      if (this.isSending) return;
      
      try {
        this.isSending = true;
        console.log('ðŸ“¤ Sending voice note...');
        
        const res = await api.post('/api/messages/send', {
          from_user_id: this.userId,
          to_user_id: this.selectedChat.user_id,
          text: '',
          voice: base64Audio
        });

        if (res.success) {
          console.log('âœ… Voice note sent');
          await this.loadMessages(this.selectedChat.user_id);
          window.dispatchEvent(new Event('dm-refresh'));
          
          const conv = this.conversations.find(c => c.user_id === this.selectedChat.user_id);
          if (conv) {
            conv.last_message = 'ðŸŽ¤ Voice note';
            conv.last_message_time = new Date().toISOString();
            conv.last_message_sent_by_me = true;
            conv.last_message_read = false;
          }
        }
      } catch (err) {
        console.error('âŒ Error sending voice note:', err);
      } finally {
        this.isSending = false;
      }
    },

    formatDuration(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    toggleVoicePlayback(msg) {
      if (this.playingAudioId === msg.id) {
        this.audioElements[msg.id].pause();
        this.playingAudioId = null;
        return;
      }
      
      // Stop currently playing
      if (this.playingAudioId && this.audioElements[this.playingAudioId]) {
        this.audioElements[this.playingAudioId].pause();
      }
      
      if (!this.audioElements[msg.id]) {
        const audio = new Audio(this.getImageUrl(msg.voice));
        audio.onended = () => {
          this.playingAudioId = null;
        };
        audio.ontimeupdate = () => {
          this.$forceUpdate();
        };
        this.audioElements[msg.id] = audio;
      }
      
      this.playingAudioId = msg.id;
      this.audioElements[msg.id].play();
    },

    getAudioProgress(msgId) {
      const audio = this.audioElements[msgId];
      if (!audio || !audio.duration) return 0;
      return (audio.currentTime / audio.duration) * 100;
    },

    getAudioDuration(msgId) {
      const audio = this.audioElements[msgId];
      if (!audio || isNaN(audio.duration)) return 0;
      return Math.ceil(audio.duration);
    },

    selectMood(key) {
      this.selectedMood = this.selectedMood === key ? null : key;
      this.showMoodPicker = false;
    },

    onTyping() {
      // Emit typing event via socket
      if (!this.selectedChat) return;
      try {
        const socket = this.$socket;
        if (socket) {
          if (this.typingEmitTimeout) clearTimeout(this.typingEmitTimeout);
          socket.emit('dm:typing', {
            from_user_id: this.userId,
            to_user_id: this.selectedChat.user_id
          });
          // Stop typing after 3s of silence
          this.typingEmitTimeout = setTimeout(() => {
            socket.emit('dm:stop_typing', {
              from_user_id: this.userId,
              to_user_id: this.selectedChat.user_id
            });
          }, 3000);
        }
      } catch (_) {}
    },

    async markAsRead(otherUserId) {
      try {
        await api.post('/api/messages/mark_read', {
          user_id: this.userId,
          other_user_id: otherUserId
        });
        console.log('âœ… Messages marked as read');
        window.dispatchEvent(new Event('dm-refresh'));
      } catch (err) {
        console.error('âŒ Mark read error:', err);
      }
    },

    attachImage() {
      this.$refs.fileInput.click();
    },

    onImageSelect(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      if (file.size > 50 * 1024 * 1024) {
        alert('Image must be less than 50MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        // Send full dataUrl for better backend detection
        this.imagePreview = ev.target.result;
      };
      reader.readAsDataURL(file);
    },

    scrollToBottom() {
      if (this.$refs.chatContainer) {
        setTimeout(() => {
          this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight;
        }, 100);
      }
    },

    async loadConversations() {
      try {
        this.isLoading = true;
        console.log('ðŸ“¡ Loading conversations for user:', this.userId);
        
        // Handle offline
        if (isNetworkOffline()) {
           console.log('ðŸ“¡ OFFLINE: Loading conversations from IndexedDB');
           const cachedConv = await getOfflineConversations();
           if (cachedConv && cachedConv.length > 0) {
             this.conversations = cachedConv;
             this.filteredConversations = [...this.conversations];
             return;
           }
        }

        const res = await api.get('/api/conversations', {
          params: { user_id: this.userId }
        });
        
        this.conversations = res.conversations || [];
        this.filteredConversations = [...this.conversations];
        console.log(`âœ… Loaded ${this.conversations.length} conversations`);

        // Save to offline DB
        if (this.conversations.length > 0) {
          await saveConversationsOffline(this.conversations);
        }

        window.dispatchEvent(new Event('dm-refresh'));
      } catch (err) {
        console.error('âŒ Load conversations error:', err);
        // Fallback to offline on error
        const cachedConv = await getOfflineConversations();
        if (cachedConv) {
          this.conversations = cachedConv;
          this.filteredConversations = [...this.conversations];
        } else {
          this.conversations = [];
          this.filteredConversations = [];
        }
      } finally {
        this.isLoading = false;
      }
    },

    async refreshConversations(event) {
      await this.loadConversations();
      if (event) event.target.complete();
    },

    closeSearchModal() {
      this.showSearchModal = false;
      this.userSearchQuery = '';
      this.searchResults = [];
    },

    async startCall(media) {
      if (!this.selectedChat) return;
      window.dispatchEvent(new CustomEvent('start-call', {
        detail: {
          media,
          user: {
            user_id: this.selectedChat.user_id,
            username: this.selectedChat.username,
            profile_pic: this.selectedChat.profile_pic,
            full_name: (this.selectedChat.first_name || this.selectedChat.last_name) ? (this.selectedChat.first_name + ' ' + this.selectedChat.last_name).trim() : this.selectedChat.username
          }
        }
      }));
    },

    formatPostContent(text) {
      if (!text) return '';

      const escapeHtml = (str) =>
        str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const urlRegex = /^(https?:\/\/[\S]+|www\.[\S]+|[a-z0-9-]+\.[a-z0-9.-]+\.[a-z]{2,}(\/[\S]*)?)$/i;
      const parts = text.split(/(\s+)/);

      return parts
        .map((part) => {
          if (/\s+/.test(part)) return part;

          const escaped = escapeHtml(part);

          if (urlRegex.test(part) && !part.startsWith('@') && !part.startsWith('#')) {
            const href = part.startsWith('http') ? part : `https://${part}`;
            return `<a href="${href}" class="post-link" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
          }

          if (part.startsWith('#') && part.length > 1) {
            return `<span class="hashtag" data-hashtag="${escaped}" style="color:#daa520;">${escaped}</span>`;
          }

          if (part.startsWith('@') && part.length > 1) {
            const username = escaped.slice(1);
            return `<span class="mention" data-mention="${username}" style="color:#daa520;">${escaped}</span>`;
          }

          return escaped;
        })
        .join('');
    },

    onPostTextClick(event) {
      const target = event.target;

      if (target.classList.contains('mention') && target.dataset.mention) {
        const username = target.dataset.mention;
        this.closeChat();
        this.$router.push(`/tabs/profile/${username}`);
        return;
      }

      if (target.classList.contains('hashtag')) {
        const tag = target.dataset.hashtag?.replace('#', '') || '';
        this.closeChat();
        this.$router.push({ path: '/tabs/follow', query: { q: `#${tag}` } });
        return;
      }
    },

    // AV Calling moved to global CallOverlay.vue

    autoOpenFromQuery() {
      const q = this.$route && this.$route.query ? this.$route.query : {};
      const qUserId = q.userId ? String(q.userId) : null;
      const qUsername = q.username || null;
      if (!qUserId && !qUsername) return;
      let conv = null;
      if (qUserId) {
        conv = this.conversations.find(c => String(c.user_id) === qUserId);
      }
      if (!conv && qUsername) {
        conv = this.conversations.find(c => c.username === qUsername);
      }
      if (!conv && (qUserId || qUsername)) {
        const user_id = qUserId ? Number(qUserId) : null;
        conv = {
          user_id: user_id,
          username: qUsername || 'User',
          profile_pic: '',
          last_message: '',
          last_message_time: new Date().toISOString(),
          unread_count: 0,
          online: false,
          last_message_sent_by_me: false,
          last_message_read: false
        };
        this.conversations.unshift(conv);
        this.filteredConversations = [...this.conversations];
      }
      if (conv) this.openChat(conv);
    },

    updateUserStatus(userId, isOnline) {
      const uid = String(userId);
      const conv = this.conversations.find(c => String(c.user_id) === uid);
      if (conv) conv.online = isOnline;
      if (this.selectedChat && String(this.selectedChat.user_id) === uid) {
        this.selectedChat.online = isOnline;
      }
    },

    async checkUserOnlineStatus(userId) {
      try {
        const res = await api.post('/api/users/online-status', { user_ids: [userId] });
        if (res.success && res.statuses) {
          const status = res.statuses[String(userId)];
          if (status) {
            this.updateUserStatus(userId, status.online);
          }
        }
      } catch (err) {
        console.error('Check online status failed:', err);
      }
    },
  },

  mounted() {
    if (!this.userId) {
      console.error('âŒ No userId found in localStorage!');
      this.$router.push('/login');
      return;
    }
    console.log('âœ… DMPage mounted, userId:', this.userId);
    console.log('âœ… User type:', typeof this.userId);

    // Realtime DM updates via Socket.IO (fallback remains manual refresh/polling)
    try {
      const socket = this.$socket;
      if (socket && typeof socket.on === 'function') {
        // Ensure we're joined (main.js also does this on connect)
        try { socket.emit('join', { user_id: this.userId }); } catch (_) {}

        this._socketNewMessageHandler = async (payload) => {
          try {
            if (!payload) return;
            const toId = payload.to_user_id != null ? String(payload.to_user_id) : null;
            const fromId = payload.from_user_id != null ? String(payload.from_user_id) : null;
            if (!toId || toId !== String(this.userId)) return;

            // If currently chatting with sender, refresh messages immediately.
            if (this.selectedChat && String(this.selectedChat.user_id) === fromId) {
              await this.loadMessages(this.selectedChat.user_id);
            } else {
              // Otherwise refresh conversations/unread badge.
              await this.loadConversations();
              window.dispatchEvent(new Event('dm-refresh'));
            }
          } catch (e) {
            console.error('Socket dm:new_message handler error:', e);
          }
        };

        socket.on('dm:new_message', this._socketNewMessageHandler);

        socket.on('user:online', (data) => {
          if (data && data.user_id) this.updateUserStatus(data.user_id, true);
        });
        socket.on('user:offline', (data) => {
          if (data && data.user_id) this.updateUserStatus(data.user_id, false);
        });

        // Typing indicators
        socket.on('dm:typing', (data) => {
          if (!data) return;
          const fromId = String(data.from_user_id);
          if (this.selectedChat && String(this.selectedChat.user_id) === fromId) {
            this.partnerTyping = true;
            if (this.typingTimeout) clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => { this.partnerTyping = false; }, 4000);
          }
        });
        socket.on('dm:stop_typing', (data) => {
          if (!data) return;
          const fromId = String(data.from_user_id);
          if (this.selectedChat && String(this.selectedChat.user_id) === fromId) {
            this.partnerTyping = false;
          }
        });
      }
    } catch (e) {
      console.error('Socket setup failed:', e);
    }

    this.loadConversations().then(() => {
      this.autoOpenFromQuery();
    });

    // Initialise P2P LAN Service
    if (this.userId && this.$socket) {
      lanService.init(this.$socket, this.userId);
      lanService.onMessage((msg) => {
        // If currently in chat with sender, push message
        if (this.selectedChat && String(this.selectedChat.user_id) === String(msg.from_user_id)) {
          this.messages.push(msg);
          this.$nextTick(() => this.scrollToBottom());
        } else {
          // Otherwise update conversation list
          this.loadConversations();
        }
      });
    }

    // Start Internet Sync Watcher
    startSyncWatcher((syncedCount) => {
      console.log(`[Sync] Triggered refresh after ${syncedCount} items.`);
      if (this.selectedChat) {
        this.loadMessages(this.selectedChat.user_id);
      } else {
        this.loadConversations();
      }
    });
  },
  ionViewDidEnter() {
    console.log('âœ… DMPage ionViewDidEnter');
    this.autoOpenFromQuery();
  },
  watch: {
    '$route.query': {
      handler(newQuery) {
        if (newQuery && (newQuery.userId || newQuery.username)) {
          console.log('ðŸ“¡ Route query changed, auto-opening chat...', newQuery);
          this.autoOpenFromQuery();
        }
      },
      deep: true
    }
  },
  beforeUnmount() {
    try {
      const socket = this.$socket;
      if (socket && this._socketNewMessageHandler) {
        socket.off('dm:new_message', this._socketNewMessageHandler);
        this._socketNewMessageHandler = null;
      }
    } catch (_) {}

    // Nothing call-related to clean up locally anymore
  }
};
</script>

<style scoped>
/* ================================================
   NEXFI DM â€” Premium Chat Design System
   Deep black Â· Gold Â· Floating cards Â· Mood glow
   ================================================ */

/* â”€â”€ Conversation List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.gold-btn {
  --background: linear-gradient(135deg, #daa520 0%, #ffd700 100%);
  --background-activated: #b8860b;
  --color: #000;
  --box-shadow: 0 4px 14px rgba(218,165,32,0.4);
  font-weight: 700;
}

.conversations-list { max-width: 600px; margin: 0 auto; }

.conversation-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  cursor: pointer;
  transition: background 0.18s;
}
.conversation-item:hover { background: rgba(218,165,32,0.06); }

.conv-avatar-container { position: relative; margin-right: 12px; flex-shrink: 0; }
.conv-avatar { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(218,165,32,0.3); }
.online-indicator {
  position: absolute; bottom: 2px; right: 2px;
  width: 11px; height: 11px;
  background: #10b981; border: 2px solid var(--ion-background-color,#111); border-radius: 50%;
}

.conv-content { flex: 1; min-width: 0; }
.conv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
.conv-username { font-weight: 600; font-size: 15px; }
.conv-time { font-size: 11px; color: var(--ion-color-medium, #6b7280); }
.conv-preview {
  display: flex; align-items: center; gap: 4px;
  font-size: 13px; color: var(--ion-color-medium, #6b7280);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.read-receipt { font-size: 14px; color: #6b7280; flex-shrink: 0; }
.read-receipt.read { color: #daa520; }
.unread-text { font-weight: 700; color: var(--ion-text-color,#fff); }
.unread-badge {
  background: linear-gradient(135deg,#daa520,#ffd700);
  color: #000; font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 12px; min-width: 20px; text-align: center;
}

/* â”€â”€ Chat Area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.chat-header-content { display: flex; align-items: center; gap: 10px; }
.header-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(218,165,32,0.4); }
.header-info { display: flex; flex-direction: column; }
.header-username { font-size: 15px; font-weight: 700; line-height: 1.2; }
.header-status { font-size: 11px; color: #10b981; line-height: 1.3; }

.chat-container {
  position: relative;
  height: calc(100vh - 180px);
  overflow-y: auto;
  padding-bottom: 12px;
}

/* â”€â”€ Ambient Orbs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.chat-ambient {
  position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
}
.ambient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.12;
  animation: orbFloat 12s ease-in-out infinite;
}
.orb-1 { width: 260px; height: 260px; background: #daa520; top: 10%; left: -60px; animation-delay: 0s; }
.orb-2 { width: 200px; height: 200px; background: #6c63ff; bottom: 15%; right: -40px; animation-delay: 4s; }
.orb-3 { width: 180px; height: 180px; background: #00c9a7; top: 50%; left: 30%; animation-delay: 8s; }

@keyframes orbFloat {
  0%,100% { transform: translateY(0) scale(1); }
  50%      { transform: translateY(-30px) scale(1.08); }
}

/* â”€â”€ Messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.chat-messages {
  position: relative; z-index: 1;
  padding: 12px 16px 16px;
  max-width: 600px; margin: 0 auto;
}

.date-separator { text-align: center; margin: 14px 0; }
.date-separator span {
  background: rgba(218,165,32,0.12);
  border: 1px solid rgba(218,165,32,0.2);
  padding: 3px 12px; border-radius: 20px;
  font-size: 11px; color: rgba(218,165,32,0.8); letter-spacing: 0.05em;
}

/* â”€â”€ Floating Message Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.msg-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
}
.msg-row.sent  { align-items: flex-end; }
.msg-row.received { align-items: flex-start; }

.mood-label {
  font-size: 10px; letter-spacing: 0.06em;
  font-weight: 700; text-transform: uppercase;
  margin-bottom: 3px; padding: 0 6px; opacity: 0.75;
}
.mood-bold    .mood-label, .mood-label.mood-bold    { color: #ff6b35; }
.mood-deep    .mood-label, .mood-label.mood-deep    { color: #a78bfa; }
.mood-casual  .mood-label, .mood-label.mood-casual  { color: #00c9a7; }
.mood-serious .mood-label, .mood-label.mood-serious { color: #daa520; }

.msg-row.sent  .mood-label { text-align: right; }
.msg-row.received .mood-label { text-align: left; }

.msg-card {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 18px;
  word-wrap: break-word;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  position: relative;
}
.msg-card:active { transform: scale(0.98); }

.sent-card {
  background: linear-gradient(135deg, #daa520 0%, #f0c040 100%);
  color: #1a1000;
  border-bottom-right-radius: 4px;
}
.received-card {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--ion-text-color, #f0f0f0);
  border-bottom-left-radius: 4px;
}

/* Mood-specific card glows */
.mood-card--bold    { box-shadow: 0 4px 24px rgba(255,107,53,0.3); border: 1px solid rgba(255,107,53,0.25); }
.mood-card--deep    { box-shadow: 0 4px 24px rgba(108,99,255,0.35); border: 1px solid rgba(108,99,255,0.25); }
.mood-card--casual  { box-shadow: 0 4px 24px rgba(0,201,167,0.3); border: 1px solid rgba(0,201,167,0.2); }
.mood-card--serious { box-shadow: 0 4px 24px rgba(218,165,32,0.35); border: 1px solid rgba(218,165,32,0.25); }

.message-image {
  width: 100%; max-width: 280px; border-radius: 12px; margin-bottom: 6px; display: block;
}

.msg-text { font-size: 15px; line-height: 1.5; word-wrap: break-word; }
.msg-text :deep(.post-link)  { color: #1a1000; text-decoration: underline dotted; }
.received-card .msg-text :deep(.post-link) { color: #daa520; }
.msg-text :deep(.hashtag),
.msg-text :deep(.mention)    { color: inherit; font-weight: 700; cursor: pointer; opacity: 0.85; }

.msg-meta {
  display: flex; align-items: center; gap: 5px;
  margin-top: 5px; justify-content: flex-end;
}
.msg-time  { font-size: 10px; opacity: 0.55; }
.msg-read  { font-size: 11px; opacity: 0.5; }
.msg-read.seen { opacity: 1; color: #1a1000; }
.received-card .msg-read.seen { color: #daa520; }

/* â”€â”€ Voice Player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.voice-player {
  display: flex; align-items: center; gap: 10px;
  min-width: 180px; padding: 4px 0; margin-bottom: 6px;
}
.voice-play-btn {
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(0,0,0,0.25);
  border: none; cursor: pointer; color: inherit;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; flex-shrink: 0;
  transition: background 0.2s;
}
.voice-play-btn:hover { background: rgba(0,0,0,0.45); }
.voice-waveform {
  flex: 1; display: flex; align-items: center; gap: 2px;
}
.wave-bar {
  width: 3px; border-radius: 2px;
  background: rgba(255,255,255,0.25);
  transition: background 0.2s;
}
.sent-card .wave-bar { background: rgba(0,0,0,0.2); }
.wave-bar.active { background: rgba(0,0,0,0.7); }
.received-card .wave-bar.active { background: #daa520; }
.voice-duration { font-size: 11px; opacity: 0.6; flex-shrink: 0; }

/* â”€â”€ Typing Indicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.typing-row { display: flex; align-items: flex-start; margin-top: 6px; }
.typing-card {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 18px; border-bottom-left-radius: 4px;
  backdrop-filter: blur(8px);
}
.typing-label {
  font-size: 11px; color: rgba(255,255,255,0.45);
  font-style: italic; letter-spacing: 0.03em;
}
.typing-dots { display: flex; gap: 4px; }
.typing-dots span {
  width: 5px; height: 5px; border-radius: 50%;
  background: #daa520;
  animation: dotBounce 1.2s ease-in-out infinite;
}
.typing-dots span:nth-child(2) { animation-delay: 0.15s; }
.typing-dots span:nth-child(3) { animation-delay: 0.3s; }
@keyframes dotBounce {
  0%,80%,100% { transform: translateY(0); opacity: 0.5; }
  40%          { transform: translateY(-5px); opacity: 1; }
}

/* â”€â”€ Loading Ring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.nexfi-loading { display: flex; justify-content: center; padding: 60px; }
.loading-ring {
  width: 38px; height: 38px; border-radius: 50%;
  border: 3px solid rgba(218,165,32,0.15);
  border-top-color: #daa520;
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* â”€â”€ Input Area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.nexfi-input-area {
  position: sticky; bottom: 0; z-index: 100;
  padding: 8px 12px 10px;
  background: rgba(10,10,10,0.9);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(218,165,32,0.15);
}

/* Image preview */
.image-preview-strip {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 4px 8px;
}
.preview-thumb {
  width: 56px; height: 56px; object-fit: cover; border-radius: 10px;
  border: 1.5px solid rgba(218,165,32,0.4);
}
.remove-preview {
  background: rgba(255,255,255,0.1); border: none; color: #fff;
  width: 22px; height: 22px; border-radius: 50%;
  cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;
}

/* Main input row */
.input-bar {
  display: flex; align-items: center; gap: 8px;
  position: relative;
}

.input-action-btn {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.6);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 18px; flex-shrink: 0;
  transition: background 0.2s, color 0.2s;
}
.input-action-btn:hover { background: rgba(218,165,32,0.15); color: #daa520; }
.mood-trigger.mood-active { background: rgba(218,165,32,0.2); border-color: rgba(218,165,32,0.4); }
.emoji-btn { position: relative; }

.dm-emoji-picker {
  position: absolute; bottom: 52px; right: 0;
  z-index: 2000;
}

.textarea-wrap {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 2px 12px;
  min-height: 40px;
  display: flex; align-items: center;
  transition: border-color 0.2s;
}
.textarea-wrap:focus-within { border-color: rgba(218,165,32,0.45); }

.nexfi-textarea {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 4px;
  --padding-bottom: 4px;
  --color: var(--ion-text-color,#f0f0f0);
  --placeholder-color: rgba(255,255,255,0.3);
  font-size: 14.5px;
  max-height: 100px;
}

.send-fab, .mic-fab {
  width: 40px; height: 40px; border-radius: 50%;
  background: linear-gradient(135deg,#daa520,#f0c040);
  border: none; cursor: pointer; color: #1a1000;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
  box-shadow: 0 3px 12px rgba(218,165,32,0.4);
  transition: transform 0.15s, box-shadow 0.15s;
  position: relative;
}
.send-fab:hover, .mic-fab:hover { transform: scale(1.08); box-shadow: 0 5px 18px rgba(218,165,32,0.55); }
.mic-fab.recording { background: linear-gradient(135deg,#eb445a,#ff6b6b); box-shadow: 0 3px 14px rgba(235,68,90,0.5); }
.mic-pulse {
  position: absolute; inset: 0; border-radius: 50%;
  background: rgba(235,68,90,0.35);
  animation: micPulse 1.4s ease-out infinite;
}
@keyframes micPulse {
  0% { transform: scale(1); opacity: 0.7; }
  100%{ transform: scale(1.8); opacity: 0; }
}

/* â”€â”€ Mood Picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.mood-picker {
  display: flex; gap: 8px; flex-wrap: wrap;
  padding: 10px 4px 6px;
}
.mood-option {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 12px; border-radius: 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  cursor: pointer; color: rgba(255,255,255,0.65);
  font-size: 18px; transition: all 0.18s;
}
.mood-option span { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
.mood-option:hover  { background: rgba(218,165,32,0.15); border-color: rgba(218,165,32,0.35); color: #daa520; }
.mood-option.selected { background: rgba(218,165,32,0.2); border-color: #daa520; color: #daa520; }

/* mood transitions */
.mood-fade-enter-active, .mood-fade-leave-active { transition: all 0.22s ease; }
.mood-fade-enter-from, .mood-fade-leave-to { opacity: 0; transform: translateY(8px); }

/* â”€â”€ Recording Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€  */
.recording-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  background: rgba(235,68,90,0.1);
  border: 1px solid rgba(235,68,90,0.25);
  border-radius: 16px;
  margin-top: 8px;
}
.rec-cancel {
  background: none; border: none; color: rgba(255,255,255,0.55);
  cursor: pointer; font-size: 12px; white-space: nowrap;
  padding: 0;
}
.rec-status { display: flex; align-items: center; gap: 8px; flex: 1; justify-content: center; }
.rec-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #eb445a;
  animation: blink 1s infinite;
}
.rec-timer { font-size: 14px; font-weight: 700; color: #eb445a; }
.rec-wave { display: flex; align-items: center; gap: 3px; }
.rec-wave-bar {
  width: 3px; border-radius: 2px;
  background: rgba(235,68,90,0.65);
  animation: waveAnim 0.7s ease-in-out infinite alternate;
}
.rec-wave-bar:nth-child(odd)  { height: 8px; }
.rec-wave-bar:nth-child(even) { height: 16px; }
@keyframes waveAnim {
  from { transform: scaleY(0.5); }
  to   { transform: scaleY(1.4); }
}

/* slide-up transition */
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.22s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(10px); }

/* â”€â”€ Search Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.search-result-item {
  display: flex; align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;
  transition: background 0.15s;
}
.search-result-item:hover { background: rgba(218,165,32,0.06); }
.result-avatar { width: 46px; height: 46px; border-radius: 50%; margin-right: 12px; object-fit: cover; border: 1.5px solid rgba(218,165,32,0.2); }
.result-info { flex: 1; }
.result-username { font-weight: 700; font-size: 15px; }
.result-handle { font-size: 13px; color: var(--ion-color-medium,#6b7280); }

/* â”€â”€ Empty States â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.empty-state { text-align: center; padding: 70px 20px; }
.empty-icon { font-size: 60px; color: rgba(218,165,32,0.4); margin-bottom: 14px; }
.empty-state h3 { font-size: 20px; font-weight: 700; margin: 10px 0; }
.empty-state p { color: var(--ion-color-medium,#6b7280); margin-bottom: 20px; }
.empty-search { padding: 40px 20px; text-align: center; color: var(--ion-color-medium,#6b7280); }
.loading-container { display: flex; justify-content: center; padding: 40px; }

@keyframes blink {
  0%,100% { opacity: 1; }
  50%      { opacity: 0.3; }
}
/* msg status icons */
.msg-status-icon {
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 2px;
}
.status-local {
  color: #eb445a; /* Red for not synced */
  font-weight: bold;
}
.status-delivered {
  color: #10b981; /* Green for delivered via LAN */
  animation: subtlePulse 2s infinite;
}
@keyframes subtlePulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}
</style>