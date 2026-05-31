<template>
  <div class="poll-card" :class="{ 'battle-mode': isBattleMode, 'is-expired': poll.is_expired }" @click.stop>

    <!-- Header Row -->
    <div class="poll-header">
      <div class="poll-meta-left">
        <span class="poll-type-badge" :class="isBattleMode ? 'badge-battle' : 'badge-poll'">
          <span v-if="!isBattleMode">📊 Poll</span>
          <span v-else>⚔️ Battle</span>
        </span>
        <span v-if="!poll.is_expired" class="live-chip">
          <span class="live-dot"></span>
          LIVE
        </span>
        <span v-else class="ended-chip">ENDED</span>
      </div>
      <div class="poll-timer" v-if="!poll.is_expired">
        <svg class="timer-ring" viewBox="0 0 32 32">
          <circle class="ring-track" cx="16" cy="16" r="13"/>
          <circle class="ring-progress" cx="16" cy="16" r="13"
            :stroke-dasharray="`${countdownPercent * 81.68 / 100} 81.68`"
            :style="{ stroke: timerColor }"/>
        </svg>
        <span class="timer-label" :style="{ color: timerColor }">{{ timeLeft }}</span>
      </div>
      <span v-else class="final-label">Final Results</span>
    </div>

    <!-- Question -->
    <h3 v-if="poll.question" class="poll-question">{{ poll.question }}</h3>

    <!-- ── BATTLE MODE ── -->
    <div v-if="isBattleMode" class="battle-arena">
      <div
        v-for="(option, idx) in poll.options"
        :key="option.id"
        class="battle-side"
        :class="[
          `side-${idx}`,
          { 'winner-side': isWinner(option) && showResults, 'my-vote': poll.user_voted_option_id === option.id }
        ]"
        @click="handleVote(option.id)"
      >
        <!-- Burst confetti -->
        <div v-if="votedOptionId === option.id" class="burst">
          <span v-for="n in 10" :key="n" class="burst-dot" :style="burstStyle(n)"></span>
        </div>

        <!-- Fill bar -->
        <div v-if="showResults" class="battle-fill" :style="{ height: getPercentage(option) + '%' }"></div>

        <div class="battle-body">
          <span v-if="isWinner(option) && showResults" class="crown-icon">👑</span>
          <span class="battle-text">{{ option.option_text }}</span>
          <template v-if="showResults">
            <span class="battle-pct">{{ getPercentage(option) }}%</span>
            <span class="battle-votes">{{ option.vote_count || 0 }} votes</span>
          </template>
          <ion-icon v-if="poll.user_voted_option_id === option.id" :icon="checkmarkCircle" class="my-check"/>
        </div>
      </div>

      <!-- VS badge -->
      <div class="vs-badge">VS</div>
    </div>

    <!-- ── STANDARD MODE ── -->
    <div v-else class="options-list">
      <div
        v-for="(option, idx) in poll.options"
        :key="option.id"
        class="option-row"
        :class="[
          `opt-${idx}`,
          {
            'my-vote': poll.user_voted_option_id === option.id,
            'is-winner': isWinner(option) && showResults,
            'can-vote': !showResults
          }
        ]"
        @click="handleVote(option.id)"
      >
        <!-- Animated progress fill -->
        <div v-if="showResults" class="option-fill" :style="{ width: getPercentage(option) + '%' }"></div>

        <!-- Burst -->
        <div v-if="votedOptionId === option.id" class="burst">
          <span v-for="n in 8" :key="n" class="burst-dot" :style="burstStyle(n)"></span>
        </div>

        <div class="option-content">
          <!-- Left: color indicator + text -->
          <div class="option-left">
            <span class="opt-dot"></span>
            <span v-if="isWinner(option) && showResults" class="crown-icon">👑</span>
            <span class="option-text">{{ option.option_text }}</span>
          </div>
          <!-- Right: checkmark + percentage -->
          <div class="option-right">
            <ion-icon
              v-if="poll.user_voted_option_id === option.id"
              :icon="checkmarkCircle"
              class="my-check"
            />
            <span v-if="showResults" class="option-pct">{{ getPercentage(option) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="poll-footer">
      <div class="footer-votes">
        <span class="votes-num" :class="{ pop: justVoted }">{{ totalVotes }}</span>
        <span class="votes-label">{{ totalVotes === 1 ? 'vote' : 'votes' }}</span>
      </div>
      <div class="footer-sep"></div>
      <div class="footer-hint" v-if="!showResults">
        Tap to vote
      </div>
      <div class="footer-hint" v-else-if="poll.has_voted">
        Your response is recorded
      </div>
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
      return (this.poll.options || []).reduce((a, o) => a + (o.vote_count || 0), 0);
    },
    isBattleMode() {
      return (this.poll.options || []).length === 2;
    },
    timeLeft() {
      if (this.poll.is_expired) return 'Ended';
      if (!this.poll.expires_at) return '';
      const diff = new Date(this.poll.expires_at) - new Date();
      if (diff <= 0) return 'Ended';
      const m = Math.floor(diff / 60000);
      const h = Math.floor(m / 60);
      const d = Math.floor(h / 24);
      if (d > 0) return `${d}d`;
      if (h > 0) return `${h}h`;
      if (m > 0) return `${m}m`;
      return '<1m';
    },
    countdownPercent() {
      if (this.poll.is_expired || !this.poll.expires_at || !this.poll.created_at) return 0;
      const start = new Date(this.poll.created_at);
      const end = new Date(this.poll.expires_at);
      const now = new Date();
      const total = end - start;
      if (total <= 0) return 0;
      return Math.max(0, Math.min(100, 100 - ((now - start) / total) * 100));
    },
    timerColor() {
      const p = this.countdownPercent;
      if (p > 50) return '#22c55e';
      if (p > 20) return '#f59e0b';
      return '#ef4444';
    }
  },
  methods: {
    async handleVote(optionId) {
      if (this.showResults || this.isVoting) return;
      this.isVoting = true;
      this.votedOptionId = optionId;
      this.$emit('vote-cast', { pollId: this.poll.id, optionId });
      this.justVoted = false;
      this.$nextTick(() => { this.justVoted = true; });
      setTimeout(() => { this.justVoted = false; }, 900);
      setTimeout(() => { this.votedOptionId = null; }, 1000);
      try {
        const res = await axios.post(`${this.API_URL}/api/polls/vote`, {
          user_id: localStorage.getItem('userId'),
          poll_id: this.poll.id,
          option_id: optionId
        });
        if (res.data.success) {
          this.$emit('poll-updated', { postId: this.postId, options: res.data.result.options });
        }
      } catch (e) {
        console.error('Vote error:', e);
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
      const max = Math.max(...(this.poll.options || []).map(o => o.vote_count || 0));
      return (option.vote_count || 0) === max;
    },
    burstStyle(n) {
      const angle = (n - 1) * (360 / 10);
      const colors = ['#f91880','#1d9bf0','#ffd400','#00ba7c','#7856ff','#ff7a00','#ff004f','#00cfff','#a78bfa','#34d399'];
      return { '--angle': `${angle}deg`, '--color': colors[(n - 1) % colors.length] };
    }
  }
};
</script>

<style scoped>
/* ── Google Font ─────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

/* ── Card ─────────────────────────────────────────── */
.poll-card {
  font-family: 'Inter', sans-serif;
  margin-top: 14px;
  width: 100%;
  border-radius: 20px;
  padding: 18px 16px 14px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 24px rgba(0,0,0,0.07);
  position: relative;
  overflow: visible;
  transition: box-shadow 0.3s ease;
}
body.dark .poll-card {
  background: #16181c;
  border-color: #2f3336;
  box-shadow: 0 4px 28px rgba(0,0,0,0.4);
}
.poll-card.battle-mode { border-color: transparent; }

/* ── Header ────────────────────────────────────────── */
.poll-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 8px;
}
.poll-meta-left { display: flex; align-items: center; gap: 8px; }

/* type badge */
.poll-type-badge {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 99px;
}
.badge-poll { background: #ede9fe; color: #7c3aed; }
.badge-battle { background: #fee2e2; color: #dc2626; }
body.dark .badge-poll { background: #2e2550; color: #c4b5fd; }
body.dark .badge-battle { background: #3d0f0f; color: #f87171; }

/* live chip */
.live-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(135deg, #ef4444, #f91880);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  padding: 3px 8px;
  border-radius: 99px;
  text-transform: uppercase;
  box-shadow: 0 0 10px rgba(249,24,128,0.4);
}
.live-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #fff;
  animation: blink 1.2s infinite;
}
@keyframes blink {
  0%,100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.ended-chip {
  font-size: 10px; font-weight: 700;
  padding: 3px 9px; border-radius: 99px;
  background: #f3f4f6; color: #6b7280;
  text-transform: uppercase; letter-spacing: 0.5px;
}
body.dark .ended-chip { background: #374151; color: #9ca3af; }

/* timer */
.poll-timer {
  display: flex; align-items: center; gap: 6px;
}
.timer-ring { width: 26px; height: 26px; transform: rotate(-90deg); }
.ring-track { fill: none; stroke: #e5e7eb; stroke-width: 3; }
body.dark .ring-track { stroke: #374151; }
.ring-progress { fill: none; stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray 1s ease, stroke 0.5s ease; }
.timer-label { font-size: 12px; font-weight: 800; }

.final-label { font-size: 12px; font-weight: 700; color: #6b7280; }
body.dark .final-label { color: #9ca3af; }

/* ── Question ─────────────────────────────────────── */
.poll-question {
  font-size: 17px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 16px;
  line-height: 1.4;
}
body.dark .poll-question { color: #f9fafb; }

/* ── Standard Options ─────────────────────────────── */
.options-list { display: flex; flex-direction: column; gap: 10px; }

/* option color palette using CSS vars */
.opt-0 { --c1: #7c3aed; --c2: #a855f7; --bg: #ede9fe; --bgd: #1e1540; --border: #c4b5fd; --borderd: #7c3aed; }
.opt-1 { --c1: #0ea5e9; --c2: #38bdf8; --bg: #e0f2fe; --bgd: #082f49; --border: #7dd3fc; --borderd: #0ea5e9; }
.opt-2 { --c1: #f43f5e; --c2: #fb7185; --bg: #ffe4e6; --bgd: #4c0519; --border: #fda4af; --borderd: #f43f5e; }
.opt-3 { --c1: #10b981; --c2: #34d399; --bg: #d1fae5; --bgd: #064e3b; --border: #6ee7b7; --borderd: #10b981; }

.option-row {
  position: relative;
  min-height: 48px;
  border-radius: 14px;
  overflow: hidden;
  border: 2px solid var(--border);
  background: var(--bg);
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease;
}
body.dark .option-row {
  border-color: var(--borderd);
  background: var(--bgd);
}
.option-row.can-vote:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.12); }
.option-row.can-vote:active { transform: scale(0.97); }
.option-row.my-vote { border-color: var(--c1); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c1) 20%, transparent); }
.option-row.is-winner { box-shadow: 0 0 0 2px var(--c1), 0 6px 20px color-mix(in srgb, var(--c1) 25%, transparent); }

/* fill bar */
.option-fill {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--c1), var(--c2));
  opacity: 0.22;
  z-index: 1;
  border-radius: 12px 0 0 12px;
  transition: width 1.4s cubic-bezier(.25,.8,.25,1);
}
body.dark .option-fill { opacity: 0.38; }
.option-row.my-vote .option-fill { opacity: 0.32; }
.option-row.is-winner .option-fill { opacity: 0.46; }

/* content layer */
.option-content {
  position: relative; z-index: 2;
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  height: 48px;
}
.option-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.opt-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c1), var(--c2));
  flex-shrink: 0;
  box-shadow: 0 0 6px color-mix(in srgb, var(--c1) 60%, transparent);
}
.option-text {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
body.dark .option-text { color: #f9fafb; }
.option-row.can-vote .option-text { color: var(--c1); }

.option-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.option-pct {
  font-size: 15px; font-weight: 900;
  color: var(--c1);
  font-variant-numeric: tabular-nums;
  min-width: 38px; text-align: right;
}
.my-check { font-size: 18px; color: var(--c1); }
.crown-icon { font-size: 14px; animation: float 2s ease-in-out infinite; flex-shrink: 0; }
@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }

/* ── Battle Mode ─────────────────────────────────── */
.battle-arena {
  position: relative;
  display: flex;
  gap: 10px;
  height: 120px;
}
.battle-side {
  flex: 1;
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: flex-end;
  transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease;
  border: 2px solid transparent;
}
.side-0 { background: linear-gradient(160deg, #4c1d95, #7c3aed); }
.side-1 { background: linear-gradient(160deg, #0c4a6e, #0ea5e9); }

.battle-side.my-vote { border-color: #fde047; box-shadow: 0 0 0 3px rgba(253,224,71,0.3), inset 0 0 20px rgba(255,255,255,0.1); }
.battle-side.winner-side { box-shadow: 0 8px 32px rgba(255,215,0,0.4); }
.battle-side:hover { transform: translateY(-3px) scale(1.01); }
.battle-side:active { transform: scale(0.97); }

/* animated fill from bottom */
.battle-fill {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: rgba(255,255,255,0.15);
  transition: height 1.4s cubic-bezier(.25,.8,.25,1);
  backdrop-filter: blur(4px);
}
.battle-body {
  position: relative; z-index: 2;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  width: 100%; height: 100%;
  padding: 10px 8px;
  gap: 2px; text-align: center;
}
.battle-text {
  font-size: 13px; font-weight: 800;
  color: rgba(255,255,255,0.95);
  line-height: 1.2; word-break: break-word;
}
.battle-pct {
  font-size: 22px; font-weight: 900;
  color: #fff; line-height: 1;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.battle-votes { font-size: 10px; color: rgba(255,255,255,0.7); font-weight: 600; }
.battle-side .my-check { font-size: 20px; color: #fde047; }

/* VS badge */
.vs-badge {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%,-50%);
  width: 34px; height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f91880, #7c3aed);
  color: #fff; font-size: 10px; font-weight: 900;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(249,24,128,0.5);
  z-index: 10; pointer-events: none;
  border: 2px solid #fff;
  letter-spacing: 0.5px;
}

/* ── Burst confetti ──────────────────────────────── */
.burst { position: absolute; top: 50%; left: 50%; width: 0; height: 0; pointer-events: none; z-index: 20; }
.burst-dot {
  position: absolute; width: 8px; height: 8px;
  border-radius: 50%; background: var(--color);
  animation: burst-out 0.7s ease-out forwards;
}
@keyframes burst-out {
  0% { transform: rotate(var(--angle)) translateX(0) scale(1); opacity: 1; }
  100% { transform: rotate(var(--angle)) translateX(36px) scale(0); opacity: 0; }
}

/* ── Footer ──────────────────────────────────────── */
.poll-footer {
  display: flex; align-items: center; gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
}
body.dark .poll-footer { border-top-color: #2f3336; }

.footer-votes { display: flex; align-items: baseline; gap: 4px; }
.votes-num {
  font-size: 15px; font-weight: 900;
  color: #111827;
  font-variant-numeric: tabular-nums;
  transition: transform 0.3s;
}
body.dark .votes-num { color: #f9fafb; }
.votes-num.pop { animation: num-pop 0.5s cubic-bezier(.34,1.56,.64,1); }
@keyframes num-pop { 0%{transform:scale(1)} 50%{transform:scale(1.5)} 100%{transform:scale(1)} }
.votes-label { font-size: 13px; color: #6b7280; font-weight: 500; }
body.dark .votes-label { color: #9ca3af; }

.footer-sep { width: 1px; height: 14px; background: #e5e7eb; margin: 0 2px; }
body.dark .footer-sep { background: #374151; }

.footer-hint { font-size: 12px; color: #9ca3af; font-weight: 500; }
</style>
