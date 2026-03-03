<template>
  <div
    class="frat-card"
    :style="{ '--frat-color': fraternity.theme_color || '#6366f1' }"
    @click="open"
  >
    <!-- Animated accent glow -->
    <div class="frat-glow"></div>

    <!-- Header: Emblem + Info -->
    <div class="frat-header">
      <div class="frat-emblem-wrap">
        <img v-if="fraternity.emblem_url" :src="fraternity.emblem_url" class="frat-emblem" alt="" />
        <div v-else class="frat-emblem-fallback">
          <span>{{ fraternity.name?.[0]?.toUpperCase() }}</span>
        </div>
      </div>
      <div class="frat-info">
        <h3 class="frat-name">{{ fraternity.name }}</h3>
        <p class="frat-motto" v-if="fraternity.motto">{{ fraternity.motto }}</p>
        <p class="frat-founder">by @{{ fraternity.founder_username }}</p>
      </div>
    </div>

    <!-- Energy Meter -->
    <div class="frat-energy-bar">
      <div class="energy-label">
        <span>⚡ Energy</span>
        <span class="energy-value">{{ fraternity.energy_score || 0 }}</span>
      </div>
      <div class="energy-track">
        <div class="energy-fill" :style="{ width: energyPercent + '%' }"></div>
      </div>
    </div>

    <!-- Footer stats + badge -->
    <div class="frat-footer">
      <div class="frat-stats">
        <span class="stat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          {{ fraternity.member_count || 0 }} members
        </span>
        <span class="frat-badge-pill" v-if="fraternity.viewer_role">
          {{ roleLabel(fraternity.viewer_role) }}
        </span>
        <span class="frat-join-method" v-if="!fraternity.viewer_role">
          {{ joinMethodLabel }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FraternityCard',
  props: {
    fraternity: {
      type: Object,
      required: true
    }
  },
  computed: {
    energyPercent() {
      return Math.min(100, ((this.fraternity.energy_score || 0) / 1000) * 100);
    },
    joinMethodLabel() {
      const map = {
        open: '🔓 Open',
        request: '📋 Request to Join',
        questions: '❓ Answer to Join',
        invite: '✉️ Invite Only',
        qr: '📱 QR Join'
      };
      return map[this.fraternity.join_method] || 'Join';
    }
  },
  methods: {
    open() {
      this.$router.push(`/tabs/fraternity/${this.fraternity.slug}`);
    },
    roleLabel(role) {
      const map = {
        founder: '👑 Founder',
        core: '🔥 Core',
        voice: '🎙 Voice',
        member: '✅ Member',
        observer: '👁 Observer'
      };
      return map[role] || role;
    }
  }
};
</script>

<style scoped>
.frat-card {
  position: relative;
  background: var(--ion-card-background, #1a1a2e);
  border: 1px solid color-mix(in srgb, var(--frat-color) 30%, transparent);
  border-radius: 20px;
  padding: 18px 18px 14px;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}
.frat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 40px color-mix(in srgb, var(--frat-color) 25%, transparent);
}
.frat-glow {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, var(--frat-color) 0%, transparent 70%);
  opacity: 0.15;
  pointer-events: none;
  animation: pulse-glow 3s ease-in-out infinite;
}
@keyframes pulse-glow {
  0%, 100% { opacity: 0.12; transform: scale(1); }
  50% { opacity: 0.22; transform: scale(1.15); }
}
.frat-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}
.frat-emblem-wrap {
  flex-shrink: 0;
}
.frat-emblem {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  object-fit: cover;
  border: 2px solid color-mix(in srgb, var(--frat-color) 50%, transparent);
}
.frat-emblem-fallback {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--frat-color), color-mix(in srgb, var(--frat-color) 50%, #000));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 900;
  color: #fff;
}
.frat-info {
  flex: 1;
  min-width: 0;
}
.frat-name {
  margin: 0 0 2px;
  font-size: 16px;
  font-weight: 800;
  color: var(--ion-text-color, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.frat-motto {
  margin: 0 0 3px;
  font-size: 12px;
  color: var(--frat-color);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.frat-founder {
  margin: 0;
  font-size: 11px;
  color: var(--ion-color-medium, #888);
}
.frat-energy-bar {
  margin-bottom: 12px;
}
.energy-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--ion-color-medium, #888);
  margin-bottom: 4px;
}
.energy-value {
  font-weight: 700;
  color: var(--frat-color);
}
.energy-track {
  background: color-mix(in srgb, var(--frat-color) 15%, transparent);
  border-radius: 99px;
  height: 5px;
  overflow: hidden;
}
.energy-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--frat-color), color-mix(in srgb, var(--frat-color) 60%, #fff));
  border-radius: 99px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}
.frat-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.frat-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: var(--ion-color-medium, #888);
}
.frat-badge-pill {
  background: color-mix(in srgb, var(--frat-color) 20%, transparent);
  color: var(--frat-color);
  border-radius: 99px;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 600;
}
.frat-join-method {
  font-size: 11px;
  color: var(--ion-color-medium, #888);
}
</style>
