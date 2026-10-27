<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title class="talks-page-title">Talks</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <div class="talks-card instant-card">
        <button v-if="!showMeetingForm" class="talk-schedule-toggle" @click="showMeetingForm = true">
          + New instant meeting
        </button>
        <div v-else class="talk-form">
          <input v-model="meetingTitle" placeholder="Meeting title" maxlength="120" class="talk-input" />
          <div class="vis-row">
            <button
              class="vis-opt" :class="{ active: meetingVisibility === 'unlisted' }"
              @click="meetingVisibility = 'unlisted'"
            >🔒 Private <span>link + invites only</span></button>
            <button
              class="vis-opt" :class="{ active: meetingVisibility === 'timeline' }"
              @click="meetingVisibility = 'timeline'"
            >📢 Timeline <span>posted on feed</span></button>
          </div>
          <label class="locked-row">
            <input type="checkbox" v-model="meetingLocked" />
            Locked (approve each join)
          </label>
          <div class="talk-form-actions">
            <button class="talk-btn start" @click="createInstantMeeting" :disabled="creating || !meetingTitle.trim()">
              {{ creating ? 'Creating…' : 'Start now' }}
            </button>
            <button class="talk-btn ghost" @click="showMeetingForm = false">Cancel</button>
          </div>
          <p v-if="meetingVisibility === 'unlisted'" class="talk-hint">
            Private meetings never appear on feeds — share the invite link from inside, or invite NexFi users by name.
          </p>
        </div>
      </div>

      <UpcomingTalks
        :currentUser="{ id: userId, username: username }"
        :forceExpanded="true"
        @join-space="handleJoinSpace"
      />
      <div class="talks-page-hint">
        Schedule a talk, share the invite link, or join one that's live.
      </div>

      <AudioSpaceModal
        :is-open="showSpaceModal"
        :space="currentSpace"
        :currentUser="{ id: userId, username: username, first_name: '', profile_pic: userAvatar }"
        @close="showSpaceModal = false"
        @minimize="showSpaceModal = false"
        @leave="leaveSpace"
        @switch-space="switchSpaceRoom"
      />
    </ion-content>
  </ion-page>
</template>

<script>
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent
} from '@ionic/vue';
import axios from 'axios';
import config from '@/config/index.js';
import UpcomingTalks from '@/components/UpcomingTalks.vue';
import AudioSpaceModal from '@/components/AudioSpaceModal.vue';

export default {
  name: 'TalksPage',
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
    UpcomingTalks, AudioSpaceModal
  },
  data() {
    return {
      userId: localStorage.getItem('userId'),
      username: localStorage.getItem('username') || 'user',
      userAvatar: localStorage.getItem('userAvatar') || '',
      API_URL: config.api.baseURL,
      showSpaceModal: false,
      currentSpace: null,
      spaceHistory: [],
      showMeetingForm: false,
      meetingTitle: '',
      meetingVisibility: 'unlisted',
      meetingLocked: false,
      creating: false
    };
  },
  methods: {
    async openSpaceById(spaceId) {
      try {
        const res = await axios.get(`${this.API_URL}/api/audio-spaces/${spaceId}`, {
          params: { user_id: this.userId }
        });
        if (res.data && res.data.success) {
          this.currentSpace = res.data.space;
          this.showSpaceModal = true;
          this.showMeetingForm = false;
          this.meetingTitle = '';
          return true;
        }
      } catch (e) {
        console.error('open space failed', e);
      }
      return false;
    },
    async createInstantMeeting() {
      const title = (this.meetingTitle || '').trim();
      if (!title || this.creating) return;
      this.creating = true;
      try {
        if (this.meetingVisibility === 'timeline') {
          const res = await axios.post(`${this.API_URL}/api/post`, {
            user_id: this.userId,
            content: title,
            audio_space_title: title,
            is_locked: this.meetingLocked
          });
          if (res.data?.success && res.data.space_id) {
            await this.openSpaceById(res.data.space_id);
          }
        } else {
          const res = await axios.post(`${this.API_URL}/api/audio-spaces`, {
            host_id: this.userId,
            title,
            visibility: 'unlisted',
            is_locked: this.meetingLocked ? 1 : 0
          });
          if (res.data?.success && res.data.space_id) {
            await this.openSpaceById(res.data.space_id);
          }
        }
      } catch (e) {
        console.error('create meeting failed', e);
      } finally {
        this.creating = false;
      }
    },
    handleJoinSpace(space) {
      this.currentSpace = space;
      this.showSpaceModal = true;
    },
    leaveSpace() {
      this.showSpaceModal = false;
      this.currentSpace = null;
      this.spaceHistory = [];
    },
    async switchSpaceRoom(room) {
      if (!room || !room.id) return;
      const last = this.spaceHistory[this.spaceHistory.length - 1];
      if (room.__returnMain && last && String(last.id) === String(room.id)) {
        this.currentSpace = this.spaceHistory.pop();
        return;
      }
      if (this.currentSpace) {
        this.spaceHistory.push(this.currentSpace);
        if (this.spaceHistory.length > 10) this.spaceHistory.shift();
      }
      try {
        const res = await axios.get(`${this.API_URL}/api/audio-spaces/${room.id}`, {
          params: { user_id: this.userId }
        });
        this.currentSpace = res.data && res.data.success
          ? res.data.space
          : { id: room.id, title: room.title || 'Breakout room' };
      } catch (_) {
        this.currentSpace = { id: room.id, title: room.title || 'Breakout room' };
      }
      this.showSpaceModal = true;
    }
  }
};
</script>

<style scoped>
.talks-page-title {
  font-family: var(--nx-font, 'Inter', sans-serif);
  font-weight: 800;
  letter-spacing: -0.5px;
}
.talks-page-hint {
  text-align: center;
  font-size: 12px;
  color: var(--ion-color-medium, #8b949e);
  padding: 16px 24px 32px;
}
.instant-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  margin: 12px 12px 0;
  padding: 12px;
}
.vis-row { display: flex; gap: 8px; }
.vis-opt {
  flex: 1; background: #0d1117; border: 1px solid #30363d; color: #c9d1d9;
  border-radius: 10px; padding: 10px 8px; font-size: 13px; font-weight: 700;
  cursor: pointer; display: flex; flex-direction: column; gap: 2px; align-items: center;
}
.vis-opt span { font-size: 11px; font-weight: 400; color: #8b949e; }
.vis-opt.active { border-color: #daa520; color: #fff; background: rgba(218, 165, 32, 0.08); }
.locked-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: #c9d1d9; cursor: pointer;
}
.locked-row input { width: 16px; height: 16px; accent-color: #daa520; }
.instant-card .talk-form { display: flex; flex-direction: column; gap: 8px; }
.instant-card .talk-input {
  background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
  padding: 9px 12px; color: #fff; font-size: 13px; outline: none; width: 100%;
  color-scheme: dark;
}
.instant-card .talk-input:focus { border-color: #1f6feb; }
.instant-card .talk-form-actions { display: flex; gap: 8px; }
.instant-card .talk-btn {
  border: none; border-radius: 8px; padding: 8px 16px;
  font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
}
.instant-card .talk-btn.start { background: #238636; color: #fff; }
.instant-card .talk-btn.ghost { background: transparent; color: #c9d1d9; border: 1px solid #30363d; }
.instant-card .talk-hint { font-size: 11px; color: #8b949e; margin: 0; line-height: 1.5; }
.instant-card .talk-schedule-toggle {
  width: 100%; background: transparent; border: 1px dashed #30363d; color: #58a6ff;
  border-radius: 8px; padding: 9px; font-size: 13px; font-weight: 700; cursor: pointer;
}
</style>
