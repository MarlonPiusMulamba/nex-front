<template>
  <ion-modal :is-open="isOpen" @did-dismiss="closeModal">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="closeModal" color="medium">Cancel</ion-button>
        </ion-buttons>
        <ion-title>{{ modalTitle }}</ion-title>
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
        <div v-if="targetFraternity" class="fraternity-target-badge">
          🛡 Posting to {{ targetFraternity.name }}
        </div>
        <div class="compose-input full-width">
            <!-- Standard Post Inputs (Hidden in specialized modes) -->
            <template v-if="!showPollCreator && !showAMACreator && !showAudioSpaceCreator">
              <ion-textarea 
                v-model="postContent" 
                placeholder="What's happening?" 
                class="composer-textarea"
                :auto-grow="true"
                rows="4"
                maxlength="1000"
                @input="handlePostInput"
                @focus="lastFocusedField = 'postContent'">
              </ion-textarea>

              <div v-if="isAnonymous" class="anonymous-indicator">
                <ion-icon :icon="skull"></ion-icon>
                <span>Posting as {{ ghostName || 'Anonymous Ghost' }}</span>
              </div>
            </template>
          
            <!-- Media Previews (Visible in standard post mode) -->
            <div v-if="mediaPreviews.length && !showPollCreator && !showAMACreator && !showAudioSpaceCreator" class="preview-grid" :class="`count-${mediaPreviews.length}`">
              <div 
                v-for="(preview, index) in mediaPreviews" 
                :key="index"
                class="preview-item">
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
          
          <!-- Poll Creator -->
          <div v-if="showPollCreator" class="poll-creator">

            <!-- Header -->
            <div class="poll-creator-header">
              <div class="pc-header-left">
                <span class="pc-icon">📊</span>
                <span class="pc-title">Create Poll</span>
              </div>
              <div class="poll-type-chips">
                <button class="type-chip" :class="{ active: pollType === 'standard' }" @click="setPollType('standard')">
                  Standard
                </button>
                <button class="type-chip battle-chip" :class="{ active: pollType === 'battle' }" @click="setPollType('battle')">
                  ⚔️ Battle
                </button>
              </div>
            </div>

            <!-- Question -->
            <div class="pc-question-wrap">
              <ion-input
                v-model="pollQuestion"
                placeholder="What do you want to ask?"
                class="pc-question-input"
                @focus="lastFocusedField = 'pollQuestion'"
              ></ion-input>
            </div>

            <!-- Options -->
            <div class="pc-options-list">
              <div
                v-for="(option, index) in pollOptions"
                :key="index"
                class="pc-option-row"
                :class="'pc-opt-' + index"
                :style="{ animationDelay: index * 55 + 'ms' }"
              >
                <span class="pc-opt-dot"></span>
                <ion-input
                  v-model="pollOptions[index]"
                  :placeholder="pollType === 'battle' ? (index === 0 ? '🔴 Side A' : '🔵 Side B') : 'Choice ' + (index + 1)"
                  class="pc-opt-input"
                  @focus="lastFocusedField = 'pollOption' + index"
                ></ion-input>
                <button
                  v-if="pollOptions.length > 2 && pollType !== 'battle'"
                  class="pc-remove-btn"
                  @click="removePollOption(index)">
                  <ion-icon :icon="close"></ion-icon>
                </button>
              </div>
            </div>

            <!-- Bottom row: add option + duration -->
            <div class="pc-footer">
              <button
                v-if="pollOptions.length < 4 && pollType !== 'battle'"
                class="pc-add-btn"
                @click="addPollOption">
                <ion-icon :icon="add"></ion-icon>
                Add choice
              </button>
              <div class="pc-duration-group">
                <span class="pc-duration-label">Duration</span>
                <div class="pc-duration-pills">
                  <button
                    v-for="d in durationOptions"
                    :key="d.value"
                    class="pc-dur-pill"
                    :class="{ active: pollDuration === d.value }"
                    @click="pollDuration = d.value">
                    {{ d.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <!-- /Poll Creator -->

          <!-- AMA Creator -->
          <div v-if="showAMACreator" class="ama-creator">
            <div class="ama-creator-header">
              <span class="ama-creator-icon">🎙️</span>
              <span class="ama-creator-title">Host an AMA Session</span>
            </div>

            <ion-item lines="none" class="ama-input-item">
              <ion-textarea
                v-model="amaDescription"
                placeholder="What's this AMA about? (Optional)"
                class="ama-desc-input"
                rows="2"
                auto-grow
                @focus="lastFocusedField = 'amaDescription'"
              ></ion-textarea>
            </ion-item>

            <div class="ama-actions">
              <span class="duration-label">Duration:</span>
              <div class="duration-chips">
                <button
                  v-for="d in amaDurationOptions"
                  :key="d.value"
                  class="duration-chip ama-chip"
                  :class="{ active: amaDuration === d.value }"
                  @click="amaDuration = d.value">
                  {{ d.label }}
                </button>
              </div>
            </div>
          </div>
          <!-- /AMA Creator -->

          <div v-if="showAudioSpaceCreator" class="audio-space-creator">
            <div class="space-creator-header">
              <span class="space-creator-icon">📻</span>
              <span class="space-creator-title">Start a NexFi Talk</span>
            </div>
            
            <ion-item lines="none" class="space-input-item">
              <ion-input
                v-model="audioSpaceTitle"
                placeholder="What do you want to talk about?"
                class="space-title-input"
                @focus="lastFocusedField = 'audioSpaceTitle'"
              ></ion-input>
            </ion-item>

            <div class="locked-toggle-item">
              <ion-label>Locked Talk (Request to join)</ion-label>
              <ion-toggle v-model="audioSpaceIsLocked" color="warning"></ion-toggle>
            </div>
            <p class="locked-hint" v-if="audioSpaceIsLocked">
              Only people you approve can join. Recording will be private to you.
            </p>
          </div>
          <!-- /Audio Space Creator -->

          
          <div class="compose-toolbar">
            <input 
              type="file" 
              accept="image/*,video/*" 
              multiple
              @change="onMediaChange" 
              ref="fileInput"
              style="display: none;"
            />
            
            <div class="toolbar-actions">
              <div class="emoji-wrapper">
                <button type="button" class="toolbar-btn btn-emoji" @click="toggleEmojiPicker" title="Add Emoji">
                  <ion-icon :icon="happy"></ion-icon>
                  <span>Emoji</span>
                </button>
                <EmojiPicker v-if="showEmojiPicker" @select="addEmoji" class="composer-emoji-picker" />
              </div>

              <button v-if="canAddMoreMedia && !showPollCreator && !showAMACreator && !showAudioSpaceCreator" type="button" class="toolbar-btn btn-media" @click="$refs.fileInput.click()" title="Add Media">
                <ion-icon :icon="image"></ion-icon>
                <span>Media</span>
              </button>

              <button v-if="!initialType || initialType === 'post'" type="button" class="toolbar-btn btn-poll" @click="togglePollCreator" :class="{ active: showPollCreator }" title="Create Poll">
                <ion-icon :icon="barChart"></ion-icon>
                <span>Poll</span>
              </button>

              <button v-if="!initialType || initialType === 'post'" type="button" class="toolbar-btn btn-ama" @click="toggleAMACreator" :class="{ active: showAMACreator }" title="Host AMA">
                <ion-icon :icon="mic"></ion-icon>
                <span>AMA</span>
              </button>

              <button v-if="!initialType || initialType === 'post'" type="button" class="toolbar-btn btn-space" @click="toggleAudioSpaceCreator" :class="{ active: showAudioSpaceCreator }" title="Start Talk">
                <ion-icon :icon="radio"></ion-icon>
                <span>Talk</span>
              </button>
            </div>

            <span class="char-count" :class="{ 'over-limit': postContent.length > 1000 }" v-if="!showAudioSpaceCreator && !showPollCreator && !showAMACreator">
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
  IonTextarea, IonIcon, IonSpinner, IonItem, IonInput, IonToggle, IonLabel
} from '@ionic/vue';
import { image, happy, close, skull, barChart, add, mic, radio, lockClosed } from 'ionicons/icons';
import VideoPlayer from '@/components/VideoPlayer.vue';
import EmojiPicker from '@/components/EmojiPicker.vue';
import axios from 'axios';
import config from '@/config/index.js';

export default {
  name: 'PostComposerModal',
  components: {
    IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent,
    IonTextarea, IonIcon, IonSpinner, VideoPlayer, EmojiPicker,
    IonItem, IonInput, IonToggle, IonLabel
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
    },
    initialType: {
      type: String,
      default: 'text'
    },
    targetFraternity: {
      type: Object,
      default: () => null
    }
  },
  emits: ['update:isOpen', 'post-created'],
  data() {
    return {
      postContent: '',
      postMedia: [],
      rawFiles: [],
      mediaPreviews: [],
      showEmojiPicker: false,
      isPosting: false,
      isAnonymous: false,
      ghostName: '',
      mentionSuggestions: [],
      showMentionSuggestions: false,
      mentionQuery: '',
      image, happy, close, skull, barChart, add, mic, radio,
      API_URL: config.api.baseURL,
      
      // Audio Space
      showAudioSpaceCreator: false,
      audioSpaceTitle: '',
      audioSpaceIsLocked: false,

      // AMA Data
      showAMACreator: false,
      amaDescription: '',
      amaDuration: '60',
      amaDurationOptions: [
        { label: '1h', value: '60' },
        { label: '4h', value: '240' },
        { label: '12h', value: '720' },
        { label: '24h', value: '1440' }
      ],
      
      // Poll Data
      showPollCreator: false,
      pollQuestion: '',
      pollOptions: ['', ''],
      pollDuration: '1440', // Minutes
      pollType: 'standard', // 'standard' | 'battle'
      durationOptions: [
        { label: '1h',  value: '60' },
        { label: '6h',  value: '360' },
        { label: '1d',  value: '1440' },
        { label: '1w',  value: '10080' }
      ],
      lastFocusedField: 'postContent'
    };
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.checkAnonymity();
        this.applyInitialType();
      }
    }
  },
  computed: {
    modalTitle() {
      if (this.showPollCreator) return 'Create Poll';
      if (this.showAMACreator) return 'Host AMA';
      if (this.showAudioSpaceCreator) return 'Start NexFi Talk';
      return 'New Post';
    },
    canPost() {
      const hasContent = this.postContent.trim().length > 0 || this.rawFiles.length > 0;
      const isContentValid = this.postContent.length <= 1000;
      
      let hasValidPoll = false;
      if (this.showPollCreator) {
          const hasQuestion = this.pollQuestion.trim().length > 0;
          const validOptions = this.pollOptions.filter(o => o.trim().length > 0);
          hasValidPoll = hasQuestion && validOptions.length >= 2;
      }
      
      let hasValidAMA = false;
      if (this.showAMACreator) {
          hasValidAMA = true; // Description is optional, presence is enough
      }

      let hasValidSpace = false;
      if (this.showAudioSpaceCreator) {
          hasValidSpace = !!this.audioSpaceTitle.trim();
      }

      return (hasContent || hasValidPoll || hasValidAMA || hasValidSpace) && isContentValid;
    },
    canAddMoreMedia() {
      return this.rawFiles.length < 4;
    },
    canSubmit() {
      if (this.isPosting) return false;
      if (this.showPollCreator) {
        // Poll mode: question + 2 valid options required
        const hasQuestion = this.pollQuestion && this.pollQuestion.trim().length > 0;
        const validOptions = this.pollOptions.filter(o => o && o.trim().length > 0);
        return hasQuestion && validOptions.length >= 2;
      }
      if (this.showAMACreator) {
        return true;
      }
      if (this.showAudioSpaceCreator) {
          return !!this.audioSpaceTitle.trim();
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
    


    applyInitialType() {
      // Reset first
      this.showPollCreator = false;
      this.showAMACreator = false;
      this.showAudioSpaceCreator = false;

      if (this.initialType === 'poll') {
        this.showPollCreator = true;
      } else if (this.initialType === 'ama') {
        this.showAMACreator = true;
      } else if (this.initialType === 'talk') {
        this.showAudioSpaceCreator = true;
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
      if (this.lastFocusedField === 'postContent') {
        this.postContent += emoji;
      } else if (this.lastFocusedField === 'pollQuestion') {
        this.pollQuestion += emoji;
      } else if (this.lastFocusedField.startsWith('pollOption')) {
        const index = parseInt(this.lastFocusedField.replace('pollOption', ''));
        this.pollOptions[index] += emoji;
      } else if (this.lastFocusedField === 'amaDescription') {
        this.amaDescription += emoji;
      } else if (this.lastFocusedField === 'audioSpaceTitle') {
        this.audioSpaceTitle += emoji;
      } else {
        this.postContent += emoji;
      }
    },

    async onMediaChange(e) {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const remainingSlots = 4 - this.rawFiles.length;
      const toAdd = files.slice(0, remainingSlots);

      for (const file of toAdd) {
        const isVideo = file.type.startsWith('video');
        const maxSize = isVideo ? 150 * 1024 * 1024 : 50 * 1024 * 1024;

        if (file.size > maxSize) {
          alert(`${isVideo ? 'Video' : 'Image'} must be less than ${isVideo ? '150' : '50'}MB`);
          continue;
        }

        // Instant preview using browser object URL (0 CPU/Base64 overhead!)
        const previewUrl = URL.createObjectURL(file);
        
        this.rawFiles.push(file);
        this.mediaPreviews.push({
          type: isVideo ? 'video' : 'image',
          src: previewUrl,
          file: file
        });
      }

      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },

    removeMedia(index) {
      // Revoke the object URL to release browser memory immediately
      const preview = this.mediaPreviews[index];
      if (preview && preview.src && preview.src.startsWith('blob:')) {
        URL.revokeObjectURL(preview.src);
      }
      this.rawFiles.splice(index, 1);
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
      } else if (this.showAMACreator) {
          // AMA specific validation if any
      } else if (this.showAudioSpaceCreator) {
          if (!this.audioSpaceTitle.trim()) {
              alert('Please enter a title for your space');
              return;
          }
      } else {
        // Normal post validation
        if (!this.canPost) return;
      }
      
      try {
        this.isPosting = true;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        
        const formData = new FormData();
        formData.append('user_id', this.userId);
        formData.append('content', this.postContent || '');
        formData.append('is_anonymous', this.isAnonymous ? '1' : '0');
        if (this.targetFraternity) {
          formData.append('fraternity_id', this.targetFraternity.id);
        }

        // Append raw files directly
        this.rawFiles.forEach((file) => {
          formData.append('media_files', file);
        });

        if (this.showPollCreator) {
          formData.append('poll_question', this.pollQuestion);
          formData.append('poll_options', JSON.stringify(this.pollOptions.filter(o => o.trim())));
          formData.append('poll_duration', this.pollDuration);
        } else if (this.showAMACreator) {
          formData.append('ama_description', this.amaDescription || '');
          formData.append('ama_duration', this.amaDuration);
        } else if (this.showAudioSpaceCreator) {
          formData.append('audio_space_title', this.audioSpaceTitle);
          formData.append('is_locked', this.audioSpaceIsLocked ? '1' : '0');
        }

        const res = await axios.post(
          `${this.API_URL}/api/post`, 
          formData,
          { 
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            signal: controller.signal,
            timeout: 60000 
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

    toggleAMACreator() {
      if (this.showAMACreator) {
        if (this.amaDescription.trim()) {
           if (!confirm('Discard AMA session?')) return;
        }
        this.resetAMACreator();
      } else {
        // Close others
        if (this.showPollCreator) this.togglePollCreator();
        if (this.showAudioSpaceCreator) this.toggleAudioSpaceCreator();
        this.showAMACreator = true;
      }
    },
    
    toggleAudioSpaceCreator() {
        if (this.showAudioSpaceCreator) {
            if (this.audioSpaceTitle.trim()) {
                if (!confirm('Discard Audio Space?')) return;
            }
            this.showAudioSpaceCreator = false;
            this.audioSpaceTitle = '';
        } else {
            // Close others
            if (this.showPollCreator) this.togglePollCreator();
            if (this.showAMACreator) this.toggleAMACreator();
            this.showAudioSpaceCreator = true;
        }
    },

    resetAMACreator() {
        this.showAMACreator = false;
        this.amaDescription = '';
        this.amaDuration = '60';
    },

    setPollType(type) {
      this.pollType = type;
      if (type === 'battle') {
        // Battle mode: exactly 2 options
        this.pollOptions = [this.pollOptions[0] || '', this.pollOptions[1] || ''];
      }
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
      this.pollType = 'standard';
      this.showPollCreator = false;
    },

    resetForm() {
      this.postContent = '';
      this.postMedia = [];
      this.rawFiles = [];
      
      // Revoke all remaining object URLs to prevent browser memory leaks
      this.mediaPreviews.forEach((preview) => {
        if (preview.src && preview.src.startsWith('blob:')) {
          URL.revokeObjectURL(preview.src);
        }
      });
      this.mediaPreviews = [];
      this.showEmojiPicker = false;
      this.isAnonymous = false;
      this.ghostName = '';
      this.resetPollForm();
      this.resetAMACreator();
      this.showAudioSpaceCreator = false;
      this.audioSpaceTitle = '';
      this.audioSpaceIsLocked = false;
      this.lastFocusedField = 'postContent';
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
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
  flex-direction: column;
  border-top: 1px solid var(--ion-border-color, #eff3f4);
  padding-top: 12px;
  margin-top: 8px;
  gap: 12px;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f0f2f5;
  border: 1px solid transparent;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
  cursor: pointer;
  color: #536471;
}

.toolbar-btn ion-icon {
  font-size: 18px;
}

.toolbar-btn:hover {
  background: #e8e9eb;
  transform: translateY(-1px);
}

.toolbar-btn.active {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
  border-color: rgba(var(--ion-color-primary-rgb), 0.2);
}

.btn-emoji {
  color: #ffb000;
}
.btn-emoji:hover {
  background-color: rgba(255, 176, 0, 0.1);
}

.btn-media {
  color: #1d9bf0;
}
.btn-media:hover {
  background-color: rgba(29, 155, 240, 0.1);
}

.btn-poll {
  color: #f91880;
}
.btn-poll:hover {
  background-color: rgba(249, 24, 128, 0.1);
}

.btn-ama {
  color: #ffd700;
}
.btn-ama:hover {
  background-color: rgba(255, 215, 0, 0.1);
}

.btn-space {
  color: #FFD700;
}
.btn-space:hover {
  background-color: rgba(255, 215, 0, 0.1);
}



.audio-space-creator {
  background: #111;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid #FFD700;
}

.space-creator-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.space-creator-icon {
  font-size: 24px;
  margin-right: 8px;
}

.space-creator-title {
  font-weight: 700;
  font-size: 16px;
  color: #FFD700;
}

.space-input-item {
  --background: white;
  --border-radius: 12px;
  --padding-start: 0;
  border: 1px solid #e1e8ed;
  border-radius: 12px;
  margin-top: 8px;
}

.space-title-input {
  --padding-start: 12px;
  font-weight: 600;
}



.emoji-wrapper {
  position: relative;
}

.composer-emoji-picker {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  border-radius: 12px;
}

/* Focused Mode Styles */
.poll-creator, .ama-creator, .audio-space-creator {
  animation: slideUpFade 0.3s ease-out;
  border: 1px solid rgba(218, 165, 32, 0.1);
  background: rgba(255, 255, 255, 0.02);
  border-radius: 24px;
  overflow: hidden;
  margin-bottom: 20px;
}

.poll-creator-header, .ama-creator-header, .space-creator-header {
  padding: 16px;
  background: rgba(218, 165, 32, 0.05);
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.poll-creator-icon, .ama-creator-icon, .space-creator-icon {
  font-size: 24px;
}

.ama-creator-title, .space-creator-title {
  font-weight: 800;
  font-size: 17px;
  color: #fff;
}

@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Narrow Toolbar when in focused mode */
.compose-toolbar {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 12px;
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

/* ========== POLL CREATOR ========== */
.poll-creator {
  border-radius: 18px;
  margin: 12px 0;
  overflow: hidden;
  background: #f0f1ff !important;
  border: 1.5px solid #c7d2fe;
  box-shadow: 0 4px 24px rgba(99,102,241,0.12);
}
body.dark .poll-creator {
  background: #1a1b2e !important;
  border-color: #312e81;
  box-shadow: 0 4px 24px rgba(99,102,241,0.25);
}

/* Header */
.poll-creator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
}
.pc-header-left { display: flex; align-items: center; gap: 8px; }
.pc-icon { font-size: 18px; }
.pc-title { font-size: 13px; font-weight: 800; color: #fff; letter-spacing: 0.4px; text-transform: uppercase; }

/* type chips */
.poll-type-chips { display: flex; gap: 6px; margin-left: auto; }
.type-chip {
  border: 1.5px solid rgba(255,255,255,0.45);
  border-radius: 99px;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  background: transparent;
  color: rgba(255,255,255,0.85);
  transition: all 0.2s ease;
}
.type-chip.active {
  background: #fff;
  color: #6366f1;
  border-color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.battle-chip.active { color: #f43f5e; }

/* Question input */
.pc-question-wrap {
  padding: 12px 16px 8px;
  border-bottom: 1px solid #e5e7eb;
}
body.dark .pc-question-wrap { border-bottom-color: #2f3336; }
.pc-question-input {
  --padding-start: 0;
  --padding-end: 0;
  --background: transparent;
  font-size: 16px;
  font-weight: 700;
  --placeholder-color: #9ca3af;
}
body.dark .pc-question-input { --color: #f9fafb; }

/* Options */
.pc-options-list { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px 6px; }

.pc-opt-0 { --oc1: #7c3aed; --oc2: #a855f7; }
.pc-opt-1 { --oc1: #0ea5e9; --oc2: #38bdf8; }
.pc-opt-2 { --oc1: #f43f5e; --oc2: #fb7185; }
.pc-opt-3 { --oc1: #10b981; --oc2: #34d399; }

.pc-option-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.9) !important;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  padding: 0 12px;
  height: 44px;
  animation: slide-in-option 0.28s ease both;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
body.dark .pc-option-row { background: rgba(30,31,46,0.95) !important; border-color: #374151; }
.pc-option-row:focus-within {
  border-color: var(--oc1);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--oc1) 15%, transparent);
}

@keyframes slide-in-option {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.pc-opt-dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, var(--oc1), var(--oc2));
}
.pc-opt-input {
  flex: 1;
  --padding-start: 0;
  --padding-end: 0;
  --background: transparent;
  font-size: 14px;
  font-weight: 600;
  --placeholder-color: #9ca3af;
}
body.dark .pc-opt-input { --color: #f9fafb; }
.pc-remove-btn {
  background: none; border: none; cursor: pointer;
  color: #9ca3af; display: flex; align-items: center; padding: 4px;
  border-radius: 6px; transition: color 0.2s, background 0.2s;
}
.pc-remove-btn:hover { color: #ef4444; background: #fee2e2; }

/* Footer */
.pc-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px 14px;
  flex-wrap: wrap; gap: 8px;
}
.pc-add-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: none; border: 1.5px dashed #c4b5fd; border-radius: 99px;
  padding: 5px 14px; font-size: 13px; font-weight: 700;
  color: #7c3aed; cursor: pointer;
  transition: all 0.2s ease;
}
body.dark .pc-add-btn { border-color: #4c1d95; color: #c4b5fd; }
.pc-add-btn:hover { background: #ede9fe; }

.pc-duration-group { display: flex; align-items: center; gap: 8px; }
.pc-duration-label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
body.dark .pc-duration-label { color: #9ca3af; }
.pc-duration-pills { display: flex; gap: 4px; flex-wrap: wrap; }
.pc-dur-pill {
  border: 1.5px solid #e5e7eb;
  border-radius: 99px;
  padding: 3px 10px; font-size: 12px; font-weight: 700;
  cursor: pointer; background: transparent; color: #6b7280;
  transition: all 0.2s ease;
}
body.dark .pc-dur-pill { border-color: #374151; color: #9ca3af; }
.pc-dur-pill.active {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-color: transparent; color: #fff;
  box-shadow: 0 2px 10px rgba(99,102,241,0.4);
}


/* ========== AMA CREATOR ========== */
.ama-creator {
  border-radius: 16px;
  margin: 12px 0;
  overflow: hidden;
  background: linear-gradient(135deg, #1a1a1a, #0d0d0d);
  border: 1px solid #ffd700;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.15);
}

.ama-creator-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255, 215, 0, 0.1);
  border-bottom: 1px solid rgba(255, 215, 0, 0.1);
}

.ama-creator-icon {
  font-size: 18px;
}

.ama-creator-title {
  color: #ffd700;
  font-weight: 700;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ama-input-item {
  --background: transparent;
  --padding-start: 10px;
  --min-height: 0;
}

.ama-desc-input {
  --background: transparent;
  --color: #fff;
  --placeholder-color: #666;
  margin-top: 8px;
  font-size: 14px;
}

.ama-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.duration-label {
    font-size: 12px;
    color: #888;
    margin-right: 8px;
}

.ama-chip {
    background: rgba(255, 255, 255, 0.05);
    color: #888;
}

.ama-chip.active {
    background: #ffd700;
    color: #000;
    font-weight: 700;
}
.duration-chip.active {
    background: #ffd700;
    color: #000;
    font-weight: 700;
}

/* Audio Space Creator */
.audio-space-creator {
  border-radius: 16px;
  margin: 12px 0;
  overflow: hidden;
  background: linear-gradient(135deg, #1a1a1a, #0d0d0d);
  border: 1px solid #ffd700;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.2);
  padding: 16px;
}

.space-creator-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.space-creator-icon { font-size: 24px; }
.space-creator-title {
  color: #ffd700;
  font-weight: 700;
  font-size: 18px;
}

.space-input-item {
  --background: rgba(255, 255, 255, 0.05);
  --border-radius: 12px;
  --padding-start: 12px;
  margin-bottom: 16px;
}

.space-title-input {
  --color: #fff;
  font-size: 16px;
}

.locked-toggle-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  color: #fff;
  font-size: 14px;
}

.locked-hint {
  font-size: 11px;
  color: #888;
  margin: 4px 0 0 0;
  font-style: italic;
}
</style>
