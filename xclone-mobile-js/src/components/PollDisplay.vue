<template>
  <div class="poll-container" :class="{ 'battle-mode': isBattleMode }" @click.stop>

    <!-- Live Badge -->
    <div class="poll-header">
      <span v-if="!poll.is_expired" class="live-badge">
        <span class="live-dot"></span>
        Live
      </span>
      <span v-else class="expired-badge">Ended</span>
      <span class="poll-emoji">📊</span>
    </div>

    <!-- Question -->
    <div v-if="poll.question" class="poll-question">{{ poll.question }}</div>

    <!-- === BATTLE MODE (2 options) === -->
    <div v-if="isBattleMode" class="battle-arena">
      <div
        v-for="(option, idx) in poll.options"
        :key="option.id"
        class="battle-option"
        :class="{
          'voted': poll.has_voted && poll.user_voted_option_id === option.id,
          'winner': isWinner(option) && showResults,
          'selectable': !showResults,
          ['color-' + idx]: true
        }"
        @click="handleVote(option.id)"
      >
        <!-- Burst particles -->
        <div v-if="votedOptionId === option.id" class="burst-wrapper">
          <span v-for="n in 8" :key="n" class="burst-particle" :style="getBurstStyle(n)"></span>
        </div>

        <!-- Progress fill (only after voting/expired) -->
        <div
          v-if="showResults"
          class="battle-fill"
          :style="{ width: getPercentage(option) + '%' }"
        ></div>

        <div class="battle-content">
          <span class="crown" v-if="isWinner(option) && showResults">👑</span>
          <span class="battle-label">{{ option.option_text }}</span>
          <span v-if="showResults" class="battle-percent">{{ getPercentage(option) }}%</span>
          <ion-icon v-if="poll.has_voted && poll.user_voted_option_id === option.id" :icon="checkmarkCircle" class="voted-icon"></ion-icon>
        </div>
      </div>

      <div class="vs-divider"><span>VS</span></div>
    </div>

    <!-- === STANDARD MODE === -->
    <div v-else class="poll-options">
      <div
        v-for="(option, idx) in poll.options"
        :key="option.id"
        class="poll-option"
        :class="{
          'voted': poll.has_voted && poll.user_voted_option_id === option.id,
          'winner': isWinner(option) && showResults,
          'selectable': !showResults,
          ['color-' + idx]: true
        }"
        @click="handleVote(option.id)"
      >
        <!-- Burst particles -->
        <div v-if="votedOptionId === option.id" class="burst-wrapper">
          <span v-for="n in 8" :key="n" class="burst-particle" :style="getBurstStyle(n)"></span>
        </div>

        <!-- Progress Bar (only after voting/expired) -->
        <div
          v-if="showResults"
          class="poll-progress"
          :style="{ width: getPercentage(option) + '%' }"
        ></div>

        <!-- Content -->
        <div class="poll-content">
          <div class="poll-label-group">
            <span class="crown" v-if="isWinner(option) && showResults">👑</span>
            <span class="poll-label">{{ option.option_text }}</span>
          </div>
          <div class="poll-right">
            <span v-if="showResults" class="poll-percent">{{ getPercentage(option) }}%</span>
            <ion-icon
              v-if="poll.has_voted && poll.user_voted_option_id === option.id"
              :icon="checkmarkCircle"
              class="voted-icon"
            ></ion-icon>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="poll-footer">
      <span class="vote-count">
        <span class="vote-num" :class="{ 'count-pop': justVoted }">{{ totalVotes }}</span>
        {{ totalVotes === 1 ? 'vote' : 'votes' }}
      </span>
      <span class="dot">•</span>
      <span class="time-left">{{ timeLeft }}</span>

      <!-- Countdown Ring -->
      <svg v-if="!poll.is_expired && countdownPercent !== null" class="countdown-ring" viewBox="0 0 24 24">
        <circle class="ring-bg" cx="12" cy="12" r="10" />
        <circle
          class="ring-fill"
          cx="12" cy="12" r="10"
          :stroke-dasharray="`${countdownPercent * 62.83 / 100} 62.83`"
          :style="{ stroke: countdownPercent > 30 ? '#1d9bf0' : countdownPercent > 10 ? '#f59e0b' : '#ef4444' }"
        />
      </svg>
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
  components: { IonIcon },
  props: {
    poll: { type: Object, required: true },
    postId: { type: String, required: true }
  },
  data() {
    return {
      isVoting: false,
      votedOptionId: null,
      justVoted: false,
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
    isBattleMode() {
      return (this.poll.options || []).length === 2;
    },
    timeLeft() {
      if (this.poll.is_expired) return 'Final results';
      if (!this.poll.expires_at) return '';
      // Use native Date parsing — browsers handle ISO 8601 with Z correctly
      const expiresAt = new Date(this.poll.expires_at);
      if (isNaN(expiresAt.getTime())) return '';
      const now = new Date();
      const diffMs = expiresAt - now;
      if (diffMs <= 0) return 'Final results';
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHrs = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHrs / 24);
      if (diffDays > 0) return `${diffDays}d left`;
      if (diffHrs > 0) return `${diffHrs}h left`;
      if (diffMins > 0) return `${diffMins}m left`;
      return 'Ending soon';
    },
    countdownPercent() {
      if (this.poll.is_expired || !this.poll.expires_at || !this.poll.created_at) return null;
      const start = new Date(this.poll.created_at);
      const end = new Date(this.poll.expires_at);
      const now = new Date();
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
      const total = end - start;
      const elapsed = now - start;
      if (total <= 0) return null;
      return Math.max(0, Math.min(100, 100 - (elapsed / total) * 100));
    }
  },
  methods: {
    async handleVote(optionId) {
      if (this.showResults || this.isVoting) return;
      try {
        this.isVoting = true;
        this.votedOptionId = optionId;
        const userId = localStorage.getItem('userId');
        this.$emit('vote-cast', { pollId: this.poll.id, optionId });
        this.justVoted = false;
        this.$nextTick(() => { this.justVoted = true; });
        setTimeout(() => { this.justVoted = false; }, 800);
        setTimeout(() => { this.votedOptionId = null; }, 900);
        const res = await axios.post(`${this.API_URL}/api/polls/vote`, {
          user_id: userId,
          poll_id: this.poll.id,
          option_id: optionId
        });
        if (res.data.success) {
          this.$emit('poll-updated', { postId: this.postId, options: res.data.result.options });
        }
      } catch (err) {
        console.error('Vote error:', err);
        alert('Failed to cast vote');
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
      const maxVotes = Math.max(...(this.poll.options || []).map(o => o.vote_count || 0));
      return (option.vote_count || 0) === maxVotes;
    },
    getBurstStyle(n) {
      const angle = (n - 1) * 45;
      const colors = ['#f91880','#1d9bf0','#ffd400','#00ba7c','#7856ff','#ff7a00','#ff004f','#00cfff'];
      return { '--angle': `${angle}deg`, '--color': colors[n - 1] };
    }
  }
};
</script>

<style scoped>
/* ==================== CONTAINER ==================== */
.poll-container {
  margin-top: 14px;
  width: 100%;
  background: #ffffff;
  border-radius: 18px;
  padding: 14px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.07);
  border: 1px solid #e4e6eb;
  position: relative;
  overflow: visible;
}

body.dark .poll-container {
  background: #1e2128;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  border-color: #3a3d44;
}

/* ==================== HEADER ==================== */
.poll-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(135deg, #ff3c5f, #f91880);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(249,24,128, 0.45);
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  animation: pulse-dot 1.2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.7); }
}

.expired-badge {
  display: inline-flex;
  align-items: center;
  background: #e4e6eb;
  color: #555;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
}

body.dark .expired-badge {
  background: #3a3d44;
  color: #aaa;
}

.poll-emoji {
  font-size: 18px;
  margin-left: auto;
}

/* ==================== QUESTION ==================== */
.poll-question {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 12px;
  color: #0f1419;
  line-height: 1.4;
}

body.dark .poll-question { color: #e7e9ea; }

/* ==================== OPTION COLORS ====================
   Use opaque theme-aware backgrounds — vivid on both light & dark.
*/
.color-0 { --opt-color-a: #7856ff; --opt-color-b: #b04bff; --opt-bg-light: #ede8ff; --opt-bg-dark: #2e2550; --opt-border-light: #a488ff; --opt-border-dark: #7856ff; }
.color-1 { --opt-color-a: #1d9bf0; --opt-color-b: #00cfff; --opt-bg-light: #dff1fd; --opt-bg-dark: #10303f; --opt-border-light: #6cc6fa; --opt-border-dark: #1d9bf0; }
.color-2 { --opt-color-a: #f91880; --opt-color-b: #ff7043; --opt-bg-light: #fde0ee; --opt-bg-dark: #3d1025; --opt-border-light: #fb6db1; --opt-border-dark: #f91880; }
.color-3 { --opt-color-a: #00ba7c; --opt-color-b: #00e5a0; --opt-bg-light: #d5f5ea; --opt-bg-dark: #0a2e20; --opt-border-light: #45d49a; --opt-border-dark: #00ba7c; }

/* Light: use light bg + light border */
.poll-option, .battle-option {
  border-color: var(--opt-border-light);
  background: var(--opt-bg-light);
}

/* Dark: use dark bg + vivid border */
body.dark .poll-option,
body.dark .battle-option {
  border-color: var(--opt-border-dark);
  background: var(--opt-bg-dark);
}

/* ==================== STANDARD OPTIONS ==================== */
.poll-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.poll-option {
  position: relative;
  min-height: 30px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease;
  border: 2px solid var(--opt-border-light);
}

.poll-option.selectable:active { transform: scale(0.97); }

.poll-option.selectable:hover {
  box-shadow: 0 4px 14px rgba(0,0,0,0.12);
  transform: translateY(-1px);
}

.poll-option.voted {
  border-color: var(--opt-color-a);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--opt-color-a) 25%, transparent);
}

.poll-option.winner {
  box-shadow: 0 4px 18px color-mix(in srgb, var(--opt-color-a) 30%, transparent),
              0 0 0 2px var(--opt-color-a);
}

/* ==================== PROGRESS BAR ==================== */
.poll-progress {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--opt-color-a), var(--opt-color-b));
  opacity: 0.28;
  z-index: 1;
  border-radius: 10px 0 0 10px;
  transition: width 1.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}

body.dark .poll-progress { opacity: 0.45; }

.poll-option.voted .poll-progress  { opacity: 0.38; }
.poll-option.winner .poll-progress { opacity: 0.52; }

body.dark .poll-option.voted .poll-progress  { opacity: 0.55; }
body.dark .poll-option.winner .poll-progress { opacity: 0.7; }

/* ==================== CONTENT ==================== */
.poll-content {
  position: relative;
  min-height: 30px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
}

.poll-label-group {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.poll-label {
  font-weight: 600;
  font-size: 14px;
  color: #0f1419;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 30px;
}

body.dark .poll-label { color: #e7e9ea; }

.poll-option.selectable .poll-label {
  color: var(--opt-color-a);
  font-weight: 700;
}

body.dark .poll-option.selectable .poll-label {
  /* stays as vivid color — already bright enough on dark */
  color: var(--opt-color-a);
}

.poll-right {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.poll-percent {
  font-weight: 800;
  font-size: 14px;
  color: var(--opt-color-a);
  font-feature-settings: "tnum";
  font-variant-numeric: tabular-nums;
}

.voted-icon {
  font-size: 18px;
  color: var(--opt-color-a);
}

.crown {
  font-size: 14px;
  animation: crown-float 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes crown-float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-3px); }
}

/* ==================== BURST ANIMATION ==================== */
.burst-wrapper {
  position: absolute;
  top: 50%; left: 50%;
  width: 0; height: 0;
  z-index: 10;
  pointer-events: none;
}

.burst-particle {
  position: absolute;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--color);
  animation: burst-fly 0.7s ease-out forwards;
}

@keyframes burst-fly {
  0%   { transform: rotate(var(--angle)) translateX(0) scale(1); opacity: 1; }
  100% { transform: rotate(var(--angle)) translateX(34px) scale(0); opacity: 0; }
}

/* ==================== BATTLE MODE ==================== */
.battle-arena {
  display: flex;
  gap: 10px;
  position: relative;
}

.battle-option {
  flex: 1;
  position: relative;
  min-height: 44px;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
  border: 2px solid var(--opt-border-light);
}

.battle-option.selectable:active { transform: scale(0.96); }
.battle-option.selectable:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 18px rgba(0,0,0,0.14);
}

.battle-fill {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  width: 0;
  background: linear-gradient(90deg, var(--opt-color-a), var(--opt-color-b));
  opacity: 0.3;
  transition: width 1.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}

body.dark .battle-fill { opacity: 0.5; }

.battle-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 44px;
  gap: 2px;
  padding: 6px 8px;
  text-align: center;
}

.battle-label {
  font-weight: 700;
  font-size: 13px;
  color: #0f1419;
  word-break: break-word;
  line-height: 1.2;
}

body.dark .battle-label { color: #e7e9ea; }
.battle-option.selectable .battle-label { color: var(--opt-color-a); }

.battle-percent {
  font-size: 16px;
  font-weight: 900;
  color: var(--opt-color-a);
  font-feature-settings: "tnum";
}

.vs-divider {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 28px; height: 28px;
  background: linear-gradient(135deg, #f91880, #7856ff);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 9px;
  font-weight: 900;
  z-index: 5;
  box-shadow: 0 2px 8px rgba(249,24,128, 0.5);
  pointer-events: none;
}

/* ==================== FOOTER ==================== */
.poll-footer {
  margin-top: 12px;
  font-size: 12px;
  color: #687684;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

body.dark .poll-footer { color: #8b98a5; }

.vote-count { display: flex; align-items: center; gap: 3px; }

.vote-num {
  font-weight: 800;
  color: #0f1419;
  font-feature-settings: "tnum";
}

body.dark .vote-num { color: #e7e9ea; }

.vote-num.count-pop {
  animation: count-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes count-pop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.4); }
  100% { transform: scale(1); }
}

.dot { font-weight: bold; opacity: 0.35; }

.time-left { color: #687684; }
body.dark .time-left { color: #8b98a5; }

/* ==================== COUNTDOWN RING ==================== */
.countdown-ring {
  width: 20px; height: 20px;
  margin-left: auto;
  transform: rotate(-90deg);
  flex-shrink: 0;
}

.ring-bg {
  fill: none;
  stroke: #dde0e4;
  stroke-width: 3;
}

body.dark .ring-bg { stroke: #3a3d44; }

.ring-fill {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 1s ease, stroke 0.5s ease;
}
</style>
