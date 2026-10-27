<template>
  <ion-page class="talk-room-page">
    <!-- Minimal chrome: meeting only, no feed/tabs interruptions -->
    <div class="talk-topbar" v-if="status === 'meeting'">
      <span class="talk-brand">NexFi Talk</span>
      <span class="talk-room-name">{{ space?.title }}</span>
    </div>

    <div v-if="status === 'loading'" class="talk-state">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Opening meeting…</p>
    </div>

    <div v-else-if="status === 'error'" class="talk-state">
      <div class="talk-state-card">
        <h3>{{ errorMsg }}</h3>
        <p v-if="ended">This meeting link is no longer live.</p>
        <p v-else>Check the link and try again.</p>
        <button class="talk-primary-btn" @click="$router.push('/tabs/feed')">Open NexFi</button>
      </div>
    </div>

    <div v-else-if="status === 'need-name'" class="talk-state">
      <div class="talk-state-card">
        <h3>{{ space?.title || 'Join meeting' }}</h3>
        <p class="talk-sub">{{ hostLine }}</p>
        <input
          v-model="displayName"
          placeholder="Your name"
          maxlength="40"
          class="talk-name-input"
          @keyup.enter="claimGuest"
        />
        <input
          v-model="contactEmail"
          placeholder="Email for attendance (optional)"
          maxlength="120"
          inputmode="email"
          class="talk-name-input"
          @keyup.enter="claimGuest"
        />
        <button class="talk-primary-btn" @click="claimGuest" :disabled="claiming || !displayName.trim()">
          {{ claiming ? 'Joining…' : 'Join meeting' }}
        </button>
        <button class="talk-link-btn" @click="$router.push('/login')">I have a NexFi account</button>
      </div>
    </div>

    <div v-else-if="status === 'left'" class="talk-state">
      <div class="talk-state-card">
        <h3>You left the meeting</h3>
        <p class="talk-sub">Thanks for joining{{ space?.title ? ` “${space.title}”` : '' }}.</p>
        <button class="talk-primary-btn" @click="rejoin">Rejoin</button>
        <button class="talk-link-btn" @click="$router.push('/tabs/feed')">Open NexFi</button>
      </div>
    </div>

    <AudioSpaceModal
      v-if="status === 'meeting' && space && me"
      :is-open="true"
      :space="space"
      :currentUser="me"
      @close="status = 'left'"
      @minimize="() => {}"
      @leave="onLeave"
      @switch-space="switchSpaceRoom"
    />

    <div class="talk-powered" v-if="status !== 'meeting'">Powered by NexFi</div>
  </ion-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonSpinner } from '@ionic/vue';
import axios from 'axios';
import config from '@/config/index.js';
import AudioSpaceModal from '@/components/AudioSpaceModal.vue';

const API_URL = config.api.baseURL;
const route = useRoute();

const code = computed(() => String(route.params.code || '').trim());
const status = ref('loading'); // loading | need-name | meeting | left | error
const space = ref(null);
const me = ref(null);
const displayName = ref('');
const contactEmail = ref('');
const claiming = ref(false);
const errorMsg = ref('Meeting not found');
const ended = ref(false);
const spaceHistory = ref([]);

const guestKey = () => `talk_guest_${code.value}`;

const hostLine = computed(() => {
  const s = space.value;
  if (!s) return '';
  const host = s.host_username ? `@${s.host_username}` : 'the host';
  return `Hosted by ${host} · no account needed`;
});

const storedIdentity = () => {
  try {
    const uid = localStorage.getItem('userId');
    if (uid && uid !== '0' && uid !== 'null' && uid !== 'undefined') {
      return {
        id: uid,
        username: localStorage.getItem('username') || 'user',
        first_name: '',
        profile_pic: localStorage.getItem('userAvatar') || '',
        fromLogin: true
      };
    }
    const g = sessionStorage.getItem(guestKey());
    if (g) {
      const guest = JSON.parse(g);
      if (guest && guest.id) {
        return { id: String(guest.id), username: guest.username, first_name: guest.name || '', profile_pic: '' };
      }
    }
  } catch (_) { /* non-fatal */ }
  return null;
};

const joinAsMemberViaLink = async (uid) => {
  // Logged-in member presenting a valid link: the code itself authorizes
  // entry (invite recorded server-side), including to unlisted rooms.
  try {
    const res = await axios.post(`${API_URL}/api/talks/join/${encodeURIComponent(code.value)}/member`, {
      user_id: uid
    });
    if (res.data?.success && res.data.space) {
      space.value = res.data.space;
      return true;
    }
  } catch (err) {
    console.warn('member link join:', err.response?.data?.message || err.message);
  }
  return false;
};

const resolveSpace = async () => {
  status.value = 'loading';
  ended.value = false;
  try {
    const res = await axios.get(`${API_URL}/api/talks/join/${encodeURIComponent(code.value)}`);
    if (res.data?.success) {
      space.value = res.data.space;
      const identity = storedIdentity();
      if (identity) {
        if (identity.fromLogin) {
          // Ensure link-based authorization is recorded (matters for
          // unlisted rooms the member was never explicitly invited to).
          await joinAsMemberViaLink(identity.id);
          delete identity.fromLogin;
        }
        me.value = identity;
        status.value = 'meeting';
      } else {
        status.value = 'need-name';
      }
    } else {
      throw new Error(res.data?.message || 'Meeting not found');
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Meeting not found';
    errorMsg.value = msg;
    ended.value = err.response?.status === 410 || /ended/i.test(msg);
    status.value = 'error';
  }
};

const claimGuest = async () => {
  const name = (displayName.value || '').trim();
  if (!name || claiming.value) return;
  claiming.value = true;
  try {
    const res = await axios.post(`${API_URL}/api/talks/join/${encodeURIComponent(code.value)}/guest`, {
      display_name: name,
      email: (contactEmail.value || '').trim() || undefined
    });
    if (res.data?.success) {
      if (res.data.space) space.value = res.data.space;
      const g = res.data.guest;
      try {
        sessionStorage.setItem(guestKey(), JSON.stringify({ id: g.user_id, username: g.username, name: g.display_name }));
      } catch (_) { /* non-fatal */ }
      me.value = { id: String(g.user_id), username: g.username, first_name: g.display_name, profile_pic: '' };
      status.value = 'meeting';
    } else {
      errorMsg.value = res.data?.message || 'Could not join';
      ended.value = /ended/i.test(errorMsg.value);
      status.value = 'error';
    }
  } catch (err) {
    const msg = err.response?.data?.message || 'Could not join this meeting';
    errorMsg.value = msg;
    ended.value = err.response?.status === 410 || /ended/i.test(msg);
    status.value = 'error';
  } finally {
    claiming.value = false;
  }
};

const onLeave = () => {
  status.value = 'left';
  space.value = null;
  spaceHistory.value = [];
};

const rejoin = () => {
  spaceHistory.value = [];
  resolveSpace();
};

const switchSpaceRoom = async (room) => {
  if (!room || !room.id) return;
  const last = spaceHistory.value[spaceHistory.value.length - 1];
  if (room.__returnMain && last && String(last.id) === String(room.id)) {
    space.value = spaceHistory.value.pop();
    return;
  }
  if (space.value) {
    spaceHistory.value.push(space.value);
    if (spaceHistory.value.length > 10) spaceHistory.value.shift();
  }
  try {
    const res = await axios.get(`${API_URL}/api/audio-spaces/${room.id}`, {
      params: { user_id: me.value?.id }
    });
    space.value = res.data?.success ? res.data.space : { id: room.id, title: room.title || 'Breakout room' };
  } catch (_) {
    space.value = { id: room.id, title: room.title || 'Breakout room' };
  }
};

onMounted(() => {
  if (!code.value) {
    errorMsg.value = 'Meeting not found';
    status.value = 'error';
    return;
  }
  resolveSpace();
});
</script>

<style scoped>
.talk-room-page {
  --background: #0d1117;
  background: #0d1117;
  color: #fff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.talk-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: color-mix(in srgb, #161b22 88%, transparent);
  border-bottom: 1px solid #30363d;
  font-size: 13px;
}
@supports (backdrop-filter: blur(18px)) {
  .talk-topbar {
    backdrop-filter: blur(18px) saturate(1.3);
    -webkit-backdrop-filter: blur(18px) saturate(1.3);
  }
}
.talk-brand {
  font-weight: 800;
  letter-spacing: -0.3px;
  background: linear-gradient(135deg, #daa520 0%, #ffd700 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: #daa520;
}
.talk-room-name {
  color: #c9d1d9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.talk-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px;
  color: #8b949e;
}
.talk-state-card {
  width: 100%;
  max-width: 360px;
  text-align: center;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 14px;
  padding: 28px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.talk-state-card h3 { margin: 0; color: #fff; font-size: 18px; }
.talk-sub { margin: 0; font-size: 13px; color: #8b949e; }
.talk-name-input {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 10px;
  padding: 12px 14px;
  color: #fff;
  font-size: 15px;
  outline: none;
  text-align: center;
}
.talk-name-input:focus { border-color: #daa520; }
.talk-primary-btn {
  background: #daa520;
  color: #000;
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}
.talk-primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.talk-link-btn {
  background: transparent;
  border: none;
  color: #58a6ff;
  font-size: 13px;
  cursor: pointer;
}
.talk-powered {
  text-align: center;
  font-size: 11px;
  color: #6e7681;
  padding: 10px;
}
</style>
