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
            :disabled="!canPost || isPosting"
            :strong="true"
            color="primary">
            {{ isPosting ? 'Posting...' : 'Post' }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="compose-container">
        <div class="compose-avatar">
          <img :src="getImageUrl(userAvatar)" class="avatar-img" alt="Your avatar" />
        </div>
        <div class="compose-input">
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
              <span>Posting as Anonymous Ghost</span>
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
          
          <div class="compose-toolbar">
            <input 
              type="file" 
              accept="image/*,video/*" 
              multiple
              @change="onMediaChange" 
              ref="fileInput"
              style="display: none;"
            />
            <ion-button fill="clear" size="small" @click="$refs.fileInput.click()">
              <ion-icon :icon="image"></ion-icon>
            </ion-button>
            <div class="emoji-wrapper">
              <ion-button fill="clear" size="small" @click="toggleEmojiPicker">
                <ion-icon :icon="happy"></ion-icon>
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
      </div>
    </ion-content>
  </ion-modal>
</template>

<script>
import {
  IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent,
  IonTextarea, IonIcon, IonSpinner
} from '@ionic/vue';
import { image, happy, close, skull } from 'ionicons/icons';
import VideoPlayer from '@/components/VideoPlayer.vue';
import EmojiPicker from '@/components/EmojiPicker.vue';
import axios from 'axios';
import config from '@/config/index.js';

export default {
  name: 'PostComposerModal',
  components: {
    IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent,
    IonTextarea, IonIcon, IonSpinner, VideoPlayer, EmojiPicker
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
      mentionSuggestions: [],
      showMentionSuggestions: false,
      mentionQuery: '',
      image, happy, close, skull,
      API_URL: config.api.baseURL
    };
  },
  computed: {
    canPost() {
      return (this.postContent.trim().length > 0 || this.postMedia.length > 0) && 
             this.postContent.length <= 1000;
    }
  },
  methods: {
    closeModal() {
      this.$emit('update:isOpen', false);
      this.resetForm();
    },
    
    resetForm() {
      this.postContent = '';
      this.postMedia = [];
      this.mediaPreviews = [];
      this.showEmojiPicker = false;
      this.isAnonymous = false;
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
      if (!this.canPost || this.isPosting) return;
      
      try {
        this.isPosting = true;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const res = await axios.post(
          `${this.API_URL}/api/post`, 
          {
            user_id: this.userId,
            content: this.postContent,
            image: this.postMedia.find(m => m.type === 'image')?.data || null,
            media: this.postMedia
          },
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
          alert(res.data.message || 'Failed to create post');
        }
      } catch (err) {
        console.error('❌ Post error:', err);
        alert('Failed to create post. Please try again.');
      } finally {
        this.isPosting = false;
      }
    }
  }
};
</script>

<style scoped>
.compose-container {
  display: flex;
  gap: 12px;
}

.compose-avatar {
  flex-shrink: 0;
}

.avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.compose-input {
  flex: 1;
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
  padding-top: 8px;
  margin-top: 8px;
}

.emoji-wrapper {
  position: relative;
}

.composer-emoji-picker {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
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
</style>
