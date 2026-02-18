<template>
  <ion-modal :is-open="isOpen" @did-dismiss="closeModal">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="closeModal" color="medium">Cancel</ion-button>
        </ion-buttons>
        <ion-title>New Post</ion-title>
        <ion-buttons slot="end">
          <ion-button 
            @click="submitPost" 
          :disabled="!canSubmit || isPosting"
            :strong="true"
            color="primary">
            {{ isPosting ? 'Posting...' : 'Post' }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="compose-container">
        <!-- Avatar removed for more space -->
        <div class="compose-input full-width">
            <ion-textarea 
              v-model="postContent" 
              placeholder="What's happening?" 
              class="composer-textarea"
              :auto-grow="true"
              rows="4"
              maxlength="1000"
              @input="handlePostInput">
            </ion-textarea>

            <div v-if="isAnonymous" class="anonymous-indicator">
              <ion-icon :icon="skull"></ion-icon>
              <span>Posting as {{ ghostName || 'Anonymous Ghost' }}</span>
            </div>
          
          <div v-if="mediaPreviews.length" class="preview-grid">
            <div 
              v-for="(preview, index) in mediaPreviews" 
              :key="index"
              class="preview-item"
              :class="`count-${mediaPreviews.length}`">
              <img v-if="preview.type === 'image'" :src="preview.src" class="preview-img" alt="Preview"/>
              <VideoPlayer
                v-else-if="preview.type === 'video'"
                :src="preview.src"
                :poster="preview.thumbnail || ''"
              />
              <ion-button 
                fill="clear" 
                size="small" 
                class="remove-img-btn"
                @click.stop="removeMedia(index)">
                <ion-icon :icon="close"></ion-icon>
              </ion-button>
            </div>
            </div>
          </div>
          
          <!-- Poll Creator -->
          <div v-if="showPollCreator" class="poll-creator">
            <ion-item lines="none" class="poll-input-item">
              <ion-input 
                v-model="pollQuestion" 
                placeholder="Ask a question..."
                class="poll-question-input"
              ></ion-input>
            </ion-item>
            
            <div class="poll-options">
              <div v-for="(option, index) in pollOptions" :key="index" class="poll-option-row">
                <ion-input 
                  v-model="pollOptions[index]" 
                  :placeholder="'Option ' + (index + 1)"
                  class="poll-option-input"
                ></ion-input>
                <ion-button 
                  v-if="pollOptions.length > 2" 
                  fill="clear" 
                  size="small"
                  color="medium"
                  @click="removePollOption(index)">
                  <ion-icon :icon="close"></ion-icon>
                </ion-button>
              </div>
            </div>
            
            <div class="poll-actions">
              <ion-button 
                v-if="pollOptions.length < 4" 
                fill="clear" 
                size="small" 
                @click="addPollOption">
                <ion-icon :icon="add" slot="start"></ion-icon>
                Add Option
              </ion-button>
              
              <ion-select v-model="pollDuration" interface="popover" placeholder="Duration" class="poll-duration-select">
                <ion-select-option value="60">1 Hour</ion-select-option>
                <ion-select-option value="360">6 Hours</ion-select-option>
                <ion-select-option value="1440">1 Day</ion-select-option>
                <ion-select-option value="10080">1 Week</ion-select-option>
              </ion-select>
            </div>
          </div>
          
          <!-- Poll Creator -->

          
          <div class="compose-toolbar">
            <input 
              type="file" 
              accept="image/*,video/*" 
              multiple
              @change="onMediaChange" 
              ref="fileInput"
              style="display: none;"
            />
            <ion-button fill="clear" size="small" class="icon-btn icon-media" @click="$refs.fileInput.click()">
              <ion-icon :icon="image" style="font-size: 24px;"></ion-icon>
            </ion-button>
            <ion-button fill="clear" size="small" class="icon-btn icon-poll" @click="togglePollCreator" :color="showPollCreator ? 'primary' : ''">
              <ion-icon :icon="barChart" style="font-size: 24px;"></ion-icon>
            </ion-button>

            <div class="emoji-wrapper">
              <ion-button fill="clear" size="small" class="icon-btn icon-emoji" @click="toggleEmojiPicker">
                <ion-icon :icon="happy" style="font-size: 24px;"></ion-icon>
              </ion-button>
              <EmojiPicker v-if="showEmojiPicker" @select="addEmoji" class="composer-emoji-picker" />
            </div>
            <span class="char-count" :class="{ 'over-limit': postContent.length > 1000 }">
              {{ postContent.length }}/1000
            </span>
          </div>
          <div 
            v-if="showMentionSuggestions && mentionSuggestions.length" 
            class="mention-suggestions">
            <div 
              v-for="user in mentionSuggestions" 
              :key="user.user_id"
              class="mention-item"
              @click="selectMention(user)">
              <img :src="getImageUrl(user.profile_pic)" class="mention-avatar" alt="avatar" />
              <div class="mention-meta">
                <div class="mention-name">{{ user.full_name || user.username }}</div>
                <div class="mention-handle">@{{ user.username }}</div>
              </div>
            </div>
          </div>
        </div>

    </ion-content>
  </ion-modal>
</template>

<script>
import {
  IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent,
  IonTextarea, IonIcon, IonSpinner, IonItem, IonInput, IonSelect, IonSelectOption
} from '@ionic/vue';
import { image, happy, close, skull, barChart, add } from 'ionicons/icons';
import VideoPlayer from '@/components/VideoPlayer.vue';
import EmojiPicker from '@/components/EmojiPicker.vue';
import axios from 'axios';
import config from '@/config/index.js';

export default {
  name: 'PostComposerModal',
  components: {
    IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent,
    IonTextarea, IonIcon, IonSpinner, VideoPlayer, EmojiPicker,
    IonItem, IonInput, IonSelect, IonSelectOption
  },
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    userId: {
      type: String,
      required: true
    },
    userAvatar: {
      type: String,
      default: ''
    }
  },
  emits: ['update:isOpen', 'post-created'],
  data() {
    return {
      postContent: '',
      postMedia: [],
      mediaPreviews: [],
      showEmojiPicker: false,
      isPosting: false,
      isAnonymous: false,
      ghostName: '',
      mentionSuggestions: [],
      showMentionSuggestions: false,
      mentionQuery: '',
      image, happy, close, skull, barChart, add,
      API_URL: config.api.baseURL,
      
      // Poll Data
      showPollCreator: false,
      pollQuestion: '',
      pollOptions: ['', ''],
      pollDuration: '1440' // Minutes
    };
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.checkAnonymity();
      }
    }
  },
  computed: {
    canPost() {
      const hasContent = this.postContent.trim().length > 0 || this.postMedia.length > 0;
      const isContentValid = this.postContent.length <= 1000;
      
      let hasValidPoll = false;
      if (this.showPollCreator) {
          const hasQuestion = this.pollQuestion.trim().length > 0;
          const validOptions = this.pollOptions.filter(o => o.trim().length > 0);
          hasValidPoll = hasQuestion && validOptions.length >= 2;
      }

      return (hasContent || hasValidPoll) && isContentValid;
    },
    canSubmit() {
      if (this.isPosting) return false;
      if (this.showPollCreator) {
        // Poll mode: question + 2 valid options required
        const hasQuestion = this.pollQuestion && this.pollQuestion.trim().length > 0;
        const validOptions = this.pollOptions.filter(o => o && o.trim().length > 0);
        return hasQuestion && validOptions.length >= 2;
      }
      return this.canPost;
    }
  },
  methods: {
    closeModal() {
      this.$emit('update:isOpen', false);
      this.resetForm();
    },

    async checkAnonymity() {
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        const res = await axios.get(`${this.API_URL}/api/profile/${this.userId}`, {
          params: { viewer_id: userId }
        });
        if(res.data && res.data.success && res.data.profile && res.data.profile.is_anonymous) {
            this.isAnonymous = true;
            this.fetchGhostIdentity();
        } else {
            this.isAnonymous = false;
        }
      } catch (err) {
        console.error('Anonymity check error:', err);
      }
    },

    async fetchGhostIdentity() {
        if (!this.userId) return;
        try {
            const res = await axios.get(`${this.API_URL}/api/user/ghost-identity`, {
                params: { user_id: this.userId }
            });
            if (res.data.success && res.data.ghost) {
                this.ghostName = res.data.ghost.username;
            }
        } catch (err) {
            console.error('Failed to fetch ghost identity:', err);
        }
    },
    
    resetForm() {
      this.postContent = '';
      this.postMedia = [];
      this.mediaPreviews = [];
      this.showEmojiPicker = false;
      this.isAnonymous = false;
      this.ghostName = '';
      this.resetPollForm();
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },

    getImageUrl(path) {
      if (!path) return '/default-avatar.png';
      if (path.startsWith('http') || path.startsWith('data:')) return path;
      return `${this.API_URL}${path}`;
    },

    handlePostInput(event) {
      const val = event.target.value;
      const lastWord = val.split(/\s+/).pop();
      if (lastWord.startsWith('@') && lastWord.length > 1) {
        this.mentionQuery = lastWord.substring(1);
        this.fetchMentionSuggestions();
      } else {
        this.showMentionSuggestions = false;
      }
    },
    
    async fetchMentionSuggestions() {
      if (!this.mentionQuery) return;
      try {
        const res = await axios.get(`${this.API_URL}/api/users/search`, {
          params: { query: this.mentionQuery, limit: 5 }
        });
        if (res.data.success) {
          this.mentionSuggestions = res.data.users;
          this.showMentionSuggestions = true;
        }
      } catch (e) {
        console.error('Mention search error:', e);
      }
    },

    selectMention(user) {
      const words = this.postContent.split(/\s+/);
      words.pop(); // remove partial mention
      words.push(`@${user.username} `);
      this.postContent = words.join(' ');
      this.showMentionSuggestions = false;
    },

    toggleEmojiPicker() {
      this.showEmojiPicker = !this.showEmojiPicker;
    },

    addEmoji(emoji) {
      this.postContent += emoji;
    },

    async onMediaChange(e) {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const remainingSlots = 4 - this.postMedia.length;
      const toAdd = files.slice(0, remainingSlots);

      for (const file of toAdd) {
        const isVideo = file.type.startsWith('video');
        const maxSize = isVideo ? 150 * 1024 * 1024 : 50 * 1024 * 1024;

        if (file.size > maxSize) {
          alert(`${isVideo ? 'Video' : 'Image'} must be less than ${isVideo ? '150' : '50'}MB`);
          continue;
        }

        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target.result;
          let thumbnail = null;
          if (isVideo) {
            try {
              thumbnail = await this.extractVideoThumbnail(file);
            } catch (err) {
              console.error('Failed to generate video thumbnail:', err);
            }
          }
          
          this.postMedia.push({
            type: isVideo ? 'video' : 'image',
            data: dataUrl,
            thumbnail: thumbnail
          });

          this.mediaPreviews.push({
            type: isVideo ? 'video' : 'image',
            src: dataUrl,
            thumbnail: thumbnail
          });
        };
        reader.readAsDataURL(file);
      }

      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },

    removeMedia(index) {
      this.postMedia.splice(index, 1);
      this.mediaPreviews.splice(index, 1);
    },

    async extractVideoThumbnail(file) {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        const fileUrl = URL.createObjectURL(file);
        video.src = fileUrl;
        
        const timeoutId = setTimeout(() => {
            URL.revokeObjectURL(fileUrl);
            reject(new Error('Thumbnail generation timed out'));
        }, 5000);

        video.onloadedmetadata = () => {
          let seekTime = 1.0;
          if (video.duration && isFinite(video.duration)) {
              seekTime = Math.min(1.0, video.duration / 2);
          }
          video.currentTime = seekTime;
        };
        
        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
            clearTimeout(timeoutId);
            URL.revokeObjectURL(fileUrl);
            video.remove();
            resolve(thumbnail);
          } catch (err) {
            clearTimeout(timeoutId);
            URL.revokeObjectURL(fileUrl);
            video.remove();
            resolve(null);
          }
        };
        
        video.onerror = (e) => {
            clearTimeout(timeoutId);
            URL.revokeObjectURL(fileUrl);
            video.remove();
            resolve(null);
        };
      });
    },

    async submitPost() {
      // Always prevent double-submit
      if (this.isPosting) return;

      // Poll Validation
      if (this.showPollCreator) {
        if (!this.pollQuestion.trim()) {
          alert('Please enter a poll question');
          return;
        }
        const validOptions = this.pollOptions.filter(o => o.trim());
        if (validOptions.length < 2) {
          alert('Poll must have at least 2 options');
          return;
        }
      } else {
        // Normal post validation
        if (!this.canPost) return;
      }
      
      try {
        this.isPosting = true;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const payload = {
          user_id: this.userId,
          content: this.postContent,
          image: this.postMedia.find(m => m.type === 'image')?.data || null,
          media: this.postMedia,
          is_anonymous: this.isAnonymous ? 1 : 0
        };

        if (this.showPollCreator) {
          payload.poll_question = this.pollQuestion;
          payload.poll_options = this.pollOptions.filter(o => o.trim());
          payload.poll_duration = this.pollDuration;
        }
        
        const res = await axios.post(
          `${this.API_URL}/api/post`, 
          payload,
          { 
            signal: controller.signal,
            timeout: 300000 
          }
        );
        
        clearTimeout(timeoutId);
        
        if (res.data.success) {
          this.$emit('post-created');
          this.closeModal();
        } else {
          alert('Failed to create post: ' + (res.data.message || 'Unknown error'));
        }
      } catch (err) {
        console.error('Post error:', err);
        // Show the actual error from the server if available
        const serverMsg = err?.response?.data?.message;
        const httpStatus = err?.response?.status;
        if (serverMsg) {
          alert('Post failed (HTTP ' + httpStatus + '): ' + serverMsg);
        } else if (err?.code === 'ECONNABORTED' || err?.name === 'AbortError') {
          alert('Request timed out. Please try again.');
        } else {
          alert('Failed to create post: ' + (err?.message || 'Network error'));
        }
      } finally {
        this.isPosting = false;
      }
    },

    togglePollCreator() {
      if (this.showPollCreator) {
        if ((this.pollQuestion && this.pollQuestion.trim()) || this.pollOptions.some(o => o.trim())) {
          if (!confirm('Discard poll?')) return;
        }
        this.resetPollForm();
      }
      this.showPollCreator = !this.showPollCreator;
    },

    addPollOption() {
      if (this.pollOptions.length < 4) {
        this.pollOptions.push('');
      }
    },

    removePollOption(index) {
      if (this.pollOptions.length > 2) {
        this.pollOptions.splice(index, 1);
      }
    },

    resetPollForm() {
      this.pollQuestion = '';
      this.pollOptions = ['', ''];
      this.pollDuration = '1440';
      this.showPollCreator = false;
    },

    resetForm() {
      this.postContent = '';
      this.postMedia = [];
      this.mediaPreviews = [];
      this.showEmojiPicker = false;
      this.resetPollForm();
    }
  }
};
</script>

<style scoped>
.compose-container {
  display: flex;
  flex-direction: column; /* Changed from row to column for better mobile layout */
  gap: 12px;
}

/* Avatar styles removed */

.compose-input {
  flex: 1;
  width: 100%; /* Ensure full width */
}

.composer-textarea {
  --background: transparent;
  --padding-start: 0;
  --padding-top: 8px;
  font-size: 16px;
  min-height: 100px;
}

.anonymous-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f3f4f6;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  color: #4b5563;
  margin-bottom: 8px;
  width: fit-content;
}

.preview-grid {
  display: grid;
  gap: 8px;
  margin-top: 12px;
  margin-bottom: 12px;
}

.preview-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-img-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0,0,0,0.5);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  --padding-start: 0;
  --padding-end: 0;
  color: white;
}


.compose-toolbar {
  display: flex;
  align-items: center;
  border-top: 1px solid var(--ion-border-color, #eff3f4);
  padding-top: 12px;
  margin-top: 8px;
  gap: 8px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  transition: background-color 0.2s;
  --padding-start: 0;
  --padding-end: 0;
}

.icon-btn:hover {
  background-color: rgba(var(--ion-color-primary-rgb), 0.05);
}

.icon-media {
  color: #1d9bf0; /* Twitter/Modern Blue */
}

.icon-poll {
  color: #f91880; /* Modern Pink/Red or #e67e22 for Orange */
}

.icon-emoji {
  color: #ffd400; /* Bright Yellow */
}

.emoji-wrapper {
  position: relative;
}

.composer-emoji-picker {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
  border-radius: 12px;
}

.char-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--ion-color-medium);
}

.char-count.over-limit {
  color: var(--ion-color-danger);
}

.mention-suggestions {
  margin-top: 8px;
  border: 1px solid var(--ion-border-color, #e5e7eb);
  border-radius: 12px;
  background: var(--ion-background-color, #fff);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  max-height: 240px;
  overflow-y: auto;
}

.mention-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 10px;
  cursor: pointer;
}

.mention-item:hover {
  background: var(--ion-color-light, #f3f4f6);
}

.mention-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.mention-meta {
  display: flex;
  flex-direction: column;
}

.mention-name {
  font-weight: 700;
  font-size: 14px;
}

.mention-handle {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.poll-creator {
  border: 1px solid var(--ion-border-color, #eff3f4);
  border-radius: 12px;
  padding: 12px;
  margin: 12px 0;
}

.poll-question-input {
  --padding-start: 0;
  --padding-end: 0;
  font-weight: 500;
  margin-bottom: 8px;
}

.poll-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.poll-option-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.poll-option-input {
  flex: 1;
  --padding-start: 12px;
  --padding-end: 12px;
  --background: #f3f4f6;
  border-radius: 8px;
  --placeholder-color: #9ca3af;
}

.poll-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  border-top: 1px solid var(--ion-border-color, #eff3f4);
  padding-top: 8px;
}

.poll-duration-select {
  max-width: 120px;
  font-size: 14px;
}
</style>
