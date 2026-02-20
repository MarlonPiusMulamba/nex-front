<template>
  <div class="ama-card" :class="{ 'expired': ama.is_expired }" @click.stop>
    <!-- AMA Header -->
    <div class="ama-header">
      <div class="ama-badge">
        <ion-icon :icon="micOutline"></ion-icon>
        <span>LIVE AMA</span>
      </div>
      <div class="ama-timer" v-if="!ama.is_expired">
        <span>Ends in {{ timeLeft }}</span>
      </div>
      <div class="ama-timer expired" v-else>
        <span>Session Ended</span>
      </div>
    </div>

    <!-- Host Info & Description -->
    <div class="ama-content">
      <div class="host-intro">
        <h3 class="ama-title">Ask Me Anything</h3>
        <p class="ama-desc">{{ ama.description || "I'm answering your questions live! Ask me anything." }}</p>
      </div>

      <!-- Ask Input -->
      <div class="ask-section" v-if="!ama.is_expired">
        <div class="ask-input-wrapper">
          <ion-input
            v-model="newQuestion"
            placeholder="Type your question..."
            class="ask-input"
            @keyup.enter="submitQuestion"
          ></ion-input>
          <ion-button 
            fill="clear" 
            class="send-btn" 
            :disabled="!newQuestion.trim() || isSubmitting"
            @click="submitQuestion"
          >
            <ion-icon :icon="send" slot="icon-only"></ion-icon>
          </ion-button>
        </div>
        <div class="ask-options">
          <div 
            class="anon-toggle" 
            :class="{ active: isAnonymous }" 
            @click="isAnonymous = !isAnonymous"
          >
            <ion-icon :icon="isAnonymous ? eyeOff : eye"></ion-icon>
            <span>{{ isAnonymous ? 'Anonymous' : 'Public' }}</span>
          </div>
        </div>
      </div>

      <!-- Questions List -->
      <div class="questions-list" v-if="localQuestions.length > 0">
        <div class="list-header">
          <span>Top Questions</span>
          <span class="count">{{ ama.question_count }}</span>
        </div>

        <div 
          v-for="(q, index) in displayedQuestions" 
          :key="q.id" 
          class="question-item"
          :class="{ 'top-question': index === 0 && q.upvotes > 0 }"
        >
          <div class="q-left">
            <div class="upvote-box" :class="{ active: q.viewer_upvoted }" @click="toggleUpvote(q)">
              <ion-icon :icon="caretUp"></ion-icon>
              <span>{{ q.upvotes }}</span>
            </div>
          </div>
          
          <div class="q-body">
            <!-- Question -->
            <div class="q-meta">
              <span class="q-author">
                <ion-avatar class="tiny-avatar" v-if="!q.is_anonymous && q.asker_pic">
                   <img :src="getAvatarUrl(q.asker_pic)" />
                </ion-avatar>
                {{ q.asker_username || 'Anonymous' }}
              </span>
              <span class="q-time">{{ timeAgo(q.created_at) }}</span>
              <ion-icon v-if="index === 0 && q.upvotes > 0" :icon="ribbon" class="crown-icon"></ion-icon>
            </div>
            <p class="q-text">{{ q.question_text }}</p>

            <!-- Host Reply -->
            <div v-if="q.host_reply" class="host-reply">
              <div class="reply-marker"></div>
              <div class="reply-content">
                <span class="reply-author">
                  <ion-icon :icon="mic" class="mic-icon"></ion-icon>
                  {{ ama.host_username }}
                </span>
                <p>{{ q.host_reply }}</p>
              </div>
            </div>

            <!-- Reply Action (Host Only) -->
            <div v-if="isHost && !q.host_reply && !ama.is_expired" class="reply-action">
              <div v-if="replyingTo === q.id" class="reply-input-box">
                <ion-textarea 
                  v-model="replyText" 
                  placeholder="Type your answer..." 
                  auto-grow
                  rows="1"
                ></ion-textarea>
                <div class="reply-btns">
                  <ion-button size="small" fill="clear" color="medium" @click="replyingTo = null">Cancel</ion-button>
                  <ion-button size="small" fill="solid" class="post-reply-btn" @click="submitReply(q)">Reply</ion-button>
                </div>
              </div>
              <ion-button 
                v-else 
                fill="clear" 
                size="small" 
                class="reply-trigger-btn"
                @click="replyingTo = q.id; replyText = ''"
              >
                <ion-icon :icon="chatbubbleEllipsesOutline" slot="start"></ion-icon>
                Reply
              </ion-button>
            </div>
          </div>
        </div>

        <div v-if="localQuestions.length > 3" class="show-more-btn" @click="expanded = !expanded">
          <span>{{ expanded ? 'Show Less' : `View ${localQuestions.length - 3} more questions` }}</span>
          <ion-icon :icon="expanded ? chevronUp : chevronDown"></ion-icon>
        </div>
      </div>
      
      <div v-else class="empty-questions">
        <p>No questions yet. Be the first to ask!</p>
      </div>
    </div>
  </div>
</template>

<script>
import { IonIcon, IonButton, IonInput, IonTextarea, IonAvatar } from '@ionic/vue';
import { 
  micOutline, timeOutline, send, eye, eyeOff, caretUp, ribbon, mic, 
  chatbubbleEllipsesOutline, chevronDown, chevronUp 
} from 'ionicons/icons';
// import { formatDistanceToNow } from 'date-fns';
import axios from 'axios';

export default {
  name: 'AMACard',
  components: { IonIcon, IonButton, IonInput, IonTextarea, IonAvatar },
  props: {
    ama: { type: Object, required: true },
    currentUser: { type: Object, default: () => ({}) }
  },
  data() {
    return {
      micOutline, timeOutline, send, eye, eyeOff, caretUp, ribbon, mic,
      chatbubbleEllipsesOutline, chevronDown, chevronUp,
      timeLeft: '',
      timer: null,
      newQuestion: '',
      isAnonymous: false,
      isSubmitting: false,
      localQuestions: [],
      expanded: false,
      replyingTo: null,
      replyText: ''
    };
  },
  computed: {
    isHost() {
      return this.currentUser && String(this.currentUser.id) === String(this.ama.host_user_id);
    },
    displayedQuestions() {
      if (this.expanded) return this.localQuestions;
      return this.localQuestions.slice(0, 3);
    }
  },
  created() {
    this.localQuestions = [...(this.ama.questions || [])];
    this.updateTimeLeft();
    this.timer = setInterval(this.updateTimeLeft, 60000);
  },
  beforeUnmount() {
    if (this.timer) clearInterval(this.timer);
  },
  methods: {
    getAvatarUrl(path) {
      if (!path) return 'assets/default-avatar.png';
      if (path.startsWith('http')) return path;
      return `${this.$store.state.apiUrl || 'http://localhost:5000'}/uploads/avatars/${path}`;
    },
    timeAgo(dateString) {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) return 'just now';
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        
        return date.toLocaleDateString();
      } catch (e) {
        return '';
      }
    },
    updateTimeLeft() {
      if (this.ama.is_expired) {
        this.timeLeft = 'Ended';
        return;
      }
      const end = new Date(this.ama.expires_at);
      const now = new Date();
      const diff = end - now;
      
      if (diff <= 0) {
        this.timeLeft = 'Ended';
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) this.timeLeft = `${hours}h ${mins}m`;
        else this.timeLeft = `${mins}m`;
      }
    },
    async submitQuestion() {
      if (!this.newQuestion.trim() || this.isSubmitting) return;
      this.isSubmitting = true;
      
      try {
        const response = await axios.post(`${this.$store.state.apiUrl}/api/amas/${this.ama.id}/ask`, {
          user_id: this.currentUser.id,
          question: this.newQuestion,
          is_anonymous: this.isAnonymous
        });
        
        if (response.data.success) {
          // Optimistic add
          this.localQuestions.push({
            id: response.data.question_id,
            question_text: this.newQuestion,
            upvotes: 0,
            viewer_upvoted: false,
            created_at: new Date().toISOString(),
            is_anonymous: this.isAnonymous,
            asker_user_id: this.currentUser.id,
            asker_username: this.isAnonymous ? 'Anonymous' : this.currentUser.username,
            asker_pic: this.isAnonymous ? '' : this.currentUser.profile_pic,
            host_reply: null
          });
          this.newQuestion = '';
        }
      } catch (e) {
        console.error('Failed to submit question', e);
      } finally {
        this.isSubmitting = false;
      }
    },
    async toggleUpvote(q) {
      // Optimistic update
      const wasUpvoted = q.viewer_upvoted;
      q.viewer_upvoted = !wasUpvoted;
      q.upvotes += wasUpvoted ? -1 : 1;
      
      // Sort questions immediately? No, might jump around too much. 
      // User can see the number change.
      
      try {
        await axios.post(`${this.$store.state.apiUrl}/api/amas/questions/${q.id}/upvote`, {
          user_id: this.currentUser.id
        });
      } catch (e) {
        // Revert
        q.viewer_upvoted = wasUpvoted;
        q.upvotes += wasUpvoted ? 1 : -1;
      }
    },
    async submitReply(q) {
      if (!this.replyText.trim()) return;
      
      try {
        const response = await axios.post(`${this.$store.state.apiUrl}/api/amas/questions/${q.id}/reply`, {
          user_id: this.currentUser.id,
          reply: this.replyText
        });
        
        if (response.data.success) {
          q.host_reply = this.replyText;
          q.answered = 1;
          this.replyingTo = null;
          this.replyText = '';
        }
      } catch (e) {
        console.error('Failed to reply', e);
      }
    }
  }
};
</script>

<style scoped>
.ama-card {
  background: linear-gradient(145deg, #1a1a1a, #0d0d0d);
  border: 1px solid #333;
  border-radius: 16px;
  overflow: hidden;
  margin-top: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}

/* Header */
.ama-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 215, 0, 0.05); /* Subtle gold tint */
  border-bottom: 1px solid rgba(255, 215, 0, 0.1);
}

.ama-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #ffd700;
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ama-timer {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  font-variant-numeric: tabular-nums;
}

.ama-timer.expired {
  color: #ff4d4d;
}

/* Content */
.ama-content {
  padding: 16px;
}

.host-intro {
  margin-bottom: 20px;
}

.ama-title {
  margin: 0 0 6px 0;
  font-size: 18px;
  font-weight: 800;
  background: linear-gradient(90deg, #fff, #ccc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.ama-desc {
  margin: 0;
  color: #b3b3b3;
  font-size: 14px;
  line-height: 1.4;
}

/* Ask Section */
.ask-section {
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 4px;
  border: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 24px;
}

.ask-input-wrapper {
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.ask-input {
  --background: transparent;
  --padding-start: 12px;
  --color: #fff;
  --placeholder-color: #666;
  font-size: 14px;
}

.send-btn {
  --color: #ffd700;
  margin: 0;
}

.ask-options {
  padding: 8px 12px;
  display: flex;
}

.anon-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: color 0.2s;
}

.anon-toggle.active {
  color: #ffd700;
}

/* Questions List */
.list-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 12px;
  letter-spacing: 0.5px;
}

.question-item {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.top-question .q-text {
  font-size: 1.05em;
}

.top-question .upvote-box {
  border-color: rgba(255, 215, 0, 0.4);
  background: rgba(255, 215, 0, 0.1);
  color: #ffd700;
}

.q-left {
  padding-top: 4px;
}

.upvote-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 42px;
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #888;
  cursor: pointer;
  transition: all 0.2s;
}

.upvote-box ion-icon {
  font-size: 18px;
  margin-bottom: -2px;
}

.upvote-box span {
  font-size: 11px;
  font-weight: 600;
}

.upvote-box.active {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.05);
}

.q-body {
  flex: 1;
  min-width: 0;
}

.q-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
}

.q-author {
  font-weight: 600;
  color: #ccc;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tiny-avatar {
  width: 16px;
  height: 16px;
  margin-right: -2px;
}

.q-time {
  color: #666;
}

.crown-icon {
  color: #ffd700;
  font-size: 14px;
}

.q-text {
  margin: 0 0 10px 0;
  color: #eee;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word;
}

/* Host Reply */
.host-reply {
  display: flex;
  gap: 12px;
  background: rgba(255, 215, 0, 0.05);
  border-left: 2px solid #ffd700;
  padding: 10px 12px;
  border-radius: 0 8px 8px 0;
  margin-top: 8px;
}

.reply-content {
  flex: 1;
}

.reply-author {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #ffd700;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 4px;
}

.mic-icon {
  font-size: 12px;
}

.reply-content p {
  margin: 0;
  color: #ddd;
  font-size: 13px;
  line-height: 1.4;
}

/* Reply Action */
.reply-input-box {
  margin-top: 8px;
}

.reply-input-box ion-textarea {
  --background: rgba(0,0,0,0.3);
  --padding-start: 8px;
  --padding-top: 8px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 8px;
}

.post-reply-btn {
  --background: #ffd700;
  --color: #000;
  font-weight: 600;
}

.show-more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  font-size: 13px;
  color: #888;
  cursor: pointer;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.empty-questions {
  text-align: center;
  padding: 30px 0;
  color: #666;
  font-style: italic;
  font-size: 13px;
}
</style>
