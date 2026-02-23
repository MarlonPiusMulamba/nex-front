<template>
  <div class="voice-drop" :class="[isSent ? 'vd-sent' : 'vd-recv', voiceMoodClass]">

    <!-- Mood badge -->
    <div v-if="displayMood" class="vd-mood-badge" :class="'vdmb-' + displayMood">
      {{ moodConfig[displayMood]?.icon }} {{ moodConfig[displayMood]?.label }}
    </div>

    <!-- Main player card -->
    <div class="vd-card">
      <button class="vd-play-btn" @click="togglePlay" :class="{ 'vd-playing': isPlaying }">
        <svg v-if="isPlaying" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      </button>

      <div class="vd-waveform-area" ref="waveArea">
        <canvas
          ref="waveCanvas"
          class="vd-canvas"
          :width="canvasW"
          height="44"
          @click="onCanvasClick"
        ></canvas>
        <div class="vd-time-row">
          <span class="vd-cur-time">{{ fmtSec(currentSec) }}</span>
          <span class="vd-tot-time">{{ fmtSec(totalSec) }}</span>
        </div>
      </div>

      <!-- Insight Mode toggle — visible only if transcript exists -->
      <button
        v-if="msg.transcript"
        class="vd-insight-btn"
        :class="{ 'vd-insight-active': showInsight }"
        @click="showInsight = !showInsight"
        title="Insight Mode"
      >💡</button>
    </div>

    <!-- Insight Mode: scrolling transcript -->
    <transition name="vd-expand">
      <div v-if="showInsight && msg.transcript" class="vd-transcript-panel">
        <div class="vd-transcript-header">
          <span class="vd-ts-label">📝 Transcript</span>
          <span v-if="displayMood" class="vd-ts-mood">
            {{ moodConfig[displayMood]?.icon }} {{ moodConfig[displayMood]?.label }}
          </span>
        </div>
        <p class="vd-transcript-text" v-html="highlighted"></p>
      </div>
    </transition>
  </div>
</template>

<script>
const MOOD_CONFIG = {
  passionate: { icon: '🔥', label: 'Passionate', color: '#ff6b35' },
  calm:       { icon: '😌', label: 'Calm',       color: '#00c9a7' },
  thoughtful: { icon: '🧠', label: 'Thoughtful', color: '#6c63ff' },
  urgent:     { icon: '⚡', label: 'Urgent',      color: '#ef4444' },
};

const STOP_WORDS = new Set([
  'the','a','an','is','it','in','on','at','to','for','of','and',
  'or','but','with','this','that','was','are','be','have','had',
  'has','i','you','we','he','she','they','my','your','our','its',
  'so','if','do','just','can','will','not','no','me','him','her',
]);

export default {
  name: 'VoiceDrop',
  props: {
    msg:    { type: Object,  required: true },
    isSent: { type: Boolean, default: false },
  },
  emits: ['reply-timestamp'],

  data() {
    return {
      isPlaying:       false,
      currentSec:      0,
      totalSec:        0,
      waveformBars:    [],
      canvasW:         200,
      showInsight:     false,
      audioCtx:        null,
      sourceNode:      null,
      analyser:        null,
      audioBuffer:     null,
      playStartTime:   0,
      playStartOffset: 0,
      animFrameId:     null,
      moodConfig:      MOOD_CONFIG,
      liveAmplitude:   0,
    };
  },

  computed: {
    displayMood() {
      return this.msg.voice_mood || null;
    },
    voiceMoodClass() {
      return this.displayMood ? 'vd-mood-' + this.displayMood : '';
    },
    highlighted() {
      return this.highlightKeyPhrases(this.msg.transcript || '');
    },
  },

  mounted() {
    this.$nextTick(() => {
      this.measureCanvas();
      this.loadAudio();
    });
    window.addEventListener('resize', this.measureCanvas);
  },

  beforeUnmount() {
    this.stopPlayback();
    window.removeEventListener('resize', this.measureCanvas);
    if (this.audioCtx) { try { this.audioCtx.close(); } catch (_) {} }
  },

  methods: {
    measureCanvas() {
      const area = this.$refs.waveArea;
      if (area) this.canvasW = Math.max(area.clientWidth, 120);
      this.$nextTick(() => this.drawWaveform());
    },

    async loadAudio() {
      if (!this.msg.voice) { this.totalSec = this.msg.duration || 0; return; }
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.audioCtx = ctx;

        // base64 → ArrayBuffer
        const b64 = this.msg.voice.includes(',')
          ? this.msg.voice.split(',')[1]
          : this.msg.voice;
        const raw = atob(b64);
        const buf = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);

        this.audioBuffer = await ctx.decodeAudioData(buf.buffer);
        this.totalSec = this.audioBuffer.duration;
        this.extractWaveform();
      } catch (_) {
        this.totalSec = this.msg.duration || 0;
        this.generatePlaceholderWaveform();
      }
      this.drawWaveform();
    },

    extractWaveform() {
      const channel  = this.audioBuffer.getChannelData(0);
      const numBars  = Math.max(30, Math.floor(this.canvasW / 5));
      const blkSize  = Math.floor(channel.length / numBars);
      const bars     = [];
      for (let i = 0; i < numBars; i++) {
        let s = 0;
        for (let j = 0; j < blkSize; j++) s += Math.abs(channel[i * blkSize + j] || 0);
        bars.push(s / blkSize);
      }
      const mx = Math.max(...bars, 0.001);
      this.waveformBars = bars.map(v => v / mx);
    },

    generatePlaceholderWaveform() {
      const n = Math.max(30, Math.floor(this.canvasW / 5));
      this.waveformBars = Array.from({ length: n }, (_, i) =>
        0.25 + 0.6 * Math.abs(Math.sin(i * 0.55 + 0.7))
      );
    },

    drawWaveform() {
      const canvas = this.$refs.waveCanvas;
      if (!canvas) return;
      const ctx  = canvas.getContext('2d');
      const W    = canvas.width;
      const H    = canvas.height;
      const bars = this.waveformBars.length ? this.waveformBars : this.generatePlaceholderWaveform() || [];
      const pct  = this.totalSec > 0 ? this.currentSec / this.totalSec : 0;
      const amp  = this.liveAmplitude / 255; // 0-1

      const MOOD_COLORS = {
        passionate: '#ff6b35', calm: '#00c9a7',
        thoughtful: '#6c63ff', urgent: '#ef4444',
      };
      const activeColor   = this.displayMood
        ? MOOD_COLORS[this.displayMood]
        : (this.isSent ? 'rgba(0,0,0,0.8)' : '#daa520');
      const inactiveColor = this.isSent
        ? 'rgba(0,0,0,0.18)'
        : 'rgba(255,255,255,0.18)';

      ctx.clearRect(0, 0, W, H);
      const barW = W / bars.length;

      bars.forEach((v, i) => {
        const barPct = i / bars.length;
        const h      = Math.max(3, (v + amp * 0.15) * (H - 8));
        const x      = i * barW;
        const y      = (H - h) / 2;
        const active = barPct <= pct;

        if (active && this.isPlaying) {
          ctx.shadowBlur  = 8 + amp * 10;
          ctx.shadowColor = activeColor;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = active ? activeColor : inactiveColor;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x + 1, y, barW - 2, h, 2);
        } else {
          ctx.rect(x + 1, y, barW - 2, h);
        }
        ctx.fill();
      });
      ctx.shadowBlur = 0;
    },

    async togglePlay() {
      if (!this.audioBuffer) await this.loadAudio();
      if (!this.audioBuffer) return;
      this.isPlaying ? this.stopPlayback() : this.startPlayback(this.currentSec);
    },

    startPlayback(offset = 0) {
      if (!this.audioBuffer || !this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      this.analyser          = this.audioCtx.createAnalyser();
      this.analyser.fftSize  = 256;
      this.sourceNode        = this.audioCtx.createBufferSource();
      this.sourceNode.buffer = this.audioBuffer;
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);

      this.playStartOffset = offset;
      this.playStartTime   = this.audioCtx.currentTime;
      this.sourceNode.start(0, offset);
      this.isPlaying = true;

      this.sourceNode.onended = () => {
        if (this.isPlaying) { this.isPlaying = false; this.currentSec = 0; this.drawWaveform(); }
      };
      this.animatePlayback();
    },

    stopPlayback() {
      if (this.sourceNode) {
        try { this.sourceNode.stop(); } catch (_) {}
        try { this.sourceNode.disconnect(); } catch (_) {}
        this.sourceNode = null;
      }
      if (this.animFrameId) { cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
      this.isPlaying = false;
    },

    animatePlayback() {
      if (!this.isPlaying) return;
      this.currentSec = this.playStartOffset + (this.audioCtx.currentTime - this.playStartTime);
      if (this.currentSec >= this.totalSec) {
        this.isPlaying = false; this.currentSec = 0; this.liveAmplitude = 0;
        this.drawWaveform(); return;
      }
      if (this.analyser) {
        const d = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(d);
        this.liveAmplitude = d.reduce((a, b) => a + b, 0) / d.length;
      }
      this.drawWaveform();
      this.animFrameId = requestAnimationFrame(() => this.animatePlayback());
    },

    onCanvasClick(e) {
      const canvas = this.$refs.waveCanvas;
      if (!canvas || !this.totalSec) return;
      const rect   = canvas.getBoundingClientRect();
      const seekSec = ((e.clientX - rect.left) / rect.width) * this.totalSec;
      const excerpt = this.getTranscriptExcerpt(seekSec);

      // emit for reply-at-timestamp
      this.$emit('reply-timestamp', { msg: this.msg, seconds: Math.round(seekSec), excerpt });

      const wasPlaying = this.isPlaying;
      if (wasPlaying) this.stopPlayback();
      this.currentSec = seekSec;
      this.drawWaveform();
      if (wasPlaying) this.startPlayback(seekSec);
    },

    getTranscriptExcerpt(sec) {
      if (!this.msg.transcript) return '';
      const words = this.msg.transcript.split(' ');
      const idx   = Math.floor((sec / (this.totalSec || 1)) * words.length);
      return words.slice(Math.max(0, idx - 2), idx + 6).join(' ');
    },

    highlightKeyPhrases(text) {
      if (!text) return '';
      return text.split(/\s+/).map(word => {
        const clean = word.toLowerCase().replace(/[^a-z]/g, '');
        return (clean.length > 5 && !STOP_WORDS.has(clean))
          ? `<strong>${word}</strong>`
          : word;
      }).join(' ');
    },

    fmtSec(s) {
      if (!s || isNaN(s)) return '0:00';
      const m = Math.floor(s / 60);
      return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    },
  },
};
</script>

<style scoped>
/* ── Voice Drop Container ─────────────────────────────── */
.voice-drop {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 100%;
}

/* ── Mood Badge ───────────────────────────────────────── */
.vd-mood-badge {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2px 7px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  width: fit-content;
}
.vdmb-passionate { background: rgba(255,107,53,0.15); color: #ff6b35; border: 1px solid rgba(255,107,53,0.3); }
.vdmb-calm       { background: rgba(0,201,167,0.12);  color: #00c9a7; border: 1px solid rgba(0,201,167,0.25); }
.vdmb-thoughtful { background: rgba(108,99,255,0.15); color: #a78bfa; border: 1px solid rgba(108,99,255,0.3); }
.vdmb-urgent     { background: rgba(239,68,68,0.15);  color: #f87171; border: 1px solid rgba(239,68,68,0.3); }

/* ── Player Card ──────────────────────────────────────── */
.vd-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 18px;
  min-width: 200px;
  position: relative;
}

.vd-sent .vd-card {
  background: transparent;
}
.vd-recv .vd-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(8px);
}

/* Mood-tinted cards */
.vd-mood-passionate .vd-card { box-shadow: 0 0 18px rgba(255,107,53,0.25); }
.vd-mood-calm       .vd-card { box-shadow: 0 0 18px rgba(0,201,167,0.2); }
.vd-mood-thoughtful .vd-card { box-shadow: 0 0 18px rgba(108,99,255,0.25); }
.vd-mood-urgent     .vd-card { box-shadow: 0 0 18px rgba(239,68,68,0.3); animation: urgentPulse 1.5s ease-in-out infinite; }

@keyframes urgentPulse {
  0%,100% { box-shadow: 0 0 14px rgba(239,68,68,0.3); }
  50%     { box-shadow: 0 0 26px rgba(239,68,68,0.6); }
}

/* ── Play Button ──────────────────────────────────────── */
.vd-play-btn {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: rgba(218,165,32,0.15);
  border: 1.5px solid rgba(218,165,32,0.35);
  color: #daa520;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
  transition: all 0.2s;
}
.vd-play-btn:hover  { background: rgba(218,165,32,0.25); transform: scale(1.08); }
.vd-play-btn.vd-playing {
  background: rgba(218,165,32,0.25);
  box-shadow: 0 0 12px rgba(218,165,32,0.5);
  animation: playGlow 1.8s ease-in-out infinite;
}
@keyframes playGlow {
  0%,100% { box-shadow: 0 0 8px rgba(218,165,32,0.4); }
  50%     { box-shadow: 0 0 20px rgba(218,165,32,0.8); }
}

/* ── Waveform Area ────────────────────────────────────── */
.vd-waveform-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.vd-canvas {
  width: 100%;
  height: 44px;
  cursor: pointer;
  border-radius: 4px;
}
.vd-time-row {
  display: flex;
  justify-content: space-between;
}
.vd-cur-time, .vd-tot-time {
  font-size: 9px;
  opacity: 0.5;
  font-variant-numeric: tabular-nums;
}

/* ── Insight Button ───────────────────────────────────── */
.vd-insight-btn {
  width: 30px; height: 30px;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}
.vd-insight-btn:hover  { background: rgba(218,165,32,0.15); }
.vd-insight-active     { background: rgba(218,165,32,0.2) !important; border-color: #daa520 !important; }

/* ── Transcript Panel ─────────────────────────────────── */
.vd-transcript-panel {
  padding: 10px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}
.vd-transcript-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.vd-ts-label  { font-size: 10px; opacity: 0.5; letter-spacing: 0.05em; }
.vd-ts-mood   { font-size: 10px; opacity: 0.7; }
.vd-transcript-text {
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255,255,255,0.75);
  margin: 0;
}
.vd-transcript-text :deep(strong) {
  color: #daa520;
  font-weight: 700;
}

/* ── Transitions ──────────────────────────────────────── */
.vd-expand-enter-active, .vd-expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.vd-expand-enter-from, .vd-expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.vd-expand-enter-to, .vd-expand-leave-from {
  opacity: 1;
  max-height: 300px;
}
</style>
