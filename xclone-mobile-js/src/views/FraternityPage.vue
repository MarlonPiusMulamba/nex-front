<template>
  <ion-page>
    <!-- Themed top-level page — applies the fraternity's color to the whole page on enter -->
    <div
      class="frat-page-root"
      :style="frat ? `--frat-color: ${frat.theme_color || '#6366f1'}` : ''"
    >
      <!-- Header with back button -->
      <ion-header class="ion-no-border frat-header-bar">
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-back-button default-href="/tabs/fraternity" text=""></ion-back-button>
          </ion-buttons>
          <ion-title v-if="frat">{{ frat.name }}</ion-title>
          <ion-buttons slot="end" v-if="isFounderOrCore">
            <ion-button @click="settingsOpen = true">
              <ion-icon name="settings-outline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>

      <ion-content ref="mainContent">
        <!-- Hero Section -->
        <div class="frat-hero" v-if="frat">
          <!-- Animated backdrop -->
          <div class="frat-hero-bg">
            <div class="hero-orb orb1"></div>
            <div class="hero-orb orb2"></div>
            <div class="hero-orb orb3"></div>
          </div>

          <!-- Emblem + Identity -->
          <div class="hero-content">
            <div class="hero-emblem-wrap">
              <img v-if="frat.emblem_url" :src="frat.emblem_url" class="hero-emblem" alt="Emblem" />
              <div v-else class="hero-emblem-fallback">
                {{ frat.name?.[0]?.toUpperCase() }}
              </div>
              <div class="hero-emblem-ring"></div>
            </div>
            <h1 class="hero-name">{{ frat.name }}</h1>
            <p class="hero-motto" v-if="frat.motto">{{ frat.motto }}</p>
            <div class="hero-meta">
              <span>{{ frat.member_count || 0 }} members</span>
              <span class="dot">·</span>
              <span>Founded by @{{ frat.founder_username }}</span>
            </div>

            <!-- Energy Meter -->
            <div class="hero-energy">
              <div class="energy-top">
                <div class="energy-labels">
                  <span>⚡ Energy Pulse</span>
                  <span class="energy-score">{{ frat.energy_score || 0 }} / 1000</span>
                </div>
                <div class="energy-track">
                  <div class="energy-fill" :style="{ width: energyPercent + '%' }">
                    <div class="energy-shimmer"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Join / Action Buttons -->
            <div class="hero-actions" v-if="!loading">
              <!-- Not a member -->
              <template v-if="!viewerRole && !viewerPending">
                <ion-button
                  v-if="frat.join_method === 'open'"
                  shape="round"
                  class="join-btn"
                  @click="joinOpen"
                  :disabled="joining"
                >
                  🛡 Join Fraternity
                </ion-button>
                <ion-button
                  v-else-if="frat.join_method === 'request'"
                  shape="round"
                  fill="outline"
                  class="join-btn"
                  @click="requestJoin"
                  :disabled="joining"
                >
                  📋 Request Entry
                </ion-button>
                <ion-button
                  v-else-if="frat.join_method === 'questions'"
                  shape="round"
                  fill="outline"
                  class="join-btn"
                  @click="questionsOpen = true"
                >
                  ❓ Answer to Enter
                </ion-button>
              </template>
              <div v-if="viewerPending" class="pending-badge">⏳ Request Pending</div>
              <div v-if="viewerRole" class="viewer-role-badge">
                {{ roleLabel(viewerRole) }}
              </div>
              <ion-button
                v-if="viewerRole && viewerRole !== 'founder'"
                fill="clear"
                size="small"
                color="medium"
                @click="leave"
              >Leave</ion-button>
            </div>
          </div>
        </div>

        <!-- Loading skeleton -->
        <div v-if="loading" class="hero-skeleton">
          <div class="hs-emblem"></div>
          <div class="hs-line wide"></div>
          <div class="hs-line narrow"></div>
        </div>

        <!-- Sub-tabs -->
        <div class="sub-tabs" v-if="frat">
          <button
            v-for="tab in subTabs"
            :key="tab.key"
            :class="['sub-tab', { active: activeTab === tab.key }]"
            @click="activeTab = tab.key"
          >
            <span>{{ tab.icon }}</span>
            {{ tab.label }}
          </button>
        </div>

        <!-- === TAB: FEED === -->
        <div v-if="activeTab === 'feed' && frat" class="tab-section">
          <!-- Broadcasts -->
          <div v-if="frat.recent_broadcasts?.length" class="broadcasts-section">
            <h3 class="section-label">📡 Signals</h3>
            <div
              v-for="bc in frat.recent_broadcasts"
              :key="bc.id"
              class="broadcast-card"
              :class="{ pinned: bc.pinned }"
            >
              <div class="bc-header">
                <span class="bc-type-badge" :class="bc.broadcast_type">
                  {{ bc.broadcast_type === 'signal' ? '📡' : '🎙' }} {{ bc.broadcast_type }}
                </span>
                <span class="bc-sender">@{{ bc.sender_username }}</span>
              </div>
              <p class="bc-content">{{ bc.content }}</p>
            </div>
          </div>

          <!-- "Post to this Fraternity" prompt -->
          <div v-if="viewerRole" class="post-prompt" @click="openPostComposer">
            <div class="pp-avatar">
              <img v-if="myProfilePic" :src="myProfilePic" alt="" />
              <span v-else>{{ myInitial }}</span>
            </div>
            <div class="pp-input">Share something with {{ frat.name }}…</div>
          </div>

          <!-- Posts -->
          <div v-if="feedLoading" class="posts-loading">
            <div v-for="i in 3" :key="i" class="post-skeleton"></div>
          </div>
          <div v-else-if="posts.length === 0" class="tab-empty">
            <span>🔇</span>
            <p>No signals yet. Be the first to post.</p>
          </div>
          <div v-else class="posts-list">
            <div v-for="post in posts" :key="post.id" class="frat-post-card">
              <div class="fp-author">
                <img v-if="post.profile_pic" :src="post.profile_pic" class="fp-avatar" alt="" />
                <span v-else class="fp-avatar fp-avatar-fallback">{{ post.username?.[0]?.toUpperCase() }}</span>
                <div>
                  <span class="fp-username">@{{ post.username }}</span>
                  <span class="fp-time">{{ formatTime(post.timestamp) }}</span>
                </div>
              </div>
              <p class="fp-content">{{ post.content }}</p>
              <img v-if="post.image" :src="post.image" class="fp-media" alt="" />
              <div class="fp-actions">
                <button class="fp-action-btn" @click="likePost(post)">
                  <span>{{ post.liked_by_viewer ? '❤️' : '🤍' }}</span>
                  {{ post.likes || 0 }}
                </button>
                <button class="fp-action-btn">
                  <span>💬</span>
                  {{ post.comments_count || 0 }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- === TAB: MEMBERS === -->
        <div v-if="activeTab === 'members' && frat" class="tab-section">
          <!-- Mod tools: Join requests -->
          <div v-if="isFounderOrCore && pendingRequests.length > 0" class="requests-section">
            <h3 class="section-label">📋 Pending Requests ({{ pendingRequests.length }})</h3>
            <div v-for="req in pendingRequests" :key="req.id" class="request-card">
              <img v-if="req.profile_pic" :src="req.profile_pic" class="req-avatar" alt="" />
              <div class="req-info">
                <span class="req-username">@{{ req.username }}</span>
                <div v-if="req.answers?.length" class="req-answers">
                  <p v-for="(a, i) in req.answers" :key="i"><em>Q{{ i+1 }}:</em> {{ a }}</p>
                </div>
              </div>
              <div class="req-actions">
                <ion-button size="small" shape="round" @click="approve(req.user_id)">✓</ion-button>
                <ion-button size="small" shape="round" fill="outline" color="danger" @click="reject(req.user_id)">✗</ion-button>
              </div>
            </div>
          </div>

          <!-- Members List -->
          <div v-if="membersLoading" class="posts-loading">
            <div v-for="i in 5" :key="i" class="member-skeleton"></div>
          </div>
          <div v-else class="members-list">
            <div v-for="m in members" :key="m.user_id" class="member-row">
              <img v-if="m.profile_pic" :src="m.profile_pic" class="member-avatar" alt="" />
              <div v-else class="member-avatar member-avatar-fallback">
                {{ m.username?.[0]?.toUpperCase() }}
              </div>
              <div class="member-info">
                <span class="member-username">@{{ m.username }}</span>
                <span class="member-name" v-if="m.first_name">{{ m.first_name }} {{ m.last_name }}</span>
              </div>
              <span class="member-role-badge" :class="m.role">{{ roleLabel(m.role) }}</span>

              <!-- Role changer (founder only) -->
              <div v-if="viewerRole === 'founder' && m.user_id !== frat.founder_id" class="role-changer">
                <select
                  :value="m.role"
                  @change="changeRole(m.user_id, $event.target.value)"
                  class="role-select"
                >
                  <option value="core">Core</option>
                  <option value="voice">Voice</option>
                  <option value="member">Member</option>
                  <option value="observer">Observer</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- === TAB: ABOUT === -->
        <div v-if="activeTab === 'about' && frat" class="tab-section about-section">
          <div class="about-card">
            <h3>📖 About</h3>
            <p>{{ frat.description || 'No description yet.' }}</p>
          </div>
          <div class="about-card">
            <h3>🗓 Founded</h3>
            <p>{{ formatDate(frat.created_at) }}</p>
          </div>
          <div class="about-card">
            <h3>🔓 Join Method</h3>
            <p>{{ joinMethodLabel }}</p>
          </div>
          <div class="about-card" v-if="isFounderOrCore">
            <h3>📡 Broadcast a Signal</h3>
            <ion-textarea
              v-model="broadcastContent"
              placeholder="Write a signal announcement..."
              rows="3"
              class="bc-textarea"
            ></ion-textarea>
            <ion-button
              expand="block" shape="round" size="small"
              :disabled="broadcasting || !broadcastContent.trim()"
              @click="broadcast"
              class="bc-send-btn"
            >
              {{ broadcasting ? 'Sending...' : '📡 Send Signal' }}
            </ion-button>
          </div>
        </div>

        <!-- Bottom spacer -->
        <div style="height: 60px;"></div>
      </ion-content>

      <!-- Question Join Modal -->
      <ion-modal :is-open="questionsOpen" @didDismiss="questionsOpen = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>Join {{ frat?.name }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="questionsOpen = false">Cancel</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="q-modal-content">
          <div class="q-form">
            <div v-for="(q, i) in frat?.join_questions || []" :key="i" class="q-item">
              <label class="q-label">{{ q }}</label>
              <ion-textarea
                v-model="answersList[i]"
                :placeholder="`Your answer...`"
                rows="3"
                class="q-textarea"
              ></ion-textarea>
            </div>
            <ion-button
              expand="block" shape="round"
              :disabled="joining"
              @click="submitQJoin"
              class="q-submit-btn"
            >
              {{ joining ? 'Sending...' : '🛡 Submit Entry Request' }}
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>
    </div>
  </ion-page>
</template>

<script>
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonButtons, IonBackButton, IonIcon,
  IonModal, IonTextarea
} from '@ionic/vue';
import axios from 'axios';
import config from '@/config/index.js';

export default {
  name: 'FraternityPage',
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
    IonButton, IonButtons, IonBackButton, IonIcon,
    IonModal, IonTextarea
  },
  data() {
    return {
      API_URL: config.api.baseURL,
      userId: localStorage.getItem('userId'),
      myProfilePic: localStorage.getItem('profilePic'),
      frat: null,
      posts: [],
      members: [],
      pendingRequests: [],
      loading: true,
      feedLoading: false,
      membersLoading: false,
      joining: false,
      broadcasting: false,
      activeTab: 'feed',
      viewerRole: null,
      viewerPending: false,
      questionsOpen: false,
      settingsOpen: false,
      answersList: [],
      broadcastContent: '',
      subTabs: [
        { key: 'feed', icon: '📡', label: 'Feed' },
        { key: 'members', icon: '👥', label: 'Members' },
        { key: 'about', icon: '🏛', label: 'About' }
      ]
    };
  },
  computed: {
    slug() { return this.$route.params.slug; },
    energyPercent() {
      return Math.min(100, ((this.frat?.energy_score || 0) / 1000) * 100);
    },
    isFounderOrCore() {
      return this.viewerRole && ['founder', 'core'].includes(this.viewerRole);
    },
    myInitial() {
      const u = localStorage.getItem('username') || '';
      return u[0]?.toUpperCase() || '?';
    },
    joinMethodLabel() {
      const map = {
        open: '🔓 Open — Anyone can join',
        request: '📋 Request — Submit a request',
        questions: '❓ Questions — Answer to enter',
        invite: '✉️ Invite Only',
        qr: '📱 QR Code'
      };
      return map[this.frat?.join_method] || '';
    }
  },
  async mounted() {
    await this.loadFraternity();
    await this.loadFeed();
  },
  watch: {
    activeTab(tab) {
      if (tab === 'members' && !this.members.length) this.loadMembers();
      if (tab === 'members' && this.isFounderOrCore) this.loadRequests();
    }
  },
  methods: {
    async loadFraternity() {
      this.loading = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/fraternity/${this.slug}`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) {
          this.frat = res.data.fraternity;
          this.viewerRole = this.frat.viewer_role;
          this.viewerPending = this.frat.viewer_pending;
          // Parse join_questions if it's a string
          if (typeof this.frat.join_questions === 'string') {
            try { this.frat.join_questions = JSON.parse(this.frat.join_questions); }
            catch { this.frat.join_questions = []; }
          }
          this.answersList = (this.frat.join_questions || []).map(() => '');
        }
      } catch (e) {
        console.error('Load fraternity error:', e);
      } finally {
        this.loading = false;
      }
    },
    async loadFeed() {
      if (!this.frat) return;
      this.feedLoading = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/fraternity/${this.frat.id}/feed`, {
          params: { user_id: this.userId, limit: 20, offset: 0 }
        });
        this.posts = res.data.posts || [];
      } catch (e) {
        console.error('Load feed error:', e);
      } finally {
        this.feedLoading = false;
      }
    },
    async loadMembers() {
      this.membersLoading = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/fraternity/${this.frat.id}/members`);
        this.members = res.data.members || [];
      } catch (e) { console.error('Load members error:', e); }
      finally { this.membersLoading = false; }
    },
    async loadRequests() {
      try {
        const res = await axios.get(`${this.API_URL}/api/fraternity/${this.frat.id}/requests`, {
          params: { user_id: this.userId }
        });
        this.pendingRequests = res.data.requests || [];
      } catch (e) { console.error('Load requests error:', e); }
    },
    async joinOpen() {
      if (!this.userId) { this.$router.push('/login'); return; }
      this.joining = true;
      try {
        const res = await axios.post(`${this.API_URL}/api/fraternity/${this.frat.id}/join`, {
          user_id: this.userId
        });
        if (res.data.success) {
          this.viewerRole = 'member';
          this.frat.member_count = (this.frat.member_count || 0) + 1;
          await this.loadFeed();
        }
      } catch (e) { console.error('Join error:', e); }
      finally { this.joining = false; }
    },
    async requestJoin() {
      if (!this.userId) { this.$router.push('/login'); return; }
      this.joining = true;
      try {
        const res = await axios.post(`${this.API_URL}/api/fraternity/${this.frat.id}/join`, {
          user_id: this.userId, answers: []
        });
        if (res.data.status === 'pending') this.viewerPending = true;
      } catch (e) { console.error('Request join error:', e); }
      finally { this.joining = false; }
    },
    async submitQJoin() {
      this.joining = true;
      try {
        const res = await axios.post(`${this.API_URL}/api/fraternity/${this.frat.id}/join`, {
          user_id: this.userId, answers: this.answersList
        });
        if (res.data.success) {
          this.questionsOpen = false;
          this.viewerPending = true;
        }
      } catch (e) { console.error('Submit join error:', e); }
      finally { this.joining = false; }
    },
    async leave() {
      if (!confirm('Leave this fraternity?')) return;
      try {
        await axios.post(`${this.API_URL}/api/fraternity/${this.frat.id}/leave`, {
          user_id: this.userId
        });
        this.viewerRole = null;
        this.frat.member_count = Math.max(0, (this.frat.member_count || 1) - 1);
      } catch (e) { console.error('Leave error:', e); }
    },
    async approve(targetUserId) {
      try {
        await axios.post(`${this.API_URL}/api/fraternity/${this.frat.id}/approve/${targetUserId}`, {
          user_id: this.userId
        });
        this.pendingRequests = this.pendingRequests.filter(r => r.user_id !== targetUserId);
        this.frat.member_count = (this.frat.member_count || 0) + 1;
        if (this.activeTab === 'members') await this.loadMembers();
      } catch (e) { console.error('Approve error:', e); }
    },
    async reject(targetUserId) {
      try {
        await axios.post(`${this.API_URL}/api/fraternity/${this.frat.id}/reject/${targetUserId}`, {
          user_id: this.userId
        });
        this.pendingRequests = this.pendingRequests.filter(r => r.user_id !== targetUserId);
      } catch (e) { console.error('Reject error:', e); }
    },
    async changeRole(targetUserId, newRole) {
      try {
        await axios.patch(
          `${this.API_URL}/api/fraternity/${this.frat.id}/member/${targetUserId}/role`,
          { user_id: this.userId, role: newRole }
        );
        const m = this.members.find(x => x.user_id === targetUserId);
        if (m) m.role = newRole;
      } catch (e) { console.error('Change role error:', e); }
    },
    async broadcast() {
      if (!this.broadcastContent.trim()) return;
      this.broadcasting = true;
      try {
        const res = await axios.post(`${this.API_URL}/api/fraternity/${this.frat.id}/broadcast`, {
          user_id: this.userId,
          content: this.broadcastContent,
          broadcast_type: 'signal'
        });
        if (res.data.success) {
          this.broadcastContent = '';
          await this.loadFraternity();
        }
      } catch (e) { console.error('Broadcast error:', e); }
      finally { this.broadcasting = false; }
    },
    async likePost(post) {
      try {
        await axios.post(`${this.API_URL}/api/like`, {
          user_id: this.userId, post_id: post.id
        });
        post.liked_by_viewer = !post.liked_by_viewer;
        post.likes = post.likes + (post.liked_by_viewer ? 1 : -1);
      } catch (e) { console.error('Like error:', e); }
    },
    openPostComposer() {
      window.dispatchEvent(new CustomEvent('open-post-composer', {
        detail: { fraternity_id: this.frat.id, fraternity_name: this.frat.name }
      }));
    },
    roleLabel(role) {
      const map = {
        founder: '👑 Founder', core: '🔥 Core', voice: '🎙 Voice',
        member: '✅ Member', observer: '👁 Observer'
      };
      return map[role] || role;
    },
    formatTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const now = new Date();
      const diff = (now - d) / 1000;
      if (diff < 60) return 'just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
      return d.toLocaleDateString();
    },
    formatDate(ts) {
      if (!ts) return '';
      return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }
};
</script>

<style scoped>
.frat-page-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ion-background-color);
}
.frat-header-bar ion-toolbar {
  --background: transparent;
}

/* ── HERO ─────────────────────────────────────── */
.frat-hero {
  position: relative;
  overflow: hidden;
  padding: 0 0 24px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--frat-color) 18%, var(--ion-background-color)) 0%,
    var(--ion-background-color) 100%
  );
}
.frat-hero-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.hero-orb {
  position: absolute;
  border-radius: 50%;
  opacity: 0.18;
  animation: float 6s ease-in-out infinite;
}
.orb1 {
  width: 200px; height: 200px;
  background: radial-gradient(circle, var(--frat-color), transparent);
  top: -80px; right: -60px;
  animation-delay: 0s;
}
.orb2 {
  width: 140px; height: 140px;
  background: radial-gradient(circle, var(--frat-color), transparent);
  bottom: 0; left: -40px;
  animation-delay: 2s;
}
.orb3 {
  width: 80px; height: 80px;
  background: radial-gradient(circle, var(--frat-color), transparent);
  top: 30px; left: 40%;
  animation-delay: 4s;
}
@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-12px) scale(1.08); }
}
.hero-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 20px 0;
  text-align: center;
}
.hero-emblem-wrap {
  position: relative;
  margin-bottom: 14px;
}
.hero-emblem, .hero-emblem-fallback {
  width: 88px;
  height: 88px;
  border-radius: 22px;
  border: 3px solid color-mix(in srgb, var(--frat-color) 60%, transparent);
}
.hero-emblem { object-fit: cover; }
.hero-emblem-fallback {
  background: linear-gradient(135deg, var(--frat-color), #000);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 900;
  color: #fff;
}
.hero-emblem-ring {
  position: absolute;
  inset: -8px;
  border-radius: 28px;
  border: 2px solid color-mix(in srgb, var(--frat-color) 30%, transparent);
  animation: ring-pulse 2.5s ease-in-out infinite;
}
@keyframes ring-pulse {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.06); opacity: 0.8; }
}
.hero-name {
  font-size: 26px;
  font-weight: 900;
  margin: 0 0 4px;
  color: var(--ion-text-color);
}
.hero-motto {
  font-size: 14px;
  color: var(--frat-color);
  font-style: italic;
  margin: 0 0 8px;
  max-width: 280px;
}
.hero-meta {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin-bottom: 16px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.dot { opacity: 0.4; }

.hero-energy { width: 100%; max-width: 320px; margin-bottom: 16px; }
.energy-top {}
.energy-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--ion-color-medium);
  margin-bottom: 5px;
}
.energy-score { color: var(--frat-color); font-weight: 700; }
.energy-track {
  background: color-mix(in srgb, var(--frat-color) 15%, transparent);
  border-radius: 99px;
  height: 6px;
  overflow: hidden;
}
.energy-fill {
  height: 100%;
  border-radius: 99px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(90deg, var(--frat-color), color-mix(in srgb, var(--frat-color) 60%, #fff));
  transition: width 1.2s cubic-bezier(0.4,0,0.2,1);
}
.energy-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer-move 2s linear infinite;
}
@keyframes shimmer-move {
  from { transform: translateX(-100%); }
  to { transform: translateX(200%); }
}

.hero-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }
.join-btn { --background: var(--frat-color); --border-radius: 99px; font-weight: 700; }
.pending-badge {
  background: var(--ion-color-light);
  color: var(--ion-color-medium);
  border-radius: 99px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
}
.viewer-role-badge {
  background: color-mix(in srgb, var(--frat-color) 20%, transparent);
  color: var(--frat-color);
  padding: 6px 14px;
  border-radius: 99px;
  font-size: 13px;
  font-weight: 700;
}

/* ── SUB-TABS ─────────────────────────────────── */
.sub-tabs {
  display: flex;
  border-bottom: 1px solid var(--ion-color-light, #eee);
  background: var(--ion-background-color);
  position: sticky;
  top: 0;
  z-index: 10;
}
.sub-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 12px 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium);
  background: none;
  border: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.sub-tab.active {
  color: var(--frat-color);
  border-bottom-color: var(--frat-color);
}

/* ── SECTIONS ─────────────────────────────────── */
.tab-section { padding: 14px 16px; }
.section-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--ion-color-medium);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Broadcasts */
.broadcasts-section { margin-bottom: 16px; }
.broadcast-card {
  background: color-mix(in srgb, var(--frat-color) 8%, var(--ion-card-background, #1a1a2e));
  border: 1px solid color-mix(in srgb, var(--frat-color) 25%, transparent);
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 10px;
}
.broadcast-card.pinned { border-style: dashed; }
.bc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.bc-type-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--frat-color);
  background: color-mix(in srgb, var(--frat-color) 15%, transparent);
  padding: 2px 8px;
  border-radius: 99px;
}
.bc-sender { font-size: 12px; color: var(--ion-color-medium); }
.bc-content { margin: 0; font-size: 14px; color: var(--ion-text-color); line-height: 1.5; }

/* Post prompt */
.post-prompt {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--ion-card-background, #1a1a2e);
  border: 1px solid var(--ion-color-light, #333);
  border-radius: 16px;
  padding: 14px;
  cursor: pointer;
  margin-bottom: 16px;
  transition: border-color 0.2s;
}
.post-prompt:hover { border-color: var(--frat-color); }
.pp-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--frat-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  flex-shrink: 0;
}
.pp-avatar img { width: 100%; height: 100%; object-fit: cover; }
.pp-input {
  flex: 1;
  color: var(--ion-color-medium);
  font-size: 14px;
}

/* Posts */
.posts-loading, .member-skeleton { }
.post-skeleton {
  height: 120px;
  background: var(--ion-color-light, #1a1a2e);
  border-radius: 14px;
  margin-bottom: 10px;
  animation: shimmer 1.5s infinite;
}
.member-skeleton {
  height: 56px;
  background: var(--ion-color-light, #1a1a2e);
  border-radius: 14px;
  margin-bottom: 8px;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}
.tab-empty {
  text-align: center;
  padding: 40px 16px;
  color: var(--ion-color-medium);
}
.tab-empty span { font-size: 40px; display: block; margin-bottom: 10px; }
.frat-post-card {
  background: var(--ion-card-background, #1a1a2e);
  border-radius: 16px;
  border: 1px solid var(--ion-color-light, #2a2a3e);
  padding: 14px;
  margin-bottom: 10px;
}
.fp-author {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.fp-avatar {
  width: 34px; height: 34px;
  border-radius: 50%; object-fit: cover;
}
.fp-avatar-fallback {
  background: var(--frat-color);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 14px;
}
.fp-username { font-weight: 700; font-size: 14px; display: block; }
.fp-time { font-size: 11px; color: var(--ion-color-medium); }
.fp-content { margin: 0 0 10px; font-size: 14px; line-height: 1.5; color: var(--ion-text-color); }
.fp-media { width: 100%; border-radius: 12px; max-height: 280px; object-fit: cover; margin-bottom: 10px; }
.fp-actions { display: flex; gap: 16px; }
.fp-action-btn {
  display: flex; align-items: center; gap: 5px;
  background: none; border: none; font-size: 13px;
  color: var(--ion-color-medium); cursor: pointer;
  padding: 4px 8px; border-radius: 99px;
  transition: background 0.2s;
}
.fp-action-btn:hover { background: var(--ion-color-light, #2a2a3e); }

/* Members */
.requests-section { margin-bottom: 20px; }
.request-card {
  display: flex; align-items: flex-start; gap: 12px;
  background: var(--ion-card-background, #1a1a2e);
  border-radius: 14px; padding: 12px; margin-bottom: 8px;
}
.req-avatar { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; }
.req-info { flex: 1; }
.req-username { font-weight: 700; font-size: 14px; display: block; margin-bottom: 4px; }
.req-answers p { margin: 2px 0; font-size: 12px; color: var(--ion-color-medium); }
.req-actions { display: flex; gap: 6px; }
.members-list {}
.member-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ion-color-light, #2a2a3e);
}
.member-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.member-avatar-fallback {
  background: var(--frat-color);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700;
}
.member-info { flex: 1; }
.member-username { font-weight: 700; font-size: 14px; display: block; }
.member-name { font-size: 12px; color: var(--ion-color-medium); }
.member-role-badge {
  font-size: 11px; font-weight: 700; padding: 3px 10px;
  border-radius: 99px; white-space: nowrap;
}
.member-role-badge.founder { background: rgba(255,215,0,0.15); color: #ffd700; }
.member-role-badge.core { background: rgba(255,100,50,0.15); color: #ff6432; }
.member-role-badge.voice { background: rgba(200,100,255,0.15); color: #c864ff; }
.member-role-badge.member { background: rgba(99,102,241,0.15); color: #6366f1; }
.member-role-badge.observer { background: rgba(128,128,128,0.15); color: #888; }
.role-select {
  background: var(--ion-color-light, #2a2a3e);
  border: none; border-radius: 8px;
  padding: 4px 8px; font-size: 12px;
  color: var(--ion-text-color);
  cursor: pointer;
}

/* About */
.about-section {}
.about-card {
  background: var(--ion-card-background, #1a1a2e);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
}
.about-card h3 { margin: 0 0 6px; font-size: 14px; font-weight: 700; color: var(--frat-color); }
.about-card p { margin: 0; font-size: 14px; color: var(--ion-text-color); line-height: 1.5; }
.bc-textarea {
  --background: var(--ion-color-light, #2a2a3e);
  --border-radius: 12px;
  margin: 10px 0;
}
.bc-send-btn { margin-top: 8px; --background: var(--frat-color); }

/* Skeletons for hero */
.hero-skeleton {
  display: flex; flex-direction: column; align-items: center;
  padding: 40px 20px;
  gap: 12px;
}
.hs-emblem {
  width: 88px; height: 88px;
  border-radius: 22px;
  background: var(--ion-color-light, #2a2a3e);
  animation: shimmer 1.5s infinite;
}
.hs-line {
  height: 16px;
  border-radius: 8px;
  background: var(--ion-color-light, #2a2a3e);
  animation: shimmer 1.5s infinite;
}
.hs-line.wide { width: 180px; }
.hs-line.narrow { width: 120px; }

/* Question join modal */
.q-modal-content { --padding-start: 0; --padding-end: 0; }
.q-form { padding: 20px 16px 40px; }
.q-item { margin-bottom: 16px; }
.q-label { font-size: 14px; font-weight: 600; display: block; margin-bottom: 8px; color: var(--ion-text-color); }
.q-textarea {
  --background: var(--ion-color-light, #f4f4f4);
  --border-radius: 12px;
}
.q-submit-btn { margin-top: 24px; --background: var(--frat-color, var(--ion-color-primary)); }
</style>
