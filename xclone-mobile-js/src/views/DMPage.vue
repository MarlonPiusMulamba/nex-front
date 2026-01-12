
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
          <ion-button @click="showSearchModal = true" fill="solid" color="primary">
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
        <div v-if="loadingMessages" class="loading-container">
          <ion-spinner></ion-spinner>
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
            :class="['message-bubble', msg.sent_by_me ? 'sent' : 'received']">
            <div class="message-content">
              <img v-if="msg.image" :src="getImageUrl(msg.image)" class="message-image" alt="Image" />
              <div v-if="msg.text" class="message-text">{{ msg.text }}</div>
              <div class="message-meta">
                <span class="message-time">{{ formatMessageTime(msg.timestamp) }}</span>
                <ion-icon 
                  v-if="msg.sent_by_me"
                  :icon="msg.read ? checkmarkDone : checkmark"
                  :class="['message-status', { 'read': msg.read }]">
                </ion-icon>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Message Input (Fixed at bottom when chat is open) -->
      <div v-if="selectedChat" class="message-input-container">
        <ion-button fill="clear" size="small" @click="attachImage">
          <ion-icon :icon="add" color="medium"></ion-icon>
        </ion-button>
        
        <div class="input-wrapper">
          <ion-textarea
            v-model="messageText"
            placeholder="Type a message"
            :auto-grow="true"
            :rows="1"
            class="message-textarea"
            @keyup.enter.exact="sendMessage">
          </ion-textarea>

          <div class="emoji-wrapper">
            <ion-button fill="clear" size="small" @click="toggleEmojiPicker" class="emoji-trigger">
              <ion-icon :icon="happy" color="medium"></ion-icon>
            </ion-button>
            <EmojiPicker v-if="showEmojiPicker" @select="addEmoji" class="dm-emoji-picker" />
          </div>
          
          <ion-button 
            v-if="messageText.trim() || imagePreview"
            fill="clear" 
            size="small"
            @click="sendMessage"
            :disabled="isSending"
            class="send-btn">
            <ion-spinner v-if="isSending" name="crescent"></ion-spinner>
            <ion-icon v-else :icon="send" color="primary"></ion-icon>
          </ion-button>
          <ion-button v-else fill="clear" size="small">
            <ion-icon :icon="mic" color="medium"></ion-icon>
          </ion-button>
        </div>
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
            <div class="result-username">{{ user.username }}</div>
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
import axios from 'axios';
import config from '@/config/index.js';
import EmojiPicker from '@/components/EmojiPicker.vue';

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
      API_URL: config.api.baseURL,
      searchingUsers: false,
      isSending: false,
      showEmojiPicker: false,
      search, arrowBack, send, mic, add, call, videocam, chatbubbles,
      checkmark, checkmarkDone, happy,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E',
      _socketNewMessageHandler: null
    };
  },
  methods: {
    getImageUrl(imageData) {
      if (!imageData || imageData === '') return this.defaultAvatar;
      if (typeof imageData !== 'string') return this.defaultAvatar;
      if (imageData.startsWith('http')) return imageData;
      if (imageData.startsWith('data:image')) return imageData;
      if (imageData.startsWith('/static/')) return `${this.API_URL}${imageData}`;
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
        const res = await axios.get(`${this.API_URL}/api/search/users`, {
          params: { 
            q: rawQuery,
            limit: 20,
            user_id: this.userId  // let backend exclude current user & tune caching
          }
        });
        
        // Backend already excludes current user; just ensure we have an array
        this.searchResults = Array.isArray(res.data.users) ? res.data.users : [];
        console.log(`Found ${this.searchResults.length} users`);
      } catch (err) {
        console.error('Search error:', err);
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
        console.log(`Loading messages with user ${otherUserId}`);
        
        const res = await axios.get(`${this.API_URL}/api/messages/${otherUserId}`, {
          params: { user_id: this.userId }
        });
        
        this.messages = res.data.messages || [];
        console.log(`Loaded ${this.messages.length} messages`);
        window.dispatchEvent(new Event('dm-refresh'));
        
        this.$nextTick(() => {
          this.scrollToBottom();
        });
      } catch (err) {
        console.error('Load messages error:', err);
        this.messages = [];
      } finally {
        this.loadingMessages = false;
      }
    },

    async sendMessage() {
      if ((!this.messageText.trim() && !this.imagePreview) || this.isSending) return;

      const messageTextToSend = this.messageText.trim();
      const imageToSend = this.imagePreview;

      try {
        this.isSending = true;
        console.log('Sending message to:', this.selectedChat.username);
        console.log('Payload:', {
          from_user_id: this.userId,
          to_user_id: this.selectedChat.user_id,
          text: messageTextToSend
        });
        
        const res = await axios.post(`${this.API_URL}/api/messages/send`, {
          from_user_id: this.userId,
          to_user_id: this.selectedChat.user_id,
          text: messageTextToSend,
          image: imageToSend || null
        });

        if (res.data.success) {
          console.log('Message sent successfully');
          
          // Clear input immediately
          this.messageText = '';
          this.imagePreview = null;
          
          // Reload messages to get the actual saved message
          await this.loadMessages(this.selectedChat.user_id);
          window.dispatchEvent(new Event('dm-refresh'));
          
          // Update conversation preview
          const conv = this.conversations.find(c => c.user_id === this.selectedChat.user_id);
          if (conv) {
            conv.last_message = messageTextToSend || '📷 Photo';
            conv.last_message_time = new Date().toISOString();
            conv.last_message_sent_by_me = true;
            conv.last_message_read = false;
          }
        } else {
          console.error('Failed to send:', res.data.message);
          alert('Failed to send message: ' + res.data.message);
        }
      } catch (err) {
        console.error('Send message error:', err);
        alert('Failed to send message. Please try again.');
      } finally {
        this.isSending = false;
      }
    },

    async markAsRead(otherUserId) {
      try {
        await axios.post(`${this.API_URL}/api/messages/mark_read`, {
          user_id: this.userId,
          other_user_id: otherUserId
        });
        console.log('Messages marked as read');
        window.dispatchEvent(new Event('dm-refresh'));
      } catch (err) {
        console.error('Mark read error:', err);
      }
    },

    attachImage() {
      this.$refs.fileInput.click();
    },

    onImageSelect(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.imagePreview = ev.target.result.split(',')[1]; // Base64 without prefix
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
        console.log('Loading conversations...');
        
        const res = await axios.get(`${this.API_URL}/api/conversations`, {
          params: { user_id: this.userId }
        });
        
        this.conversations = res.data.conversations || [];
        this.filteredConversations = [...this.conversations];
        console.log(`Loaded ${this.conversations.length} conversations`);
        window.dispatchEvent(new Event('dm-refresh'));
      } catch (err) {
        console.error('Load conversations error:', err);
        this.conversations = [];
        this.filteredConversations = [];
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
            profile_pic: this.selectedChat.profile_pic
          }
        }
      }));
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
  },

  mounted() {
    if (!this.userId) {
      console.error('❌ No userId found in localStorage!');
      this.$router.push('/login');
      return;
    }
    console.log('✅ DMPage mounted, userId:', this.userId);
    console.log('✅ User type:', typeof this.userId);

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
      }
    } catch (e) {
      console.error('Socket setup failed:', e);
    }

    this.loadConversations().then(() => {
      this.autoOpenFromQuery();
    });
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
/* Conversations List */
.conversations-list {
  max-width: 600px;
  margin: 0 auto;
}

.conversation-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-border-color, #e5e7eb);
  cursor: pointer;
  transition: background-color 0.2s;
}

.conversation-item:hover {
  background-color: var(--ion-color-light, #f3f4f6);
}

.conv-avatar-container {
  position: relative;
  margin-right: 12px;
  flex-shrink: 0;
}

.conv-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
}

.online-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 12px;
  height: 12px;
  background: #10b981;
  border: 2px solid var(--ion-background-color, #fff);
  border-radius: 50%;
}

.conv-content {
  flex: 1;
  min-width: 0;
}

.conv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.conv-username {
  font-weight: 600;
  color: var(--ion-text-color, #111827);
  font-size: 16px;
}

.conv-time {
  font-size: 12px;
  color: var(--ion-color-medium, #6b7280);
}

.conv-preview {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: var(--ion-color-medium, #6b7280);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.read-receipt {
  font-size: 16px;
  color: var(--ion-color-medium, #9ca3af);
  flex-shrink: 0;
}

.read-receipt.read {
  color: #3b82f6;
}

.unread-text {
  font-weight: 600;
  color: var(--ion-text-color, #111827);
}

.unread-badge {
  background: #10b981;
  color: white;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
  min-width: 20px;
  text-align: center;
}

/* Chat View */
.chat-header-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.header-info {
  display: flex;
  flex-direction: column;
}

.header-username {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
}

.header-status {
  font-size: 12px;
  color: var(--ion-color-medium, #6b7280);
  line-height: 1.2;
}

.chat-container {
  height: calc(100vh - 180px);
  overflow-y: auto;
  padding-bottom: 20px;
}

.chat-messages {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.date-separator {
  text-align: center;
  margin: 16px 0;
}

.date-separator span {
  background: var(--ion-color-light, #e5e7eb);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  color: var(--ion-color-medium, #6b7280);
}

.message-bubble {
  display: flex;
  margin-bottom: 8px;
}

.message-bubble.sent {
  justify-content: flex-end;
}

.message-bubble.received {
  justify-content: flex-start;
}

.message-content {
  max-width: 75%;
  padding: 8px 12px;
  border-radius: 18px;
  word-wrap: break-word;
}

.sent .message-content {
  background: #3b82f6;
  color: white;
  border-bottom-right-radius: 4px;
}

.received .message-content {
  background: var(--ion-color-light, #e5e7eb);
  color: var(--ion-text-color, #111827);
  border-bottom-left-radius: 4px;
}

.message-image {
  width: 100%;
  max-width: 300px;
  border-radius: 12px;
  margin-bottom: 4px;
  display: block;
}

.message-text {
  font-size: 15px;
  line-height: 1.4;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  justify-content: flex-end;
}

.message-time {
  font-size: 11px;
  color: var(--ion-color-medium, #6b7280);
}

.message-status {
  font-size: 14px;
  color: var(--ion-color-medium, #6b7280);
}

.sent .message-status.read {
  color: #bfdbfe;
}

/* Message Input */
.message-input-container {
  position: sticky;
  bottom: 0;
  background: var(--ion-background-color, #fff);
  border-top: 1px solid var(--ion-border-color, #e5e7eb);
  padding: 8px 12px;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  background: var(--ion-color-light, #f3f4f6);
  border-radius: 20px;
  padding: 4px 8px;
}

.message-textarea {
  --padding-start: 8px;
  --padding-end: 8px;
  --padding-top: 6px;
  --padding-bottom: 6px;
  font-size: 15px;
  max-height: 100px;
}

.send-btn {
  margin: 0;
}

/* Search Modal */
.search-result-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-border-color, #e5e7eb);
  cursor: pointer;
}

.search-result-item:hover {
  background-color: var(--ion-color-light, #f3f4f6);
}

.result-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  margin-right: 12px;
  object-fit: cover;
}

.result-info {
  flex: 1;
}

.result-username {
  font-weight: 600;
  font-size: 16px;
  color: var(--ion-text-color, #111827);
}

.result-handle {
  font-size: 14px;
  color: var(--ion-color-medium, #6b7280);
}

/* Empty States */
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 64px;
  color: var(--ion-color-medium, #9ca3af);
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 20px;
  font-weight: 600;
  margin: 12px 0;
  color: var(--ion-text-color, #111827);
}

.empty-state p {
  color: var(--ion-color-medium, #6b7280);
  margin-bottom: 20px;
}

.empty-search {
  padding: 40px 20px;
  text-align: center;
  color: var(--ion-color-medium, #6b7280);
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.emoji-wrapper {
  position: relative;
  display: inline-block;
}

.dm-emoji-picker {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 8px;
  z-index: 2000;
}
</style>