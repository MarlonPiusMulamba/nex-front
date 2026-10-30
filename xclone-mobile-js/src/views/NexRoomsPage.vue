<template>
  <ion-page class="nr-ion-page">
    <ion-content class="nr-ion-content" :fullscreen="true">
      <div class="nr-shell">
        <!-- ═══════════════════════════════════════════════════
             TOP BAR
        ════════════════════════════════════════════════════ -->
        <header class="nr-topbar">
          <div class="nr-brand" @click="router.push('/rooms')">
            <img src="/nexrooms-logo.png" class="nr-logo" alt="NexRooms" />
            <span class="nr-brand-name">NexRooms</span>
          </div>
          <div class="nr-topbar-right">
            <span v-if="username" class="nr-user-pill">@{{ username }}</span>
            <button v-if="!userId" class="nr-btn nr-btn-outline nr-btn-sm" @click="goLogin">Sign in</button>
            <button v-else class="nr-btn nr-btn-ghost nr-btn-sm" @click="signOut">Sign out</button>
          </div>
        </header>

        <!-- ═══════════════════════════════════════════════════
             HERO (not logged in)
        ════════════════════════════════════════════════════ -->
        <section v-if="!userId" class="nr-hero">
          <div class="nr-hero-badge">NEXROOMS</div>
          <h1 class="nr-hero-title">Your meeting room.<br><span class="nr-hero-thin">Always ready.</span></h1>
          <p class="nr-hero-sub">Instant meetings, scheduled talks and breakout rooms.</p>
          <div class="nr-hero-actions">
            <button class="nr-btn nr-btn-primary" @click="goLogin">Get started</button>
            <button class="nr-btn nr-btn-outline" @click="goLogin">Join a meeting</button>
          </div>
        </section>

        <!-- ═══════════════════════════════════════════════════
             MAIN DASHBOARD (logged in)
        ════════════════════════════════════════════════════ -->
        <main v-else class="nr-main">

          <!-- ── ONGOING / REJOIN ACTIVE MEETING ─────────── -->
          <section v-if="activeMeetings.length > 0" class="nr-card nr-active-card">
            <div class="nr-card-header nr-between">
              <div>
                <span class="nr-card-tag nr-tag-live">● ONGOING LIVE MEETING</span>
                <h2 class="nr-card-title">{{ activeMeetings[0].title }}</h2>
                <p class="nr-card-desc">You have a live meeting in progress. Rejoin now or end it.</p>
              </div>
              <div class="nr-active-actions">
                <button class="nr-btn nr-btn-primary" @click="rejoinActiveSpace(activeMeetings[0])">
                  ▶ Rejoin Meeting
                </button>
                <button class="nr-btn nr-btn-ghost nr-btn-sm" @click="endActiveSpace(activeMeetings[0])">
                  End Call
                </button>
                <button class="nr-btn nr-btn-danger-outline nr-btn-sm" @click="deleteMeeting(activeMeetings[0])" title="Delete meeting">
                  🗑 Delete
                </button>
              </div>
            </div>
          </section>

          <!-- ── JOIN BY LINK ────────────────────────────── -->
          <section class="nr-card">
            <div class="nr-card-header">
              <span class="nr-card-tag">QUICK ACCESS</span>
              <h2 class="nr-card-title">Join a Room</h2>
              <p class="nr-card-desc">Enter a shareable link or meeting code to join immediately.</p>
            </div>
            <div class="nr-join-row">
              <input
                v-model="joinCode"
                class="nr-input"
                placeholder="Paste invite link or code (e.g. nex-talk-xyz)"
                @keyup.enter="joinByCode"
              />
              <button class="nr-btn nr-btn-primary" :disabled="!joinCode.trim() || joining" @click="joinByCode">
                <span v-if="joining" class="nr-spinner"></span>
                <span v-else>Join Room</span>
              </button>
            </div>
            <p v-if="joinError" class="nr-error-msg">{{ joinError }}</p>
          </section>

          <!-- ── INSTANT MEETING ─────────────────────────── -->
          <section class="nr-card">
            <div class="nr-card-header">
              <span class="nr-card-tag">NEW SESSION</span>
              <h2 class="nr-card-title">Instant Meeting</h2>
              <p class="nr-card-desc">Start a live audio/video room right now and invite guests.</p>
            </div>

            <div v-if="!showMeetingForm" class="nr-card-action">
              <button class="nr-btn nr-btn-outline nr-btn-wide" @click="showMeetingForm = true">
                + Start an Instant Meeting
              </button>
            </div>

            <div v-else class="nr-form">
              <input
                v-model="meetingTitle"
                class="nr-input"
                placeholder="Meeting title (e.g. Team Standup)"
                maxlength="120"
                autofocus
              />

              <div class="nr-vis-row">
                <button
                  type="button"
                  class="nr-vis-opt"
                  :class="{ active: meetingVisibility === 'unlisted' }"
                  @click="meetingVisibility = 'unlisted'"
                >
                  <span class="nr-vis-label">Private Room</span>
                  <span class="nr-vis-sub">Link + invite only</span>
                </button>
                <button
                  type="button"
                  class="nr-vis-opt"
                  :class="{ active: meetingVisibility === 'timeline' }"
                  @click="meetingVisibility = 'timeline'"
                >
                  <span class="nr-vis-label">Feed Room</span>
                  <span class="nr-vis-sub">Visible on timeline</span>
                </button>
              </div>

              <label class="nr-locked-row">
                <input type="checkbox" v-model="meetingLocked" class="nr-checkbox" />
                <span>Locked room — approve participants before they speak</span>
              </label>

              <label class="nr-locked-row nr-record-row">
                <input type="checkbox" v-model="meetingRecord" class="nr-checkbox" />
                <span>🔴 Record this meeting — saved to history when ended</span>
              </label>

              <div class="nr-form-actions">
                <button
                  class="nr-btn nr-btn-primary"
                  :disabled="creating || !meetingTitle.trim()"
                  @click="createInstantMeeting"
                >
                  <span v-if="creating" class="nr-spinner"></span>
                  <span v-else>Launch Meeting</span>
                </button>
                <button class="nr-btn nr-btn-ghost" @click="showMeetingForm = false; meetingTitle = ''">
                  Cancel
                </button>
              </div>
            </div>
          </section>

          <!-- ── SCHEDULED TALKS ─────────────────────────── -->
          <section class="nr-card">
            <div class="nr-card-header nr-between">
              <div>
                <span class="nr-card-tag">SCHEDULE</span>
                <h2 class="nr-card-title">
                  Scheduled Talks
                  <span v-if="liveCount > 0" class="nr-live-badge">{{ liveCount }} LIVE</span>
                </h2>
                <p class="nr-card-desc">Upcoming meetings and audio talks.</p>
              </div>
              <button class="nr-btn nr-btn-outline nr-btn-sm" @click="showScheduleForm = !showScheduleForm">
                {{ showScheduleForm ? 'Cancel' : '+ Schedule Talk' }}
              </button>
            </div>

            <!-- Schedule Form -->
            <div v-if="showScheduleForm" class="nr-form nr-schedule-box">
              <input v-model="formTitle" class="nr-input" placeholder="Talk title (e.g. Design review, revision session)" />
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
                  <span v-else>Save Schedule</span>
                </button>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="talks.length === 0 && !loading" class="nr-empty">
              <div class="nr-empty-icon">◻</div>
              <p class="nr-empty-title">No scheduled talks yet</p>
              <p class="nr-empty-sub">Plan an upcoming talk or click "+ Schedule Talk" above.</p>
            </div>

            <!-- Talks List -->
            <div v-else class="nr-talks-list">
              <div v-for="t in talks" :key="t.id" class="nr-talk-item">
                <div class="nr-talk-body" @click="t.live_space_id && joinTalk(t)">
                  <div class="nr-talk-row">
                    <span v-if="t.live_space_id" class="nr-live-dot">● LIVE</span>
                    <span class="nr-talk-name">{{ t.title }}</span>
                  </div>
                  <div class="nr-talk-meta">
                    <span>by @{{ t.host_username }}</span>
                    <span>•</span>
                    <span>{{ talkWhen(t) }}</span>
                    <span>•</span>
                    <span>{{ t.duration_minutes }}m</span>
                    <span v-if="t.rsvp_count" class="nr-rsvp-count">({{ t.rsvp_count }} RSVP)</span>
                  </div>
                </div>

                <div class="nr-talk-actions">
                  <button
                    v-if="!t.live_space_id"
                    class="nr-btn nr-btn-sm"
                    :class="t.user_has_rsvpd ? 'nr-btn-primary' : 'nr-btn-outline'"
                    @click="toggleRsvp(t)"
                  >
                    {{ t.user_has_rsvpd ? '✓ Attending' : 'RSVP' }}
                  </button>

                  <button
                    v-if="isHost(t) && !t.live_space_id"
                    class="nr-btn nr-btn-primary nr-btn-sm"
                    @click="startTalk(t)"
                  >
                    Start Talk
                  </button>

                  <button
                    v-if="t.live_space_id"
                    class="nr-btn nr-btn-primary nr-btn-sm"
                    @click="joinTalk(t)"
                  >
                    Join Live
                  </button>

                  <button
                    v-if="isHost(t)"
                    class="nr-btn nr-btn-ghost nr-btn-sm"
                    @click="toggleAudience(t)"
                  >
                    Audience
                  </button>

                  <button
                    v-if="isHost(t) && t.live_space_id"
                    class="nr-btn nr-btn-ghost nr-btn-sm"
                    @click="endTalk(t)"
                  >
                    End
                  </button>
                </div>

                <!-- Host Audience Panel -->
                <div v-if="audienceFor && audienceFor.id === t.id" class="nr-audience">
                  <div class="nr-audience-stats">
                    <span>RSVPs: {{ audienceData?.rsvps?.length || 0 }}</span>
                    <span>Invited: {{ audienceData?.invited?.length || 0 }}</span>
                  </div>

                  <div class="nr-pills" v-if="audienceData">
                    <span v-for="u in (audienceData.rsvps || [])" :key="'r-'+u.id" class="nr-pill">
                      @{{ u.username }}
                    </span>
                    <span v-for="u in (audienceData.invited || [])" :key="'i-'+u.id" class="nr-pill nr-pill-invited">
                      @{{ u.username }} (invited)
                    </span>
                  </div>

                  <div class="nr-invite-row">
                    <input
                      v-model="inviteName"
                      class="nr-input"
                      placeholder="Invite by username (e.g. alex)"
                      @keyup.enter="sendInvite"
                    />
                    <button class="nr-btn nr-btn-outline nr-btn-sm" :disabled="inviting" @click="sendInvite">
                      Invite
                    </button>
                  </div>
                  <p v-if="inviteMsg" class="nr-invite-msg">{{ inviteMsg }}</p>
                </div>
              </div>
            </div>
          </section>

        
          <!-- ── MEETING HISTORY & RECORDINGS ────────────── -->
          <section class="nr-card">
            <div class="nr-card-header nr-between">
              <div>
                <span class="nr-card-tag">ARCHIVE</span>
                <h2 class="nr-card-title">
                  Meeting History & Recordings
                  <span v-if="recordedHistory.length" class="nr-count-badge">{{ recordedHistory.length }}</span>
                </h2>
                <p class="nr-card-desc">Recorded meetings saved in history so you can play back what transpired.</p>
              </div>
              <button class="nr-btn nr-btn-outline nr-btn-sm" @click="fetchMySpaces" :disabled="loadingSpaces">
                <span v-if="loadingSpaces" class="nr-spinner"></span>
                <span v-else>↻ Refresh</span>
              </button>
            </div>

            <!-- Empty State -->
            <div v-if="recordedHistory.length === 0 && !loadingSpaces" class="nr-empty">
              <div class="nr-empty-icon">📼</div>
              <p class="nr-empty-title">No recorded meetings yet</p>
              <p class="nr-empty-sub">Enable "Record this meeting" when starting a meeting to keep its recording in history.</p>
            </div>

            <!-- History List -->
            <div v-else class="nr-history-list">
              <div v-for="m in recordedHistory" :key="m.id" class="nr-history-item">
                <div class="nr-history-info">
                  <div class="nr-history-title-row">
                    <span class="nr-history-title">{{ m.title }}</span>
                    <span v-if="m.recording_url" class="nr-rec-pill">● RECORDED</span>
                    <span v-else class="nr-rec-pill nr-rec-none">NO RECORDING</span>
                  </div>
                  <div class="nr-history-meta">
                    <span>{{ formatMeetingDate(m.ended_at || m.created_at) }}</span>
                    <span v-if="m.join_code">• Code: {{ m.join_code }}</span>
                  </div>
                </div>

                <div class="nr-history-actions">
                  <button
                    v-if="m.recording_url"
                    class="nr-btn nr-btn-primary nr-btn-sm"
                    @click="playRecording(m)"
                  >
                    ▶ Play Recording
                  </button>
                  <button
                    class="nr-btn nr-btn-danger-outline nr-btn-sm"
                    @click="deleteMeeting(m)"
                    title="Delete this meeting"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            </div>
          </section>

        </main>

        <!-- ═══════════════════════════════════════════════════
             AUDIO SPACE MODAL
        ════════════════════════════════════════════════════ -->
        
        <!-- ═══════════════════════════════════════════════════
             RECORDING PLAYBACK MODAL
        ════════════════════════════════════════════════════ -->
        <div v-if="showPlaybackModal && playingRecording" class="nr-modal-backdrop" @click="closePlayback">
          <div class="nr-modal-card" @click.stop>
            <div class="nr-modal-header">
              <div>
                <h3 class="nr-modal-title">{{ playingRecording.title }}</h3>
                <p class="nr-modal-sub">{{ formatMeetingDate(playingRecording.ended_at || playingRecording.created_at) }}</p>
              </div>
              <button class="nr-btn-close" @click="closePlayback">✕</button>
            </div>

            <div class="nr-player-wrap">
              <iframe
                v-if="isYouTube(playingRecording.recording_url)"
                :src="getYouTubeEmbed(playingRecording.recording_url)"
                class="nr-video-iframe"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
              <div v-else class="nr-video-box">
                <video
                  :key="playingRecording.id"
                  controls
                  playsinline
                  preload="metadata"
                  class="nr-video-player"
                  @error="videoLoadError = true"
                >
                  <source :src="getRecordingSrc(playingRecording.recording_url)" type="video/webm" />
                  <source :src="getRecordingSrc(playingRecording.recording_url)" type="video/mp4" />
                  Your browser does not support playing this video directly.
                </video>

                <div v-if="videoLoadError" class="nr-player-error-badge">
                  <p>⚠️ Video stream could not be loaded directly (file may be empty or corrupted).</p>
                  <div class="nr-err-btns">
                    <a :href="getRecordingSrc(playingRecording.recording_url)" target="_blank" class="nr-btn nr-btn-outline nr-btn-sm">
                      Open Direct Link
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div class="nr-modal-footer">
              <a
                v-if="playingRecording.recording_url && !isYouTube(playingRecording.recording_url)"
                :href="getRecordingSrc(playingRecording.recording_url)"
                download="meeting_recording.webm"
                target="_blank"
                class="nr-btn nr-btn-outline nr-btn-sm"
              >
                Download Recording
              </a>
              <button class="nr-btn nr-btn-ghost nr-btn-sm" @click="closePlayback">Close</button>
            </div>
          </div>
        </div>

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
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, onBeforeRouteUpdate } from 'vue-router';
import { IonPage, IonContent } from '@ionic/vue';
import axios from 'axios';
import config from '@/config/index.js';
import AudioSpaceModal from '@/components/AudioSpaceModal.vue';

const router = useRouter();
const API_URL = config.api.baseURL;

// ── Auth ─────────────────────────────────────────────
const userId     = ref(localStorage.getItem('userId'));
const username   = ref(localStorage.getItem('username') || '');
const userAvatar = ref(localStorage.getItem('userAvatar') || '');

// Re-read auth from localStorage (called after login redirect or storage change)
const refreshAuth = () => {
  const newId = localStorage.getItem('userId');
  const wasLoggedIn = !!userId.value;
  userId.value     = newId;
  username.value   = localStorage.getItem('username') || '';
  userAvatar.value = localStorage.getItem('userAvatar') || '';
  if (newId) {
    fetchTalks();
    fetchMySpaces();
    if (!refreshTimer) {
      refreshTimer = setInterval(() => {
        fetchTalks();
        fetchMySpaces();
      }, 30000);
    }
  }
};

// Trigger refreshAuth whenever this route is re-entered after a login push
onBeforeRouteUpdate(() => { refreshAuth(); });

// ── Join by code/link ─────────────────────────────────
const joinCode  = ref('');
const joining   = ref(false);
const joinError = ref('');

const joinByCode = async () => {
  joinError.value = '';
  let code = joinCode.value.trim();
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
const meetingRecord     = ref(false);
const creating          = ref(false);

// ── My Spaces & History ──────────────────────────────
const mySpaces        = ref([]);
const loadingSpaces   = ref(false);

const activeMeetings  = computed(() => {
  return mySpaces.value.filter(s => s.status === 'live');
});

const recordedHistory = computed(() => {
  return mySpaces.value.filter(s => s.status === 'ended');
});

const fetchMySpaces = async () => {
  if (!userId.value) return;
  loadingSpaces.value = true;
  try {
    const res = await axios.get(`${API_URL}/api/audio-spaces/my-history`, {
      params: { host_id: userId.value }
    });
    if (res.data?.success) {
      mySpaces.value = res.data.spaces || [];
    }
  } catch (err) {
    console.warn('fetchMySpaces failed', err);
  } finally {
    loadingSpaces.value = false;
  }
};

const rejoinActiveSpace = async (space) => {
  await openSpaceById(space.id);
};

const endActiveSpace = async (space) => {
  if (!confirm(`End "${space.title}" for everyone?`)) return;
  try {
    await axios.post(`${API_URL}/api/audio-spaces/${space.id}/end`, { user_id: userId.value });
    await fetchMySpaces();
  } catch (err) {
    console.error('endActiveSpace error', err);
  }
};

const deleteMeeting = async (meeting) => {
  if (!confirm(`Delete meeting "${meeting.title}"? This cannot be undone.`)) return;
  try {
    const res = await axios.delete(`${API_URL}/api/audio-spaces/${meeting.id}`, {
      params: { host_id: userId.value }
    });
    if (res.data?.success) {
      mySpaces.value = mySpaces.value.filter(s => s.id !== meeting.id);
    } else {
      alert(res.data?.message || 'Could not delete meeting');
    }
  } catch (err) {
    console.error('Delete meeting error:', err);
    alert('Failed to delete meeting');
  }
};

// ── Playback Modal ────────────────────────────────────
const playingRecording  = ref(null);
const showPlaybackModal = ref(false);
const videoLoadError    = ref(false);

const playRecording = (space) => {
  videoLoadError.value = false;
  playingRecording.value = space;
  showPlaybackModal.value = true;
};

const closePlayback = () => {
  playingRecording.value = null;
  showPlaybackModal.value = false;
  videoLoadError.value = false;
};

const getRecordingSrc = (url) => {
  if (!url) return '';
  url = url.trim().replace(/\?+$/, '');
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const isYouTube = (url) => {
  return /youtube\.com|youtu\.be/.test(url || '');
};

const getYouTubeEmbed = (url) => {
  if (!url) return '';
  const m = url.match(/(?:v=|youtu\.be\/)([\w-]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
};

const formatMeetingDate = (ts) => {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return ts;
  }
};

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
        is_locked: meetingLocked.value,
        is_record_enabled: meetingRecord.value ? 1 : 0
      });
      if (res.data?.success && res.data.space_id) await openSpaceById(res.data.space_id);
    } else {
      const res = await axios.post(`${API_URL}/api/audio-spaces`, {
        host_id: userId.value,
        title,
        visibility: 'unlisted',
        is_locked: meetingLocked.value ? 1 : 0,
        is_record_enabled: meetingRecord.value ? 1 : 0
      });
      if (res.data?.success && res.data.space_id) {
        await openSpaceById(res.data.space_id);
        fetchMySpaces();
      }
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
  fetchMySpaces();
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
  refreshAuth();
  window.addEventListener('talks-refresh', fetchTalks);
  window.addEventListener('nexrooms-auth', refreshAuth);
});
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  window.removeEventListener('talks-refresh', fetchTalks);
  window.removeEventListener('nexrooms-auth', refreshAuth);
});
</script>

<style>
/* Unscoped global override while on NexRooms */
html.nexrooms-theme,
body.nexrooms-theme,
html.nexrooms-theme ion-app,
html.nexrooms-theme ion-router-outlet,
html.nexrooms-theme .nr-ion-page,
html.nexrooms-theme .nr-ion-content {
  background-color: #000000 !important;
  --ion-background-color: #000000 !important;
  --background: #000000 !important;
  --ion-text-color: #ffffff !important;
  color: #ffffff !important;
}
</style>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

.nr-ion-page,
.nr-ion-content {
  --background: #000000 !important;
  background-color: #000000 !important;
  color: #ffffff !important;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.nr-shell {
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  background-color: #000000 !important;
  color: #ffffff !important;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* ── TOPBAR ──────────────────────────────── */
.nr-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #1a1a1a;
  position: sticky;
  top: 0;
  background: #000000;
  z-index: 100;
}

.nr-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.nr-logo {
  width: 34px;
  height: 34px;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid #222222;
}
.nr-brand-name {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #ffffff;
}

.nr-topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.nr-user-pill {
  font-size: 13px;
  color: #888888;
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
  padding: 80px 24px 60px;
  max-width: 680px;
  margin: 0 auto;
}

.nr-hero-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 2.5px;
  color: #888888;
  border: 1px solid #222222;
  padding: 4px 14px;
  border-radius: 20px;
  margin-bottom: 24px;
}

.nr-hero-title {
  font-size: clamp(38px, 8vw, 68px);
  font-weight: 900;
  letter-spacing: -2px;
  line-height: 1.05;
  margin: 0 0 20px;
  color: #ffffff;
}

.nr-hero-thin {
  font-weight: 300;
  color: #777777;
}

.nr-hero-sub {
  font-size: 17px;
  color: #888888;
  line-height: 1.6;
  margin: 0 0 40px;
  max-width: 460px;
}

.nr-hero-actions {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
}

/* ── MAIN ────────────────────────────────── */
.nr-main {
  max-width: 740px;
  width: 100%;
  margin: 0 auto;
  padding: 32px 20px 80px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  box-sizing: border-box;
}

/* ── CARD ────────────────────────────────── */
.nr-card {
  background: #0a0a0a;
  border: 1px solid #1f1f1f;
  border-radius: 14px;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}
.nr-card:hover {
  border-color: #2b2b2b;
}

.nr-card-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nr-card-header.nr-between {
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.nr-card-tag {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #666666;
  text-transform: uppercase;
}

.nr-card-title {
  font-size: 19px;
  font-weight: 800;
  color: #ffffff;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.nr-card-desc {
  font-size: 13px;
  color: #888888;
  margin: 0;
}

.nr-card-action {
  margin-top: 4px;
}

/* ── BUTTONS ─────────────────────────────── */
.nr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 8px;
  padding: 11px 20px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  box-sizing: border-box;
}
.nr-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.nr-btn:not(:disabled):active {
  transform: scale(0.98);
}

.nr-btn-primary {
  background: #ffffff !important;
  color: #000000 !important;
  border: 1px solid #ffffff !important;
}
.nr-btn-primary:not(:disabled):hover {
  background: #e6e6e6 !important;
}

.nr-btn-outline {
  background: transparent !important;
  color: #ffffff !important;
  border: 1px solid #333333 !important;
}
.nr-btn-outline:not(:disabled):hover {
  background: #161616 !important;
  border-color: #ffffff !important;
}

.nr-btn-ghost {
  background: transparent !important;
  color: #888888 !important;
  border: 1px solid #222222 !important;
}
.nr-btn-ghost:not(:disabled):hover {
  border-color: #444444 !important;
  color: #ffffff !important;
  background: #111111 !important;
}

.nr-btn-sm {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 6px;
}
.nr-btn-wide {
  width: 100%;
}

/* ── INPUTS ──────────────────────────────── */
.nr-input {
  width: 100%;
  box-sizing: border-box;
  background: #121212 !important;
  border: 1px solid #262626 !important;
  border-radius: 8px;
  color: #ffffff !important;
  font-family: inherit;
  font-size: 14px;
  padding: 12px 14px;
  outline: none;
  transition: border-color 0.15s ease;
  color-scheme: dark;
}
.nr-input:focus {
  border-color: #ffffff !important;
}
.nr-input::placeholder {
  color: #555555;
}

.nr-select {
  max-width: 130px;
}

/* ── FORMS ───────────────────────────────── */
.nr-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nr-schedule-box {
  background: #121212;
  border: 1px solid #222222;
  border-radius: 10px;
  padding: 16px;
  margin-top: 8px;
}

.nr-form-row {
  display: flex;
  gap: 10px;
}
.nr-form-actions {
  display: flex;
  gap: 10px;
}

/* ── JOIN ROW ────────────────────────────── */
.nr-join-row {
  display: flex;
  gap: 10px;
}
.nr-join-row .nr-input {
  flex: 1;
}

/* ── VISIBILITY PICKER ───────────────────── */
.nr-vis-row {
  display: flex;
  gap: 10px;
}
.nr-vis-opt {
  flex: 1;
  background: #121212;
  border: 1px solid #262626;
  border-radius: 8px;
  padding: 12px 14px;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
}
.nr-vis-opt.active {
  border-color: #ffffff;
  background: #1c1c1c;
}
.nr-vis-label {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
}
.nr-vis-sub {
  font-size: 11px;
  color: #888888;
}

/* ── LOCKED ROW ──────────────────────────── */
.nr-locked-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #888888;
  cursor: pointer;
}
.nr-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #ffffff;
  cursor: pointer;
}

/* ── TALKS LIST ──────────────────────────── */
.nr-talks-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nr-talk-item {
  background: #121212;
  border: 1px solid #222222;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  transition: border-color 0.15s ease;
}
.nr-talk-item:hover {
  border-color: #383838;
}

.nr-talk-body {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
}
.nr-talk-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nr-talk-name {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
}
.nr-talk-meta {
  font-size: 12px;
  color: #888888;
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.nr-rsvp-count {
  color: #aaaaaa;
}

.nr-talk-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.nr-live-dot {
  font-size: 11px;
  font-weight: 800;
  color: #ffffff;
  background: #222222;
  border: 1px solid #444444;
  padding: 2px 8px;
  border-radius: 12px;
}
.nr-live-badge {
  background: #ffffff;
  color: #000000;
  font-size: 10px;
  font-weight: 800;
  border-radius: 12px;
  padding: 2px 8px;
  letter-spacing: 1px;
}

/* ── AUDIENCE PANEL ──────────────────────── */
.nr-audience {
  width: 100%;
  border-top: 1px solid #222222;
  padding-top: 12px;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.nr-audience-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #888888;
}
.nr-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.nr-pill {
  background: #181818;
  border: 1px solid #282828;
  border-radius: 14px;
  padding: 3px 10px;
  font-size: 12px;
  color: #888888;
}
.nr-pill-invited {
  border-color: #555555;
  color: #ffffff;
}
.nr-invite-row {
  display: flex;
  gap: 8px;
}
.nr-invite-row .nr-input {
  flex: 1;
}
.nr-invite-msg {
  font-size: 12px;
  color: #ffffff;
  margin: 0;
}

/* ── EMPTY STATE ─────────────────────────── */
.nr-empty {
  text-align: center;
  padding: 36px 20px;
  border: 1px dashed #222222;
  border-radius: 10px;
  background: #0f0f0f;
}
.nr-empty-icon {
  font-size: 24px;
  color: #444444;
  margin-bottom: 8px;
}
.nr-empty-title {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 4px;
}
.nr-empty-sub {
  font-size: 12px;
  color: #666666;
  margin: 0;
}

/* ── SPINNER ─────────────────────────────── */
.nr-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: #000000;
  border-radius: 50%;
  animation: nr-spin 0.6s linear infinite;
  display: inline-block;
}
@keyframes nr-spin {
  to { transform: rotate(360deg); }
}

.nr-error-msg {
  font-size: 13px;
  color: #ffffff;
  background: #1a1a1a;
  border: 1px solid #333333;
  padding: 8px 12px;
  border-radius: 6px;
  margin: 6px 0 0;
}

/* ── FOOTER ──────────────────────────────── */
.nr-footer {
  text-align: center;
  font-size: 12px;
  color: #555555;
  padding: 32px 20px 48px;
  border-top: 1px solid #141414;
}
.nr-footer-link {
  color: #888888;
  text-decoration: none;
}
.nr-footer-link:hover {
  color: #ffffff;
}

@media (max-width: 600px) {
  .nr-main {
    padding: 16px 14px 60px;
    gap: 18px;
  }
  .nr-card {
    padding: 18px 16px;
  }
  .nr-join-row {
    flex-direction: column;
  }
  .nr-card-header.nr-between {
    flex-direction: column;
    align-items: stretch;
  }
  .nr-card-header.nr-between .nr-btn {
    align-self: flex-start;
  }
}

/* ── ACTIVE MEETING BANNER ──────────────── */
.nr-active-card {
  border: 1px solid #ef4444 !important;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(10, 10, 10, 0.95) 100%) !important;
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.15);
}
.nr-tag-live {
  color: #ef4444 !important;
  animation: recPulse 1.5s infinite ease-in-out;
}
.nr-active-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* ── HISTORY LIST ───────────────────────── */
.nr-history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.nr-history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  background: #121212;
  border: 1px solid #222;
  border-radius: 10px;
  transition: border-color 0.15s ease;
}
.nr-history-item:hover {
  border-color: #333;
}
.nr-history-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nr-history-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.nr-history-title {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
}
.nr-rec-pill {
  font-size: 10px;
  font-weight: 800;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 2px 8px;
  border-radius: 12px;
  letter-spacing: 0.5px;
}
.nr-rec-processing {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.3);
}
.nr-history-meta {
  font-size: 12px;
  color: #777;
  display: flex;
  gap: 6px;
}
.nr-saving-note {
  font-size: 12px;
  color: #888;
  font-style: italic;
}
.nr-count-badge {
  display: inline-block;
  font-size: 11px;
  background: #222;
  color: #aaa;
  padding: 1px 7px;
  border-radius: 10px;
  margin-left: 6px;
}

/* ── PLAYBACK MODAL ─────────────────────── */
.nr-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}
.nr-modal-card {
  width: 100%;
  max-width: 800px;
  background: #0d0d0d;
  border: 1px solid #262626;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
}
.nr-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #1f1f1f;
}
.nr-modal-title {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}
.nr-modal-sub {
  font-size: 12px;
  color: #888;
  margin: 2px 0 0;
}
.nr-btn-close {
  background: transparent;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: color 0.15s;
}
.nr-btn-close:hover {
  color: #fff;
  background: #1a1a1a;
}
.nr-player-wrap {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nr-video-player,
.nr-video-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #000;
}
.nr-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid #1f1f1f;
  background: #0a0a0a;
}

.nr-video-box {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #000;
}
.nr-player-error-badge {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  text-align: center;
  color: #ef4444;
  font-size: 13px;
}
.nr-err-btns {
  display: flex;
  gap: 10px;
}

.nr-btn-danger-outline {
  background: transparent !important;
  color: #ef4444 !important;
  border: 1px solid rgba(239, 68, 68, 0.4) !important;
}
.nr-btn-danger-outline:hover {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: #ef4444 !important;
}
.nr-rec-none {
  color: #888888;
  background: #1a1a1a;
  border: 1px solid #333333;
}
</style>
