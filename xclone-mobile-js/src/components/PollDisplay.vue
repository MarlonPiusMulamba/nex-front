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
  margin-top: 12px;
  width: 100%;
}

.poll-question {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 12px;
  color: #000;
}

body.dark .poll-question {
  color: #fff;
}

.poll-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.poll-option {
  position: relative;
  height: 44px; /* Increased height */
  border-radius: 8px; /* Slightly more rounded */
  border: 1px solid var(--ion-color-primary); /* Always outline primary for unvoted */
  overflow: hidden;
  cursor: pointer;
  transition: opacity 0.2s;
}

.poll-option.selectable:active {
  background-color: rgba(var(--ion-color-primary-rgb), 0.1);
}

.poll-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: rgba(var(--ion-color-primary-rgb), 0.12); /* Light primary tint */
  z-index: 1;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.poll-option.voted .poll-progress {
   background-color: rgba(var(--ion-color-primary-rgb), 0.2);
}

/* Winner styling enhancement? maybe later */

.poll-content {
  position: relative;
  height: 100%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-weight: 600; /* Bolder text matching X */
  color: var(--ion-color-primary); /* Primary colored text default */
}

body.dark .poll-content {
    color: var(--ion-color-primary);
}

/* When showing results, switch to neutral colors unless winner/voted */
.poll-option:not(.selectable) {
    border-color: transparent; /* Remove border when showing results, or keep simplified */
    background-color: #f3f4f6; /* Light gray background base */
}

body.dark .poll-option:not(.selectable) {
    background-color: #2f3336; /* Dark gray */
}

/* Re-apply colored progress */
.poll-option:not(.selectable) .poll-content {
    color: #0f1419;
}
body.dark .poll-option:not(.selectable) .poll-content {
    color: #e7e9ea;
}


.poll-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poll-percent {
  font-weight: 700;
  margin-left: 8px;
}

.voted-icon {
  margin-left: 8px;
  font-size: 20px;
  color: var(--ion-color-primary);
}

.poll-footer {
  margin-top: 12px;
  font-size: 14px;
  color: var(--ion-color-medium);
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot {
  font-weight: bold;
}
</style>
