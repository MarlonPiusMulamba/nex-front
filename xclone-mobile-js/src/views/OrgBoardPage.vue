<template>
  <ion-page>
    <ion-header>
      <ion-toolbar class="glass-toolbar">
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/notices"></ion-back-button>
        </ion-buttons>
        <div class="org-header-title" v-if="org">
          <img :src="org.logo_url || defaultLogo" class="mini-logo" />
          <ion-title>{{ org.name }}</ion-title>
        </div>
        <ion-buttons slot="end">
          <ion-button v-if="isAdmin" @click="showAdminPanel = true">
            <ion-icon slot="icon-only" :icon="settingsOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div v-if="loading && !org" class="loading-state">
        <ion-spinner name="crescent" color="gold"></ion-spinner>
      </div>

      <div v-else-if="locked" class="locked-state">
        <div class="lock-wrapper">
          <ion-icon :icon="lockClosedOutline" class="lock-icon"></ion-icon>
          <div class="pulse-ring"></div>
        </div>
        <h2>Private Board</h2>
        <p>This notice board is restricted to verified members of {{ org?.name }}.</p>
        
        <div class="action-box">
          <ion-button 
            v-if="!membership || membership.status === 'rejected'" 
            @click="requestToJoin" 
            color="gold"
            :disabled="joining"
          >
            <ion-spinner v-if="joining" name="crescent"></ion-spinner>
            <span v-else>Request Access</span>
          </ion-button>
          
          <div v-else-if="membership.status === 'pending'" class="pending-badge">
            <ion-icon :icon="timeOutline"></ion-icon>
            <span>Awaiting Admin Approval</span>
          </div>

          <div v-else-if="membership.status === 'invited'" class="invite-box">
             <p>You have been invited to join this board.</p>
             <ion-button @click="acceptInvite" color="success">Accept Invite</ion-button>
          </div>
        </div>
      </div>

      <div v-else-if="org" class="board-feed">
        <!-- Feed Top Banner -->
        <div class="org-banner">
          <div class="org-stats">
            <div class="stat">
              <span class="val">{{ notices.length }}</span>
              <span class="lab">Notices</span>
            </div>
            <div class="stat">
              <span class="val">{{ departments.length }}</span>
              <span class="lab">Depts</span>
            </div>
          </div>
        </div>

        <!-- Pending Invitation Banner -->
        <div v-if="membership && membership.status === 'invited'" class="feed-invite-banner">
          <div class="banner-text">
            <h4>Join Notice Board</h4>
            <p>You have been invited to join this board as a {{ formatRole(membership.role) }}.</p>
          </div>
          <ion-button @click="acceptInvite" color="success" size="small">
            Accept Invite
          </ion-button>
        </div>

        <!-- Filters -->
        <div class="filter-bar">
          <div class="category-scroll">
            <ion-chip 
              v-for="cat in categories" 
              :key="cat"
              :class="{ 'active-chip': selectedCategory === cat }"
              @click="toggleCategory(cat)"
            >
              <ion-label>{{ cat }}</ion-label>
            </ion-chip>
          </div>

          <div class="dept-selector" v-if="departments.length > 0">
            <ion-select 
              v-model="selectedDept" 
              interface="popover" 
              placeholder="All Departments"
              class="custom-select"
            >
              <ion-select-option :value="null">All Departments</ion-select-option>
              <ion-select-option 
                v-for="dept in departments" 
                :key="dept.id" 
                :value="dept.id"
              >
                {{ dept.name }}
              </ion-select-option>
            </ion-select>
          </div>
        </div>

        <!-- Notices -->
        <div class="notice-list">
          <div v-if="fetchingNotices" class="feed-loading">
            <ion-spinner name="dots" color="gold"></ion-spinner>
          </div>

          <div v-else-if="notices.length === 0" class="empty-feed">
            <ion-icon :icon="documentTextOutline"></ion-icon>
            <p>No official notices in this category.</p>
          </div>
          
          <div 
            v-for="notice in notices" 
            :key="notice.id" 
            class="notice-card"
            :class="{ 'urgent-card': notice.category === 'Urgent', 'pinned-card': notice.is_pinned }"
          >
            <div class="notice-header">
              <div class="author-info">
                <img :src="notice.author_avatar || defaultAvatar" class="auth-pic" />
                <div class="auth-meta">
                  <span class="auth-name">{{ notice.dept_name || notice.org_name || 'General' }}</span>
                  <span class="auth-dept">Posted by {{ notice.author_username }}</span>
                </div>
              </div>
              <div class="notice-badges">
                <ion-icon :icon="pushOutline" v-if="notice.is_pinned" class="pin-icon"></ion-icon>
                <ion-badge :color="getCategoryColor(notice.category)">
                  {{ notice.category }}
                </ion-badge>
              </div>
            </div>

            <div class="notice-body">
              <h3>{{ notice.title }}</h3>
              <p>{{ notice.body }}</p>
            </div>

            <div v-if="notice.attachment_url" class="notice-attachment" @click="openAttachment(notice.attachment_url)">
               <ion-icon :icon="attachOutline"></ion-icon>
               <span>View Document</span>
            </div>

            <div class="notice-footer">
              <span class="notice-date">{{ formatDate(notice.created_at) }}</span>
              <ion-button fill="clear" size="small" v-if="isAdmin || isAuthor(notice)" @click="deleteNotice(notice.id)" color="danger">
                <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
              </ion-button>
            </div>
          </div>
        </div>

      </div>

      <!-- Admin Panel Modal -->
      <OrgAdminPanel 
        v-if="org"
        v-model:isOpen="showAdminPanel"
        :org="org"
        :membership="membership"
        @refresh="loadAll"
      />

      <!-- Notice Composer Modal -->
      <NoticeComposerModal 
        v-if="org"
        v-model:isOpen="showComposer"
        :org="org"
        :membership="membership"
        :departments="departments"
        @success="fetchNotices"
      />
    </ion-content>

    <!-- Fixed notice post button — teleported to body so it's never clipped by ion-page -->
    <Teleport to="body">
      <button v-if="canPost" class="notice-post-btn" @click="showComposer = true">
        <ion-icon :icon="add"></ion-icon>
      </button>
    </Teleport>

  </ion-page>
</template>

<script>
import { 
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
  IonBackButton, IonSpinner, IonButton, IonIcon, IonBadge, IonChip,
  IonSelect, IonSelectOption, IonRefresher, IonRefresherContent,
  IonLabel, alertController, toastController
} from '@ionic/vue';
import { 
  settingsOutline, lockClosedOutline, megaphoneOutline, 
  attachOutline, timeOutline, checkmarkCircle, documentTextOutline,
  pushOutline, trashOutline, add
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config';
import OrgAdminPanel from '../components/OrgAdminPanel.vue';
import NoticeComposerModal from '../components/NoticeComposerModal.vue';

export default {
  name: 'OrgBoardPage',
  components: { 
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
    IonBackButton, IonSpinner, IonButton, IonIcon, IonBadge, IonChip,
    IonSelect, IonSelectOption, IonRefresher, IonRefresherContent,
    IonLabel,
    OrgAdminPanel,
    NoticeComposerModal
  },
  data() {
    return {
      settingsOutline, lockClosedOutline, megaphoneOutline, attachOutline,
      timeOutline, checkmarkCircle, documentTextOutline, pushOutline,
      trashOutline, add,
      loading: true,
      fetchingNotices: false,
      org: null,
      notices: [],
      membership: null,
      departments: [],
      locked: false,
      joining: false,
      selectedCategory: 'All',
      selectedDept: null,
      categories: ['All', 'General', 'Academic', 'Finance', 'Events', 'Urgent'],
      showAdminPanel: false,
      showComposer: false,
      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL,
      defaultLogo: 'https://images.unsplash.com/photo-1562564055-71e051d33c19?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80',
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
    };
  },
  computed: {
    isAdmin() {
      return this.membership?.role === 'org_admin';
    },
    canPost() {
      return ['org_admin', 'dept_manager'].includes(this.membership?.role);
    }
  },
  watch: {
    selectedCategory() { this.fetchNotices(); },
    selectedDept() { this.fetchNotices(); }
  },
  methods: {
    async loadAll() {
      this.loading = true;
      try {
        const slug = this.$route.params.slug;
        const res = await axios.get(`${this.API_URL}/api/boards/${slug}`, {
          params: { user_id: this.userId }
        });
        
        if (res.data.success) {
          this.org = res.data.org;
          this.membership = res.data.org.my_membership;
          this.locked = res.data.locked;
          this.notices = res.data.notices || [];
          this.departments = res.data.departments || [];
          this.trackVisit();
        }
      } catch (err) {
        console.error('Load board error:', err);
      } finally {
        this.loading = false;
      }
    },
    trackVisit() {
      if (!this.org) return;
      const stats = JSON.parse(localStorage.getItem('notice_board_visits') || '{}');
      const id = String(this.org.id);
      stats[id] = (stats[id] || 0) + 1;
      localStorage.setItem('notice_board_visits', JSON.stringify(stats));
    },
    async fetchNotices() {
      if (this.locked) return;
      this.fetchingNotices = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/boards/${this.org.slug}/notices`, {
          params: { 
            user_id: this.userId,
            category: this.selectedCategory === 'All' ? null : this.selectedCategory,
            dept_id: this.selectedDept
          }
        });
        if (res.data.success) {
          this.notices = res.data.notices;
        }
      } catch (err) {
        console.error('Fetch notices error:', err);
      } finally {
        this.fetchingNotices = false;
      }
    },
    async handleRefresh(event) {
      await this.loadAll();
      event.target.complete();
    },
    async requestToJoin() {
      this.joining = true;
      try {
        const res = await axios.post(`${this.API_URL}/api/boards/${this.org.slug}/join`, {
          user_id: this.userId
        });
        if (res.data.success) {
          if (res.data.status === 'approved') {
            this.loadAll();
          } else {
             this.membership = { status: 'pending' };
          }
        }
      } catch (err) {
        alert('Failed to send request');
      } finally {
        this.joining = false;
      }
    },
    async acceptInvite() {
      try {
        const res = await axios.post(`${this.API_URL}/api/boards/${this.org.slug}/accept-invite`, {
          user_id: this.userId
        });
        if (res.data.success) {
          this.loadAll();
        }
      } catch (err) {
        alert('Failed to accept invite');
      }
    },
    async deleteNotice(id) {
      const alert = await alertController.create({
        header: 'Delete Notice',
        message: 'Are you sure you want to permanently delete this notice?',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Delete',
            role: 'destructive',
            handler: async () => {
              try {
                const res = await axios.delete(`${this.API_URL}/api/boards/notices/${id}`, {
                  params: { user_id: this.userId }
                });
                if (res.data.success) {
                  // Remove notice instantly from local list
                  this.notices = this.notices.filter(n => n.id !== id);
                  const toast = await toastController.create({
                    message: 'Notice deleted successfully.',
                    duration: 2000,
                    color: 'success',
                    position: 'bottom'
                  });
                  await toast.present();
                } else {
                  const toast = await toastController.create({
                    message: res.data.error || 'Could not delete notice.',
                    duration: 3000,
                    color: 'danger',
                    position: 'bottom'
                  });
                  await toast.present();
                }
              } catch (err) {
                const msg = err.response?.data?.error || err.message || 'Delete failed';
                const toast = await toastController.create({
                  message: 'Error: ' + msg,
                  duration: 3000,
                  color: 'danger',
                  position: 'bottom'
                });
                await toast.present();
              }
            }
          }
        ]
      });
      await alert.present();
    },
    toggleCategory(cat) {
      this.selectedCategory = cat;
    },
    getCategoryColor(cat) {
      const colors = {
        'Urgent': 'danger',
        'Academic': 'secondary',
        'Finance': 'success',
        'Events': 'tertiary',
        'General': 'medium'
      };
      return colors[cat] || 'primary';
    },
    formatDate(date) {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
    openAttachment(url) {
      window.open(url, '_blank');
    },
    isAuthor(notice) {
      return String(notice.author_id) === String(this.userId);
    },
    formatRole(role) {
      if (!role) return '';
      return role.replace('dept_', '').replace('org_', '').toUpperCase();
    }
  },
  mounted() {
    this.loadAll();

    // Socket listeners for real-time join approval
    if (window.appSocket) {
      window.appSocket.on('board:join_resolved', (data) => {
        if (data.org_slug === this.$route.params.slug) {
          this.loadAll();
        }
      });
      window.appSocket.on('notice:new', (data) => {
        if (data.org_slug === this.$route.params.slug) {
          this.fetchNotices();
        }
      });
    }
  }
};
</script>

<style scoped>
.glass-toolbar {
  --background: rgba(0, 0, 0, 0.7);
  --border-color: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(15px);
}

.org-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mini-logo {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  object-fit: cover;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 100px 0;
}

/* Locked State */
.locked-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 80vh;
  text-align: center;
  padding: 30px;
}

.lock-wrapper {
  position: relative;
  margin-bottom: 30px;
}

.lock-icon {
  font-size: 100px;
  color: gold;
  position: relative;
  z-index: 2;
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
  height: 120px;
  border: 2px solid gold;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
  50% { opacity: 0.5; }
  100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
}

.locked-state h2 {
  font-size: 1.8rem;
  font-weight: 800;
  margin: 0;
}

.locked-state p {
  opacity: 0.6;
  margin: 15px 0 30px 0;
  line-height: 1.5;
}

.pending-badge {
  color: gold;
  background: rgba(212, 175, 55, 0.1);
  padding: 12px 20px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  border: 1px dashed gold;
}

/* Board Feed */
.org-banner {
  height: 100px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), transparent);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: flex-end;
  padding: 15px;
}

.org-stats {
  display: flex;
  gap: 20px;
}

.stat {
  display: flex;
  flex-direction: column;
}

.stat .val {
  font-weight: 800;
  font-size: 1.2rem;
  color: gold;
}

.stat .lab {
  font-size: 0.7rem;
  opacity: 0.5;
  text-transform: uppercase;
}

.filter-bar {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.category-scroll {
  display: flex;
  padding: 10px;
  gap: 8px;
  overflow-x: auto;
}

.category-scroll::-webkit-scrollbar { display: none; }

ion-chip {
  --background: rgba(255, 255, 255, 0.05);
  --color: white;
  transition: all 0.2s;
}

.active-chip {
  --background: gold;
  --color: black;
  font-weight: 700;
}

.dept-selector {
  padding: 0 10px 10px 10px;
}

.custom-select {
  --background: rgba(255, 255, 255, 0.03);
  --border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2px 10px;
  font-size: 0.9rem;
}

.notice-list {
  padding: 15px;
}

.feed-loading {
  text-align: center;
  padding: 20px;
}

.notice-card {
  background: #ffffff;
  border-radius: 18px;
  padding: 18px;
  margin-bottom: 20px;
  border: 1px solid var(--ion-border-color, #eff3f4);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.notice-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05);
  border-color: rgba(218, 165, 32, 0.3);
}

.urgent-card {
  border-left: 4px solid #ef4444 !important;
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.02) 0%, #ffffff 100%);
}

.pinned-card {
  border-left: 4px solid #daa520 !important;
  background: linear-gradient(90deg, rgba(218, 165, 32, 0.02) 0%, #ffffff 100%);
}

.dept-badge {
  margin-right: 6px;
  --background: rgba(212, 175, 55, 0.15);
  --color: #d4af37;
  font-weight: 700;
  border: 1px solid rgba(212, 175, 55, 0.3);
}

.notice-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.auth-pic {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.auth-meta {
  display: flex;
  flex-direction: column;
}

.auth-name {
  font-weight: 700;
  font-size: 0.95rem;
}

.auth-dept {
  font-size: 0.75rem;
  opacity: 0.5;
  color: gold;
}

.notice-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pin-icon {
  color: gold;
  font-size: 1.1rem;
}

.notice-body h3 {
  margin: 0 0 10px 0;
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: -0.3px;
}

.notice-body p {
  margin: 0;
  line-height: 1.6;
  opacity: 0.85;
  white-space: pre-wrap;
}

.notice-attachment {
  margin: 15px 0;
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  transition: background 0.2s;
}

.notice-attachment:hover {
  background: rgba(212, 175, 55, 0.05);
  border-color: gold;
}

.notice-footer {
  margin-top: 15px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  opacity: 0.6;
}

.empty-feed {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 0;
  opacity: 0.3;
}

.empty-feed ion-icon {
  font-size: 4rem;
  margin-bottom: 10px;
}

.feed-invite-banner {
  background: linear-gradient(135deg, rgba(46, 204, 113, 0.15), rgba(46, 204, 113, 0.05));
  border: 1px solid rgba(46, 204, 113, 0.3);
  border-radius: 16px;
  padding: 16px 20px;
  margin: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 15px rgba(46, 204, 113, 0.05);
  backdrop-filter: blur(10px);
}
.banner-text h4 {
  margin: 0 0 4px 0;
  color: #2ecc71;
  font-weight: 700;
  font-size: 1rem;
}
.banner-text p {
  margin: 0;
  opacity: 0.8;
  font-size: 0.85rem;
}
</style>

<!-- Unscoped: must be global so Teleport renders it correctly outside ion-page -->
<style>
.notice-post-btn {
  position: fixed !important;
  bottom: 90px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #d4af37, #f5e06e);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(212, 175, 55, 0.5);
  z-index: 99999;
  transition: transform 0.2s, box-shadow 0.2s;
  color: #000;
  font-size: 28px;
}

.notice-post-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 28px rgba(212, 175, 55, 0.7);
}

.notice-post-btn ion-icon {
  font-size: 28px;
  color: #000;
}
</style>
