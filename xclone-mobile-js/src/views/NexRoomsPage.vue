<template>
  <div class="nr-shell">
    <!-- ═══════════════════════════════════════════════════
         TOP BAR
    ════════════════════════════════════════════════════ -->
    <header class="nr-topbar">
      <div class="nr-brand">
        <img src="/nexrooms-logo.png" class="nr-logo" alt="NexRooms" />
        <span class="nr-brand-name">NexRooms</span>
      </div>
      <div class="nr-topbar-right">
        <span v-if="username" class="nr-user-pill">@{{ username }}</span>
        <button v-if="!userId" class="nr-btn nr-btn-outline" @click="goLogin">Sign in</button>
        <button v-else class="nr-btn nr-btn-ghost" @click="signOut">Sign out</button>
      </div>
    </header>

    <!-- ═══════════════════════════════════════════════════
         HERO (not logged in)
    ════════════════════════════════════════════════════ -->
    <section v-if="!userId" class="nr-hero">
      <h1 class="nr-hero-title">Your meeting room.<br><span class="nr-hero-thin">Always ready.</span></h1>
      <p class="nr-hero-sub">Instant meetings, scheduled talks and breakout rooms — no clutter, no colour, just your people.</p>
      <div class="nr-hero-actions">
        <button class="nr-btn nr-btn-primary" @click="goLogin">Get started</button>
        <button class="nr-btn nr-btn-outline" @click="goLogin">Join a meeting</button>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════
         MAIN CONTENT (logged in)
    ════════════════════════════════════════════════════ -->
    <main v-else class="nr-main">

      <!-- ── JOIN BY LINK ────────────────────────────── -->
      <section class="nr-section">
        <h2 class="nr-section-title">Join a Room</h2>
        <div class="nr-join-row">
          <input
            v-model="joinCode"
            class="nr-input"
            placeholder="Paste invite link or meeting code"
            @keyup.enter="joinByCode"
          />
          <button class="nr-btn nr-btn-primary" :disabled="!joinCode.trim() || joining" @click="joinByCode">
            <span v-if="joining" class="nr-spinner"></span>
            <span v-else>Join</span>
          </button>
        </div>
        <p v-if="joinError" class="nr-error-msg">{{ joinError }}</p>
      </section>

      <!-- ── INSTANT MEETING ─────────────────────────── -->
      <section class="nr-section">
        <h2 class="nr-section-title">New Instant Meeting</h2>
        <div v-if="!showMeetingForm" class="nr-empty-action">
          <button class="nr-btn nr-btn-outline nr-btn-wide" @click="showMeetingForm = true">
            + Start an instant meeting
          </button>
        </div>
        <div v-else class="nr-form">
          <input
            v-model="meetingTitle"
            class="nr-input"
            placeholder="Meeting title"
            maxlength="120"
            autofocus
          />
          <div class="nr-vis-row">
            <button
              class="nr-vis-opt"
              :class="{ active: meetingVisibility === 'unlisted' }"
              @click="meetingVisibility = 'unlisted'"
            >
              <span class="nr-vis-icon">🔒</span>
              <span class="nr-vis-label">Private</span>
              <span class="nr-vis-sub">link + invites only</span>
            </button>
            <button
              class="nr-vis-opt"
              :class="{ active: meetingVisibility === 'timeline' }"
              @click="meetingVisibility = 'timeline'"
            >
              <span class="nr-vis-icon">📢</span>
              <span class="nr-vis-label">Timeline</span>
              <span class="nr-vis-sub">posted on feed</span>
            </button>
          </div>
          <label class="nr-locked-row">
            <input type="checkbox" v-model="meetingLocked" class="nr-checkbox" />
            <span>Locked room — approve each participant</span>
          </label>
          <div class="nr-form-actions">
            <button
              class="nr-btn nr-btn-primary"
              :disabled="creating || !meetingTitle.trim()"
              @click="createInstantMeeting"
            >
              <span v-if="creating" class="nr-spinner"></span>
              <span v-else>Start now</span>
            </button>
            <button class="nr-btn nr-btn-ghost" @click="showMeetingForm = false; meetingTitle = ''">Cancel</button>
          </div>
          <p v-if="meetingVisibility === 'unlisted'" class="nr-hint">
            Private meetings never appear on the public feed. Share the invite link from inside the room.
          </p>
        </div>
      </section>

      <!-- ── SCHEDULED TALKS ─────────────────────────── -->
      <section class="nr-section">
        <div class="nr-section-head">
          <h2 class="nr-section-title">
            Scheduled Talks
            <span v-if="liveCount > 0" class="nr-live-badge">{{ liveCount }} live</span>
          </h2>
          <button class="nr-btn nr-btn-ghost nr-btn-sm" @click="showScheduleForm = !showScheduleForm">
            {{ showScheduleForm ? 'Cancel' : '+ Schedule' }}
          </button>
        </div>

        <!-- Schedule form -->
        <div v-if="showScheduleForm" class="nr-form nr-form-bordered">
          <input v-model="formTitle" class="nr-input" placeholder="Talk title (e.g. Physics 101 revision)" />
          <div class="nr-form-row">
            <input v-model="formStartsAt" type="datetime-local" class="nr-input" />
            <select v-model.number="formDuration" class="nr-input nr-select">
              <option :value="15">15 min</option>
              <option :value="30">30 min</option>
              <option :value="60">1 hour</option>
              <option :value="120">2 hours</option>
            </select>
          </div>
          <div class="nr-form-actions">
            <button class="nr-btn nr-btn-primary" :disabled="scheduling" @click="scheduleTalk">
              <span v-if="scheduling" class="nr-spinner"></span>
              <span v-else>Schedule</span>
            </button>
          </div>
          <p class="nr-hint">Everyone gets a reminder 10 min before, and the room auto-opens at start time.</p>
        </div>

        <!-- Talks list -->
        <div v-if="loading" class="nr-loading-row">
          <span class="nr-spinner"></span> Loading rooms…
        </div>
        <div v-else-if="talks.length === 0" class="nr-empty">
          No talks scheduled yet. Be the first to plan one.
        </div>
        <div v-else class="nr-talks-list">
          <div v-for="t in talks" :key="t.id" class="nr-talk-item">
            <div class="nr-talk-body" @click="isHost(t) && toggleAudience(t)">
              <div class="nr-talk-row">
                <span class="nr-talk-name">{{ t.title }}</span>
                <span v-if="t.live_space_id" class="nr-live-dot">● LIVE</span>
              </div>
              <span class="nr-talk-meta">@{{ t.host_username }} · {{ talkWhen(t) }}</span>
              <span v-if="(t.rsvp_count || 0) > 0" class="nr-rsvp-count">{{ t.rsvp_count }} interested</span>
            </div>
            <div class="nr-talk-actions">
              <!-- Host: not started yet -->
              <template v-if="isHost(t) && !t.live_space_id">
                <button class="nr-btn nr-btn-primary nr-btn-sm" @click="startTalk(t)">Start</button>
              </template>
              <!-- Host: live -->
              <template v-else-if="isHost(t) && t.live_space_id">
                <button class="nr-btn nr-btn-outline nr-btn-sm" @click="joinTalk(t)">Rejoin</button>
                <button class="nr-btn nr-btn-danger nr-btn-sm" @click="endTalk(t)">End</button>
              </template>
              <!-- Guest: live -->
              <template v-else-if="t.live_space_id">
                <button class="nr-btn nr-btn-primary nr-btn-sm" @click="joinTalk(t)">Join</button>
              </template>
              <!-- Guest: upcoming -->
              <template v-else>
                <button
                  class="nr-btn nr-btn-sm"
                  :class="t.my_rsvp ? 'nr-btn-rsvp-on' : 'nr-btn-ghost'"
                  @click="toggleRsvp(t)"
                >{{ t.my_rsvp ? '✓ Interested' : 'Notify me' }}</button>
              </template>
            </div>

            <!-- Audience panel (host only) -->
            <div v-if="audienceFor && audienceFor.id === t.id && audienceData" class="nr-audience">
              <div class="nr-audience-stats">
                <span>{{ audienceData.follower_count }} followers</span>
                <span>{{ audienceData.rsvps.length }} RSVPs</span>
                <span>{{ audienceData.invites.length }} invited</span>
              </div>
              <div class="nr-pills" v-if="audienceData.invites.length > 0 || audienceData.rsvps.length > 0">
                <span v-for="u in audienceData.invites" :key="'i'+u.id" class="nr-pill nr-pill-invited">@{{ u.username }}</span>
                <span v-for="u in audienceData.rsvps" :key="'r'+u.id" class="nr-pill">@{{ u.username }}</span>
              </div>
              <div class="nr-invite-row">
                <input v-model="inviteName" class="nr-input" placeholder="@username to invite" @keyup.enter="sendInvite" />
                <button class="nr-btn nr-btn-outline nr-btn-sm" :disabled="inviting || !inviteName.trim()" @click="sendInvite">
                  {{ inviting ? '…' : 'Invite' }}
                </button>
              </div>
              <p v-if="inviteMsg" class="nr-invite-msg">{{ inviteMsg }}</p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- ═══════════════════════════════════════════════════
         AUDIO SPACE MODAL
    ════════════════════════════════════════════════════ -->
    <AudioSpaceModal
      v-if="showSpaceModal && currentSpace"
      :is-open="showSpaceModal"
      :space="currentSpace"
      :currentUser="{ id: userId, username: username, first_name: '', profile_pic: userAvatar }"
      @close="showSpaceModal = false"
      @minimize="showSpaceModal = false"
      @leave="leaveSpace"
      @switch-space="switchSpaceRoom"
    />

    <!-- FOOTER -->
    <footer class="nr-footer">
      <span>Powered by <a href="https://nexfi.org.uk" class="nr-footer-link" target="_blank">NexFi</a></span>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import config from '@/config/index.js';
import AudioSpaceModal from '@/components/AudioSpaceModal.vue';

const router = useRouter();
const API_URL = config.api.baseURL;

// ── Auth ─────────────────────────────────────────────
const userId   = ref(localStorage.getItem('userId'));
const username = ref(localStorage.getItem('username') || '');
const userAvatar = ref(localStorage.getItem('userAvatar') || '');

// ── Join by code/link ─────────────────────────────────
const joinCode  = ref('');
const joining   = ref(false);
const joinError = ref('');

const joinByCode = async () => {
  joinError.value = '';
  let code = joinCode.value.trim();
  // Extract code from full URL if pasted
  const m = code.match(/\/talk\/([^/?#]+)/);
  if (m) code = m[1];
  if (!code) return;
  joining.value = true;
  try {
    router.push(`/talk/${code}`);
  } finally {
    joining.value = false;
  }
};

// ── Instant Meeting ───────────────────────────────────
const showMeetingForm   = ref(false);
const meetingTitle      = ref('');
const meetingVisibility = ref('unlisted');
const meetingLocked     = ref(false);
const creating          = ref(false);

// ── Room state ────────────────────────────────────────
const showSpaceModal = ref(false);
const currentSpace   = ref(null);
const spaceHistory   = ref([]);

const openSpaceById = async (spaceId) => {
  const res = await axios.get(`${API_URL}/api/audio-spaces/${spaceId}`, {
    params: { user_id: userId.value }
  });
  if (res.data?.success) {
    currentSpace.value = res.data.space;
    showSpaceModal.value = true;
    showMeetingForm.value = false;
    meetingTitle.value = '';
    return true;
  }
  return false;
};

const createInstantMeeting = async () => {
  const title = meetingTitle.value.trim();
  if (!title || creating.value) return;
  creating.value = true;
  try {
    if (meetingVisibility.value === 'timeline') {
      const res = await axios.post(`${API_URL}/api/post`, {
        user_id: userId.value,
        content: title,
        audio_space_title: title,
        is_locked: meetingLocked.value
      });
      if (res.data?.success && res.data.space_id) await openSpaceById(res.data.space_id);
    } else {
      const res = await axios.post(`${API_URL}/api/audio-spaces`, {
        host_id: userId.value,
        title,
        visibility: 'unlisted',
        is_locked: meetingLocked.value ? 1 : 0
      });
      if (res.data?.success && res.data.space_id) await openSpaceById(res.data.space_id);
    }
  } catch (e) {
    console.error('create meeting failed', e);
  } finally {
    creating.value = false;
  }
};

const leaveSpace = () => {
  showSpaceModal.value = false;
  currentSpace.value   = null;
  spaceHistory.value   = [];
};

const switchSpaceRoom = async (room) => {
  if (!room || !room.id) return;
  const last = spaceHistory.value[spaceHistory.value.length - 1];
  if (room.__returnMain && last && String(last.id) === String(room.id)) {
    currentSpace.value = spaceHistory.value.pop();
    return;
  }
  if (currentSpace.value) {
    spaceHistory.value.push(currentSpace.value);
    if (spaceHistory.value.length > 10) spaceHistory.value.shift();
  }
  try {
    const res = await axios.get(`${API_URL}/api/audio-spaces/${room.id}`, { params: { user_id: userId.value } });
    currentSpace.value = res.data?.success ? res.data.space : { id: room.id, title: room.title || 'Breakout room' };
  } catch (_) {
    currentSpace.value = { id: room.id, title: room.title || 'Breakout room' };
  }
  showSpaceModal.value = true;
};

// ── Talks ─────────────────────────────────────────────
const talks          = ref([]);
const loading        = ref(false);
const liveCount      = computed(() => talks.value.filter(t => t.live_space_id).length);
const showScheduleForm = ref(false);
const formTitle      = ref('');
const formStartsAt   = ref('');
const formDuration   = ref(30);
const scheduling     = ref(false);

// Audience manager
const audienceFor    = ref(null);
const audienceData   = ref(null);
const inviteName     = ref('');
const inviting       = ref(false);
const inviteMsg      = ref('');

let refreshTimer = null;

const isHost = (t) => String(t.host_user_id) === String(userId.value);

const talkWhen = (t) => {
  try {
    const ms = new Date(t.starts_at).getTime() - Date.now();
    if (t.live_space_id) return 'live now';
    if (ms <= 0) return 'starting soon';
    const m = Math.round(ms / 60000);
    if (m < 60) return `in ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `in ${h}h ${m % 60}m`;
    return new Date(t.starts_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (_) { return ''; }
};

const fetchTalks = async () => {
  loading.value = true;
  try {
    const res = await axios.get(`${API_URL}/api/talks/upcoming`, { params: { user_id: userId.value } });
    if (res.data?.success) talks.value = res.data.talks || [];
  } catch (err) {
    console.warn('upcoming talks failed', err);
  } finally {
    loading.value = false;
  }
};

const scheduleTalk = async () => {
  if (!formTitle.value.trim() || !formStartsAt.value) { alert('Add a title and start time'); return; }
  scheduling.value = true;
  try {
    const res = await axios.post(`${API_URL}/api/talks/schedule`, {
      host_id: userId.value,
      title: formTitle.value.trim(),
      starts_at: new Date(formStartsAt.value).toISOString(),
      duration_minutes: formDuration.value
    });
    if (res.data?.success) {
      formTitle.value = ''; formStartsAt.value = '';
      showScheduleForm.value = false;
      fetchTalks();
    } else { alert(res.data?.message || 'Could not schedule talk'); }
  } catch (err) { console.error('schedule talk error', err); }
  finally { scheduling.value = false; }
};

const toggleRsvp = async (t) => {
  try {
    const res = await axios.post(`${API_URL}/api/talks/${t.id}/rsvp`, { user_id: userId.value });
    if (res.data?.success) fetchTalks();
  } catch (err) { console.error('rsvp error', err); }
};

const toggleAudience = async (t) => {
  if (!isHost(t)) return;
  if (audienceFor.value && audienceFor.value.id === t.id) {
    audienceFor.value = null; audienceData.value = null; return;
  }
  audienceFor.value  = t;
  audienceData.value = null;
  inviteMsg.value    = '';
  try {
    const res = await axios.get(`${API_URL}/api/talks/${t.id}/audience`, { params: { host_id: userId.value } });
    if (res.data?.success) audienceData.value = res.data.audience;
  } catch (err) { console.error('audience error', err); }
};

const sendInvite = async () => {
  const name = inviteName.value.trim();
  if (!name || !audienceFor.value || inviting.value) return;
  inviting.value = true; inviteMsg.value = '';
  try {
    const res = await axios.post(`${API_URL}/api/talks/${audienceFor.value.id}/invite`, {
      host_id: userId.value, username: name
    });
    if (res.data?.success) {
      inviteMsg.value = `Invited @${res.data.username}`;
      inviteName.value = '';
      fetchTalks();
    } else { inviteMsg.value = res.data?.message || 'Invite failed'; }
  } catch (err) { inviteMsg.value = err.response?.data?.message || 'Invite failed'; }
  finally { inviting.value = false; }
};

const fetchSpaceAndJoin = async (spaceId) => {
  const res = await axios.get(`${API_URL}/api/audio-spaces/${spaceId}`);
  if (res.data?.success) { currentSpace.value = res.data.space; showSpaceModal.value = true; return true; }
  return false;
};

const startTalk = async (t) => {
  try {
    const res = await axios.post(`${API_URL}/api/audio-spaces`, { host_id: userId.value, title: t.title });
    if (res.data?.success && res.data.space_id) {
      await axios.post(`${API_URL}/api/talks/${t.id}/link`, { host_id: userId.value, space_id: res.data.space_id }).catch(() => {});
      fetchTalks();
      await fetchSpaceAndJoin(res.data.space_id);
    }
  } catch (err) { console.error('start talk error', err); }
};

const joinTalk = async (t) => {
  if (!t.live_space_id) return;
  try { await fetchSpaceAndJoin(t.live_space_id); } catch (err) { console.error('join talk error', err); }
};

const endTalk = async (t) => {
  if (!t.live_space_id) return;
  if (!confirm(`End "${t.title}" for everyone?`)) return;
  try {
    await axios.post(`${API_URL}/api/audio-spaces/${t.live_space_id}/end`, { user_id: userId.value }).catch(() => {});
    await axios.post(`${API_URL}/api/talks/${t.id}/unlink`, { host_id: userId.value }).catch(() => {});
    fetchTalks();
  } catch (err) { console.error('end talk error', err); }
};

// ── Nav helpers ────────────────────────────────────────
const goLogin = () => router.push('/rooms/login');
const signOut = () => {
  localStorage.clear();
  userId.value = null;
  username.value = '';
};

onMounted(() => {
  if (userId.value) { fetchTalks(); refreshTimer = setInterval(fetchTalks, 60000); }
  window.addEventListener('talks-refresh', fetchTalks);
});
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  window.removeEventListener('talks-refresh', fetchTalks);
});
</script>

<style scoped>
/* ═══════════════════════════════════════════
   NEXROOMS — Black & White Design System
════════════════════════════════════════════ */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

:root {
  --nr-bg:         #000000;
  --nr-surface:    #0d0d0d;
  --nr-border:     #222222;
  --nr-border-hi:  #444444;
  --nr-text:       #ffffff;
  --nr-text-muted: #888888;
  --nr-text-dim:   #555555;
  --nr-accent:     #ffffff;
  --nr-font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.nr-shell {
  min-height: 100dvh;
  background: var(--nr-bg);
  color: var(--nr-text);
  font-family: var(--nr-font);
  display: flex;
  flex-direction: column;
}

/* ── TOPBAR ──────────────────────────────── */
.nr-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid var(--nr-border);
  position: sticky;
  top: 0;
  background: rgba(0,0,0,0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 100;
}

.nr-brand { display: flex; align-items: center; gap: 10px; }
.nr-logo { width: 32px; height: 32px; object-fit: contain; border-radius: 6px; }
.nr-brand-name {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #fff;
}

.nr-topbar-right { display: flex; align-items: center; gap: 10px; }
.nr-user-pill {
  font-size: 13px;
  color: var(--nr-text-muted);
  font-weight: 500;
}

/* ── HERO ────────────────────────────────── */
.nr-hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 32px 60px;
  max-width: 640px;
  margin: 0 auto;
}

.nr-hero-title {
  font-size: clamp(36px, 8vw, 64px);
  font-weight: 900;
  letter-spacing: -2px;
  line-height: 1.05;
  margin: 0 0 20px;
  color: #fff;
}

.nr-hero-thin { font-weight: 300; color: var(--nr-text-muted); }

.nr-hero-sub {
  font-size: 17px;
  color: var(--nr-text-muted);
  line-height: 1.6;
  margin: 0 0 40px;
  max-width: 440px;
}

.nr-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }

/* ── MAIN ────────────────────────────────── */
.nr-main {
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px 60px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* ── SECTION ─────────────────────────────── */
.nr-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.nr-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.nr-section-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--nr-text-muted);
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

/* ── BUTTONS ─────────────────────────────── */
.nr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-family: var(--nr-font);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  white-space: nowrap;
}
.nr-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.nr-btn:not(:disabled):active { transform: scale(0.97); }

.nr-btn-primary  { background: #fff; color: #000; }
.nr-btn-primary:not(:disabled):hover { background: #e8e8e8; }

.nr-btn-outline  { background: transparent; color: #fff; border: 1.5px solid #fff; }
.nr-btn-outline:not(:disabled):hover { background: rgba(255,255,255,0.08); }

.nr-btn-ghost    { background: transparent; color: var(--nr-text-muted); border: 1.5px solid var(--nr-border); }
.nr-btn-ghost:not(:disabled):hover { border-color: var(--nr-border-hi); color: #fff; }

.nr-btn-danger   { background: transparent; color: #fff; border: 1.5px solid #555; }
.nr-btn-danger:not(:disabled):hover { border-color: #888; }

.nr-btn-rsvp-on  { background: transparent; color: #fff; border: 1.5px solid #fff; }

.nr-btn-sm  { padding: 6px 14px; font-size: 12px; border-radius: 6px; }
.nr-btn-wide { width: 100%; }

/* ── INPUTS ──────────────────────────────── */
.nr-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--nr-surface);
  border: 1.5px solid var(--nr-border);
  border-radius: 8px;
  color: #fff;
  font-family: var(--nr-font);
  font-size: 14px;
  padding: 11px 14px;
  outline: none;
  transition: border-color 0.15s;
  color-scheme: dark;
}
.nr-input:focus { border-color: var(--nr-border-hi); }
.nr-input::placeholder { color: var(--nr-text-dim); }

.nr-select { max-width: 130px; }

/* ── FORMS ───────────────────────────────── */
.nr-form { display: flex; flex-direction: column; gap: 10px; }
.nr-form-bordered {
  border: 1px solid var(--nr-border);
  border-radius: 10px;
  padding: 16px;
}

.nr-form-row { display: flex; gap: 8px; }
.nr-form-actions { display: flex; gap: 8px; }

/* ── JOIN ROW ────────────────────────────── */
.nr-join-row { display: flex; gap: 8px; }
.nr-join-row .nr-input { flex: 1; }

/* ── VISIBILITY PICKER ───────────────────── */
.nr-vis-row { display: flex; gap: 8px; }
.nr-vis-opt {
  flex: 1;
  background: var(--nr-surface);
  border: 1.5px solid var(--nr-border);
  border-radius: 10px;
  padding: 12px 10px;
  font-family: var(--nr-font);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  transition: border-color 0.15s;
}
.nr-vis-opt.active { border-color: #fff; }
.nr-vis-icon { font-size: 20px; }
.nr-vis-label { font-size: 13px; font-weight: 700; color: #fff; }
.nr-vis-sub   { font-size: 11px; color: var(--nr-text-muted); }

/* ── LOCKED ROW ──────────────────────────── */
.nr-locked-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--nr-text-muted);
  cursor: pointer;
}
.nr-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #fff;
  cursor: pointer;
}

/* ── TALKS LIST ──────────────────────────── */
.nr-talks-list { display: flex; flex-direction: column; gap: 10px; }

.nr-talk-item {
  background: var(--nr-surface);
  border: 1px solid var(--nr-border);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-start;
  transition: border-color 0.15s;
}
.nr-talk-item:hover { border-color: var(--nr-border-hi); }

.nr-talk-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; cursor: pointer; }
.nr-talk-row  { display: flex; align-items: center; gap: 8px; }
.nr-talk-name { font-size: 15px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nr-talk-meta { font-size: 12px; color: var(--nr-text-muted); }
.nr-rsvp-count { font-size: 11px; color: var(--nr-text-muted); }

.nr-talk-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }

.nr-live-dot  { font-size: 11px; font-weight: 800; color: #fff; letter-spacing: 1px; }
.nr-live-badge {
  background: #fff;
  color: #000;
  font-size: 10px;
  font-weight: 800;
  border-radius: 20px;
  padding: 2px 10px;
  letter-spacing: 1px;
}

/* ── AUDIENCE PANEL ──────────────────────── */
.nr-audience {
  width: 100%;
  border-top: 1px solid var(--nr-border);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.nr-audience-stats { display: flex; gap: 16px; font-size: 12px; color: var(--nr-text-muted); flex-wrap: wrap; }
.nr-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.nr-pill {
  background: #1a1a1a;
  border: 1px solid var(--nr-border);
  border-radius: 20px;
  padding: 3px 12px;
  font-size: 12px;
  color: var(--nr-text-muted);
}
.nr-pill-invited { border-color: #555; color: #fff; }
.nr-invite-row { display: flex; gap: 8px; }
.nr-invite-row .nr-input { flex: 1; }
.nr-invite-msg { font-size: 12px; color: #fff; margin: 0; }

/* ── MISC ────────────────────────────────── */
.nr-empty {
  text-align: center;
  font-size: 13px;
  color: var(--nr-text-dim);
  padding: 24px 0;
}
.nr-empty-action { display: flex; }
.nr-loading-row { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--nr-text-muted); padding: 8px 0; }

.nr-hint { font-size: 12px; color: var(--nr-text-muted); margin: 0; line-height: 1.5; }
.nr-error-msg { font-size: 12px; color: #aaa; margin: 0; }

/* ── SPINNER ─────────────────────────────── */
.nr-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.25);
  border-top-color: #fff;
  border-radius: 50%;
  animation: nr-spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes nr-spin { to { transform: rotate(360deg); } }

/* ── FOOTER ──────────────────────────────── */
.nr-footer {
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: var(--nr-text-dim);
  border-top: 1px solid var(--nr-border);
  margin-top: auto;
}
.nr-footer-link { color: var(--nr-text-muted); text-decoration: none; }
.nr-footer-link:hover { color: #fff; }

/* ── RESPONSIVE ──────────────────────────── */
@media (max-width: 480px) {
  .nr-topbar { padding: 12px 16px; }
  .nr-main   { padding: 20px 14px 48px; gap: 28px; }
  .nr-form-row { flex-direction: column; }
  .nr-join-row { flex-direction: column; }
  .nr-vis-row  { flex-direction: column; }
  .nr-hero { padding: 60px 20px 40px; }
}
</style>
