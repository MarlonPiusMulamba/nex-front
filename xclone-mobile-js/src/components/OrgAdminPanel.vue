<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('update:isOpen', false)">
    <ion-header>
      <ion-toolbar class="glass-toolbar">
        <ion-buttons slot="start">
          <ion-button @click="$emit('update:isOpen', false)">Close</ion-button>
        </ion-buttons>
        <ion-title>Admin: {{ org.name }}</ion-title>
      </ion-toolbar>
      <ion-toolbar class="glass-toolbar">
        <ion-segment v-model="adminTab" color="gold">
          <ion-segment-button value="requests">
            <ion-label>Requests</ion-label>
            <ion-badge color="danger" v-if="requests.length > 0">{{ requests.length }}</ion-badge>
          </ion-segment-button>
          <ion-segment-button value="members">
            <ion-label>Staff</ion-label>
          </ion-segment-button>
          <ion-segment-button value="depts">
            <ion-label>Depts</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- JOIN REQUESTS TAB -->
      <div v-if="adminTab === 'requests'" class="admin-tab-content">
        <div v-if="loadingRequests" class="loading-state">
          <ion-spinner name="crescent" color="gold"></ion-spinner>
        </div>
        <div v-else-if="requests.length === 0" class="empty-state">
          <ion-icon :icon="peopleOutline"></ion-icon>
          <p>No pending join requests.</p>
        </div>
        <div v-else class="request-list">
          <div v-for="req in requests" :key="req.user_id" class="request-card">
            <div class="user-block">
              <img :src="req.user_avatar || defaultAvatar" class="req-avatar" />
              <div class="user-info">
                <div class="name-row">
                  <span class="user-name">{{ req.user_display_name || req.user_username }}</span>
                  <ion-badge :color="getTierColor(req.user_tier)">Tier {{ req.user_tier }}</ion-badge>
                </div>
                <p class="user-bio">{{ req.user_bio || 'No bio provided' }}</p>
                <p class="req-date">Requested {{ formatDate(req.created_at) }}</p>
              </div>
            </div>
            <div class="action-buttons">
              <ion-button color="success" size="small" @click="resolveRequest(req.user_id, 'approve')">
                Approve
              </ion-button>
              <ion-button color="danger" fill="outline" size="small" @click="resolveRequest(req.user_id, 'reject')">
                Reject
              </ion-button>
            </div>
          </div>
        </div>
      </div>

      <!-- MEMBERS TAB -->
      <div v-else-if="adminTab === 'members'" class="admin-tab-content">
        <div class="tab-header">
          <h3>Staff & Managers</h3>
          <ion-button fill="clear" size="small" @click="showInvite = true" color="gold">
            <ion-icon slot="start" :icon="personAddOutline"></ion-icon>
            Invite User
          </ion-button>
        </div>

        <!-- Invite Input (Inline) -->
        <div v-if="showInvite" class="invite-panel">
          <ion-item class="custom-item">
            <ion-input v-model="inviteUsername" placeholder="Enter NEXFI username"></ion-input>
          </ion-item>
          <div class="invite-selectors">
            <ion-select 
              v-model="inviteRole" 
              interface="popover" 
              placeholder="Select Role"
              class="role-select"
            >
              <ion-select-option value="dept_viewer">Viewer</ion-select-option>
              <ion-select-option value="dept_manager">Manager</ion-select-option>
              <ion-select-option value="org_admin">Admin</ion-select-option>
            </ion-select>
            
            <ion-select 
              v-model="inviteDeptId" 
              placeholder="No Dept"
              interface="popover" 
              class="dept-select"
            >
              <ion-select-option :value="null">Global</ion-select-option>
              <ion-select-option v-for="d in departments" :key="d.id" :value="d.id">
                {{ d.name }}
              </ion-select-option>
            </ion-select>
          </div>
          <ion-button expand="block" size="small" color="gold" @click="sendInvite">Send Invite</ion-button>
        </div>

        <div v-if="loadingMembers" class="loading-state">
          <ion-spinner name="crescent" color="gold"></ion-spinner>
        </div>
        <div v-else class="member-list">
          <div v-for="member in members" :key="member.user_id" class="member-card">
             <div class="member-main">
               <img :src="member.avatar || defaultAvatar" class="mem-avatar" />
               <div class="mem-info">
                 <span class="mem-name">@{{ member.username }}</span>
                 <ion-badge color="gold" class="role-badge">{{ formatRole(member.role) }}</ion-badge>
                 <ion-badge color="warning" class="status-badge" v-if="member.status === 'invited'">Invited</ion-badge>
               </div>
             </div>
             
             <div class="member-controls" v-if="member.user_id !== userId">
               <ion-select 
                 :value="member.role" 
                 interface="popover" 
                 @ionChange="updateRole(member.user_id, $event.detail.value)"
                 class="role-select"
               >
                 <ion-select-option value="dept_viewer">Viewer</ion-select-option>
                 <ion-select-option value="dept_manager">Manager</ion-select-option>
                 <ion-select-option value="org_admin">Admin</ion-select-option>
               </ion-select>
               
               <ion-select 
                 :value="member.dept_id" 
                 placeholder="No Dept"
                 interface="popover" 
                 @ionChange="updateDept(member.user_id, $event.detail.value)"
                 class="dept-select"
               >
                 <ion-select-option :value="null">Global</ion-select-option>
                 <ion-select-option v-for="d in departments" :key="d.id" :value="d.id">
                   {{ d.name }}
                 </ion-select-option>
               </ion-select>
             </div>
          </div>
        </div>
      </div>

      <!-- DEPARTMENTS TAB -->
      <div v-else-if="adminTab === 'depts'" class="admin-tab-content">
        <div class="tab-header">
          <h3>Departments</h3>
          <ion-button fill="clear" size="small" @click="showNewDept = true" color="gold">
            <ion-icon slot="start" :icon="addCircleOutline"></ion-icon>
            Add Dept
          </ion-button>
        </div>

        <div v-if="showNewDept" class="new-dept-form">
          <ion-item class="custom-item">
            <ion-input v-model="newDeptName" placeholder="Department Name (e.g. Science)"></ion-input>
          </ion-item>
          <ion-button expand="block" size="small" color="gold" @click="createDept">Create</ion-button>
        </div>

        <div class="dept-list">
          <div v-for="dept in departments" :key="dept.id" class="dept-row">
            <ion-icon :icon="businessOutline" color="gold"></ion-icon>
            <span>{{ dept.name }}</span>
            <span class="dept-count">{{ dept.member_count || 0 }} members</span>
            <ion-button fill="clear" size="small" color="danger" @click="deleteDept(dept.id)" class="delete-dept-btn">
              <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
            </ion-button>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script>
import { 
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
  IonButton, IonSegment, IonSegmentButton, IonLabel, IonBadge, IonSpinner,
  IonIcon, IonItem, IonInput, IonSelect, IonSelectOption
} from '@ionic/vue';
import { 
  peopleOutline, personAddOutline, addCircleOutline, businessOutline,
  alertCircleOutline, trashOutline 
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config';

export default {
  name: 'OrgAdminPanel',
  components: { 
    IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
    IonButton, IonSegment, IonSegmentButton, IonLabel, IonBadge, IonSpinner,
    IonIcon, IonItem, IonInput, IonSelect, IonSelectOption
  },
  props: {
    isOpen: Boolean,
    org: Object,
    membership: Object
  },
  data() {
    return {
      peopleOutline, personAddOutline, addCircleOutline, businessOutline, alertCircleOutline, trashOutline,
      adminTab: 'requests',
      loadingRequests: false,
      loadingMembers: false,
      requests: [],
      members: [],
      departments: [],
      inviteUsername: '',
      inviteRole: 'dept_viewer',
      inviteDeptId: null,
      showInvite: false,
      newDeptName: '',
      showNewDept: false,
      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
    };
  },
  watch: {
    isOpen(val) {
      if (val) this.loadAll();
    },
    adminTab() { this.loadAll(); }
  },
  methods: {
    async loadAll() {
      if (this.adminTab === 'requests') this.fetchRequests();
      else if (this.adminTab === 'members') this.fetchMembers();
      this.fetchDepts();
    },
    async fetchRequests() {
      this.loadingRequests = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/boards/${this.org.slug}/requests`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) {
          this.requests = res.data.requests;
        }
      } catch (err) {
        console.error('Fetch requests error:', err);
      } finally {
        this.loadingRequests = false;
      }
    },
    async fetchMembers() {
      this.loadingMembers = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/boards/${this.org.slug}/members`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) {
          this.members = res.data.members;
        }
      } catch (err) {
        console.error('Fetch members error:', err);
      } finally {
        this.loadingMembers = false;
      }
    },
    async fetchDepts() {
      try {
        const res = await axios.get(`${this.API_URL}/api/boards/${this.org.slug}/departments`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) {
          this.departments = res.data.departments;
        }
      } catch (err) {}
    },
    async resolveRequest(uid, action) {
      try {
        const res = await axios.post(`${this.API_URL}/api/boards/${this.org.slug}/requests/${uid}/${action}`, {
          user_id: this.userId
        });
        if (res.data.success) {
          this.fetchRequests();
          this.$emit('refresh');
        }
      } catch (err) {
        alert('Action failed');
      }
    },
    async updateRole(uid, role) {
      try {
        const res = await axios.patch(`${this.API_URL}/api/boards/${this.org.slug}/members/${uid}/role`, {
          user_id: this.userId,
          role
        });
        if (res.data.success) {
          this.fetchMembers();
        } else {
          alert('Update failed: ' + res.data.error);
        }
      } catch (err) {
        alert('Update failed');
      }
    },
    async updateDept(uid, dept_id) {
       try {
        const res = await axios.patch(`${this.API_URL}/api/boards/${this.org.slug}/members/${uid}/role`, {
          user_id: this.userId,
          dept_id
        });
        if (res.data.success) {
          this.fetchMembers();
        } else {
          alert('Update failed: ' + res.data.error);
        }
      } catch (err) {
        alert('Update failed');
      }
    },
    async deleteDept(deptId) {
      try {
        const res = await axios.delete(`${this.API_URL}/api/boards/${this.org.slug}/departments/${deptId}`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) {
          this.fetchDepts();
        } else {
          alert('Delete failed: ' + res.data.error);
        }
      } catch (err) {
        alert('Delete failed');
      }
    },
    async createDept() {
      if (!this.newDeptName) return;
      try {
        const res = await axios.post(`${this.API_URL}/api/boards/${this.org.slug}/departments`, {
          user_id: this.userId,
          name: this.newDeptName
        });
        if (res.data.success) {
          this.newDeptName = '';
          this.showNewDept = false;
          this.fetchDepts();
        }
      } catch (err) {
        alert('Creation failed');
      }
    },
    async sendInvite() {
      if (!this.inviteUsername) return;
      try {
        const res = await axios.post(`${this.API_URL}/api/boards/${this.org.slug}/invite`, {
          user_id: this.userId,
          username: this.inviteUsername,
          role: this.inviteRole,
          dept_id: this.inviteDeptId
        });
        if (res.data.success) {
          this.inviteUsername = '';
          this.inviteRole = 'dept_viewer';
          this.inviteDeptId = null;
          this.showInvite = false;
          this.fetchMembers();
          alert('Invite sent!');
        }
      } catch (err) {
        alert(err.response?.data?.error || 'Invite failed');
      }
    },
    formatRole(role) {
      return role.replace('dept_', '').replace('org_', '').toUpperCase();
    },
    getTierColor(tier) {
      if (tier >= 3) return 'primary';
      if (tier >= 2) return 'success';
      return 'medium';
    },
    formatDate(date) {
      return new Date(date).toLocaleDateString();
    }
  }
};
</script>

<style scoped>
.admin-tab-content {
  padding-bottom: 50px;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.tab-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: gold;
}

.request-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 15px;
}

.user-block {
  display: flex;
  gap: 12px;
  margin-bottom: 15px;
}

.req-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
}

.user-info {
  flex: 1;
}

.name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.user-name {
  font-weight: 700;
}

.user-bio {
  font-size: 0.85rem;
  opacity: 0.6;
  margin: 4px 0;
}

.req-date {
  font-size: 0.7rem;
  opacity: 0.4;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.action-buttons ion-button {
  flex: 1;
}

.member-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 10px;
}

.member-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mem-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.mem-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mem-name {
  font-weight: 600;
}

.member-controls {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}

.role-select, .dept-select {
  flex: 1;
  --background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 2px 8px;
  font-size: 0.8rem;
}

.dept-row {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  margin-bottom: 8px;
}

.dept-count {
  margin-left: auto;
  font-size: 0.75rem;
  opacity: 0.4;
}

.invite-panel, .new-dept-form {
  background: rgba(212, 175, 55, 0.05);
  padding: 15px;
  border-radius: 12px;
  margin-bottom: 20px;
  border: 1px dashed gold;
}

.custom-item {
  --background: rgba(255, 255, 255, 0.05);
  --border-radius: 8px;
  margin-bottom: 10px;
}

.invite-selectors {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.status-badge {
  margin-left: 5px;
  --background: rgba(243, 156, 18, 0.15);
  --color: #f39c12;
  font-weight: 700;
  border: 1px solid rgba(243, 156, 18, 0.3);
}

.delete-dept-btn {
  margin-left: 10px;
  --color: #ff4961;
}
</style>
