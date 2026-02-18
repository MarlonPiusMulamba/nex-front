<template>
  <div class="poll-container" @click.stop>
    <div v-if="poll.question" class="poll-question">
      {{ poll.question }}
    </div>

    <div class="poll-options">
      <div 
        v-for="option in poll.options" 
        :key="option.id"
        class="poll-option"
        :class="{ 
          'voted': poll.has_voted && poll.user_voted_option_id === option.id,
          'winner': isWinner(option),
          'selectable': !showResults
        }"
        @click="handleVote(option.id)"
      >
        <!-- Progress Bar Background -->
        <div 
          v-if="showResults" 
          class="poll-progress" 
          :style="{ width: getPercentage(option) + '%' }"
        ></div>

        <!-- Option Content -->
        <div class="poll-content">
          <span class="poll-label">{{ option.option_text }}</span>
          <span v-if="showResults" class="poll-percent">
            {{ getPercentage(option) }}%
          </span>
          <ion-icon 
            v-if="poll.has_voted && poll.user_voted_option_id === option.id" 
            :icon="checkmarkCircle" 
            class="voted-icon"
          ></ion-icon>
        </div>
      </div>
    </div>

    <div class="poll-footer">
      <span>{{ totalVotes }} votes</span>
      <span class="dot">•</span>
      <span>{{ timeLeft }}</span>
    </div>
  </div>
</template>

<script>
import { IonIcon } from '@ionic/vue';
import { checkmarkCircle } from 'ionicons/icons';
import axios from 'axios';
import config from '@/config/index.js';

export default {
  name: 'PollDisplay',
  components: {
    IonIcon
  },
  props: {
    poll: {
      type: Object,
      required: true
    },
    postId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      isVoting: false,
      checkmarkCircle,
      API_URL: config.api.baseURL
    };
  },
  computed: {
    showResults() {
      return this.poll.has_voted || this.poll.is_expired;
    },
    totalVotes() {
      return (this.poll.options || []).reduce((acc, opt) => acc + (opt.vote_count || 0), 0);
    },
    timeLeft() {
      if (this.poll.is_expired) return 'Final results';
      if (!this.poll.expires_at) return '';
      
      const expiresAt = new Date(this.poll.expires_at.replace('Z', '+00:00')); // Handle UTC Z
      const now = new Date();
      const diffMs = expiresAt - now;
      
      if (diffMs <= 0) return 'Final results';
      
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);
      
      if (diffDays > 0) return `${diffDays}d left`;
      if (diffHrs > 0) return `${diffHrs}h left`;
      
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m left`;
    }
  },
  methods: {
    async handleVote(optionId) {
      if (this.showResults || this.isVoting) return;
      
      try {
        this.isVoting = true;
        const userId = localStorage.getItem('userId');
        
        // Optimistic update
        this.$emit('vote-cast', { 
            pollId: this.poll.id, 
            optionId: optionId 
        });

        const res = await axios.post(`${this.API_URL}/api/polls/vote`, {
          user_id: userId,
          poll_id: this.poll.id,
          option_id: optionId
        });
        
        if (res.data.success) {
          // Sync with server data (optional if optimistic update is good enough)
           this.$emit('poll-updated', {
               postId: this.postId,
               options: res.data.result.options
           });
        }
      } catch (err) {
        console.error('Vote error:', err);
        alert('Failed to cast vote');
        // Revert optimistic update? For now simpler to just alert.
      } finally {
        this.isVoting = false;
      }
    },
    getPercentage(option) {
      if (this.totalVotes === 0) return 0;
      return Math.round(((option.vote_count || 0) / this.totalVotes) * 100);
    },
    isWinner(option) {
      if (!this.showResults || this.totalVotes === 0) return false;
      const options = this.poll.options || [];
      if (!options.length) return false;
      const maxVotes = Math.max(...options.map(o => o.vote_count || 0));
      return (option.vote_count || 0) === maxVotes;
    }
  }
};
</script>

<style scoped>
.poll-container {
  margin-top: 16px;
  width: 100%;
  background: var(--ion-card-background, #fff);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--ion-border-color, rgba(0,0,0,0.05));
}

body.dark .poll-container {
  background: #15181c;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border-color: #2f3336;
}

.poll-question {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 16px;
  color: #0f1419;
  line-height: 1.4;
}

body.dark .poll-question {
  color: #e7e9ea;
}

.poll-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.poll-option {
  position: relative;
  height: 48px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  background: var(--ion-color-light, #f3f4f6);
  border: 2px solid transparent;
}

body.dark .poll-option {
  background: #2f3336;
}

.poll-option.selectable:active {
  transform: scale(0.98);
}

/* Unvoted State */
.poll-option.selectable {
  background: transparent;
  border: 2px solid var(--ion-color-primary);
}

.poll-option.selectable:hover {
  background: rgba(var(--ion-color-primary-rgb), 0.04);
}

.poll-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: rgba(var(--ion-color-primary-rgb), 0.15);
  z-index: 1;
  transition: width 1s cubic-bezier(0.25, 0.8, 0.25, 1);
  border-radius: 12px 0 0 12px;
}

.poll-option.voted .poll-progress {
   background-color: rgba(var(--ion-color-primary-rgb), 0.25);
}

.poll-option.winner .poll-progress {
   background-color: rgba(var(--ion-color-primary-rgb), 0.35); /* Stronger highlight for winner */
}

.poll-content {
  position: relative;
  height: 100%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-weight: 600;
  font-size: 15px;
  color: #0f1419;
}

body.dark .poll-content {
  color: #e7e9ea;
}

.poll-option.selectable .poll-content {
    color: var(--ion-color-primary);
    font-weight: 700;
}

.poll-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poll-percent {
  font-weight: 800;
  margin-left: 12px;
  font-feature-settings: "tnum";
  font-variant-numeric: tabular-nums;
}

.voted-icon {
  margin-left: 8px;
  font-size: 22px;
  color: var(--ion-color-primary);
  filter: drop-shadow(0 2px 4px rgba(var(--ion-color-primary-rgb), 0.3));
}

.poll-footer {
  margin-top: 16px;
  font-size: 13px;
  color: var(--ion-color-medium);
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.dot {
  font-weight: bold;
  opacity: 0.5;
}
</style>
