<template>
  <div class="talks-card" v-if="currentUser?.id">
    <div class="talks-header" @click="expanded = !expanded">
      <div class="talks-title">
        <ion-icon :icon="videocamOutline"></ion-icon>
        <span>Upcoming Talks</span>
        <span v-if="liveCount > 0" class="talks-live-badge">{{ liveCount }} live</span>
      </div>
      <ion-icon :icon="expanded ? chevronUpOutline : chevronDownOutline"></ion-icon>
    </div>

    <div v-if="expanded" class="talks-body">
      <div v-if="talks.length === 0 && !loading" class="talks-empty">
        No talks scheduled. Plan the next one below.
      </div>
      <div v-for="t in talks" :key="t.id" class="talk-item">
        <div class="talk-info">
          <span class="talk-name">{{ t.title }}</span>
          <span class="talk-sub">@{{ t.host_username }} · {{ talkWhen(t) }}</span>
        </div>
        <span v-if="t.live_space_id" class="talk-live-dot">LIVE</span>
        <button
          v-if="String(t.host_user_id) === String(currentUser.id) && !t.live_space_id"
          class="talk-btn start" @click="startTalk(t)">Start</button>
        <button
          v-else-if="t.live_space_id"
          class="talk-btn join" @click="joinTalk(t)">Join</button>
        <span v-else class="talk-wait">soon</span>
      </div>

      <button v-if="!showForm" class="talk-schedule-toggle" @click="showForm = true">
        + Schedule a talk
      </button>
      <div v-if="showForm" class="talk-form">
        <input v-model="formTitle" placeholder="Talk title (e.g. Physics 101 revision)" class="talk-input" />
        <div class="talk-form-row">
          <input v-model="formStartsAt" type="datetime-local" class="talk-input" />
          <select v-model.number="formDuration" class="talk-input talk-duration">
            <option :value="15">15 min</option>
            <option :value="30">30 min</option>
            <option :value="60">1 hour</option>
            <option :value="120">2 hours</option>
          </select>
        </div>
        <div class="talk-form-actions">
          <button class="talk-btn start" @click="schedule" :disabled="scheduling">
            {{ scheduling ? 'Saving…' : 'Schedule' }}
          </button>
          <button class="talk-btn ghost" @click="showForm = false">Cancel</button>
        </div>
        <p class="talk-hint">Everyone gets a reminder 10 minutes before, and the room opens automatically at start time.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { IonIcon } from '@ionic/vue';
import { videocamOutline, chevronUpOutline, chevronDownOutline } from 'ionicons/icons';
import axios from 'axios';
import config from '@/config/index.js';

const API_URL = config.api.baseURL;

const props = defineProps({
  currentUser: Object
});
const emit = defineEmits(['join-space']);

const talks = ref([]);
const loading = ref(false);
const expanded = ref(false);
const showForm = ref(false);
const scheduling = ref(false);
const formTitle = ref('');
const formStartsAt = ref('');
const formDuration = ref(30);
let refreshTimer = null;

const liveCount = computed(() => talks.value.filter(t => t.live_space_id).length);

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
  } catch (_) {
    return '';
  }
};

const fetchTalks = async () => {
  loading.value = true;
  try {
    const res = await axios.get(`${API_URL}/api/talks/upcoming`);
    if (res.data?.success) {
      talks.value = res.data.talks || [];
      if (talks.value.length > 0) expanded.value = true;
    }
  } catch (err) {
    console.warn('upcoming talks failed', err);
  } finally {
    loading.value = false;
  }
};

const schedule = async () => {
  if (!formTitle.value.trim() || !formStartsAt.value) {
    alert('Add a title and start time');
    return;
  }
  scheduling.value = true;
  try {
    const res = await axios.post(`${API_URL}/api/talks/schedule`, {
      host_id: props.currentUser.id,
      title: formTitle.value.trim(),
      starts_at: new Date(formStartsAt.value).toISOString(),
      duration_minutes: formDuration.value
    });
    if (res.data?.success) {
      formTitle.value = '';
      formStartsAt.value = '';
      showForm.value = false;
      expanded.value = true;
      fetchTalks();
    } else {
      alert(res.data?.message || 'Could not schedule talk');
    }
  } catch (err) {
    console.error('schedule talk error', err);
  } finally {
    scheduling.value = false;
  }
};

const fetchSpaceAndJoin = async (spaceId) => {
  const res = await axios.get(`${API_URL}/api/audio-spaces/${spaceId}`);
  if (res.data?.success) {
    emit('join-space', res.data.space);
    return true;
  }
  return false;
};

const startTalk = async (t) => {
  try {
    const res = await axios.post(`${API_URL}/api/audio-spaces`, {
      host_id: props.currentUser.id,
      title: t.title
    });
    if (res.data?.success && res.data.space_id) {
      await axios.post(`${API_URL}/api/talks/${t.id}/link`, {
        host_id: props.currentUser.id,
        space_id: res.data.space_id
      }).catch(() => {});
      fetchTalks();
      await fetchSpaceAndJoin(res.data.space_id);
    }
  } catch (err) {
    console.error('start talk error', err);
  }
};

const joinTalk = async (t) => {
  if (!t.live_space_id) return;
  try {
    await fetchSpaceAndJoin(t.live_space_id);
  } catch (err) {
    console.error('join talk error', err);
  }
};

onMounted(() => {
  fetchTalks();
  refreshTimer = setInterval(fetchTalks, 60000);
  window.addEventListener('talks-refresh', fetchTalks);
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  window.removeEventListener('talks-refresh', fetchTalks);
});
</script>

<style scoped>
.talks-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  margin: 12px 12px 0;
  overflow: hidden;
}
.talks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  cursor: pointer;
  color: #e6edf3;
}
.talks-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; }
.talks-title ion-icon { font-size: 18px; color: #7dd3fc; }
.talks-live-badge {
  background: rgba(220, 38, 38, 0.2); color: #f87171;
  font-size: 11px; font-weight: 700; border-radius: 10px; padding: 2px 8px;
}
.talks-body { border-top: 1px solid #21262d; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
.talks-empty { font-size: 13px; color: #8b949e; text-align: center; padding: 6px 0; }
.talk-item {
  display: flex; align-items: center; gap: 8px;
  background: #0d1117; border: 1px solid #21262d; border-radius: 10px; padding: 9px 12px;
}
.talk-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.talk-name { font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.talk-sub { font-size: 12px; color: #8b949e; }
.talk-live-dot { color: #ef4444; font-size: 11px; font-weight: 700; }
.talk-wait { font-size: 12px; color: #8b949e; font-style: italic; }
.talk-btn {
  border: none; border-radius: 8px; padding: 8px 16px;
  font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
}
.talk-btn.start { background: #238636; color: #fff; }
.talk-btn.join { background: #1f6feb; color: #fff; }
.talk-btn.ghost { background: transparent; color: #c9d1d9; border: 1px solid #30363d; }
.talk-schedule-toggle {
  background: transparent; border: 1px dashed #30363d; color: #58a6ff;
  border-radius: 8px; padding: 9px; font-size: 13px; font-weight: 700; cursor: pointer;
}
.talk-form { display: flex; flex-direction: column; gap: 8px; }
.talk-input {
  background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
  padding: 9px 12px; color: #fff; font-size: 13px; outline: none; width: 100%;
  color-scheme: dark;
}
.talk-input:focus { border-color: #1f6feb; }
.talk-form-row { display: flex; gap: 8px; }
.talk-duration { max-width: 110px; }
.talk-form-actions { display: flex; gap: 8px; }
.talk-hint { font-size: 11px; color: #8b949e; margin: 0; line-height: 1.5; }
</style>
