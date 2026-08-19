<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('update:isOpen', false)">
    <ion-header>
      <ion-toolbar class="glass-toolbar">
        <ion-buttons slot="start">
          <ion-button @click="$emit('update:isOpen', false)" class="close-btn">
            <ion-icon slot="icon-only" :icon="closeOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title class="panel-title">
          <span class="panel-org">{{ org.name }}</span>
          <span class="panel-sub">Admin Panel</span>
        </ion-title>
      </ion-toolbar>
      <ion-toolbar class="tab-toolbar">
        <ion-segment v-model="adminTab" class="admin-segment">
          <ion-segment-button value="requests" class="seg-btn">
            <ion-label>Requests</ion-label>
            <ion-badge color="danger" v-if="requests.length > 0" class="seg-badge">{{ requests.length }}</ion-badge>
          </ion-segment-button>
          <ion-segment-button value="members" class="seg-btn">
            <ion-label>Staff</ion-label>
          </ion-segment-button>
          <ion-segment-button value="depts" class="seg-btn">
            <ion-label>Depts</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="panel-content">

      <!-- ── JOIN REQUESTS TAB ─────────────────────────────── -->
      <div v-if="adminTab === 'requests'" class="tab-pane">
        <div v-if="loadingRequests" class="panel-loading">
          <ion-spinner name="crescent" color="warning"></ion-spinner>
        </div>
        <div v-else-if="requests.length === 0" class="panel-empty">
          <div class="empty-icon-wrap">
            <ion-icon :icon="peopleOutline"></ion-icon>
          </div>
          <p>No pending join requests</p>
        </div>
        <div v-else class="request-list">
          <div v-for="req in requests" :key="req.user_id" class="request-card">
            <div class="req-user">
              <img :src="req.user_avatar || defaultAvatar" class="req-avatar" />
              <div class="req-meta">
                <div class="req-name-row">
                  <span class="req-name">{{ req.user_display_name || req.user_username }}</span>
                  <ion-badge :color="getTierColor(req.user_tier)" class="tier-badge">T{{ req.user_tier }}</ion-badge>
                </div>
                <p class="req-bio">{{ req.user_bio || 'No bio provided' }}</p>
                <span class="req-date">
                  <ion-icon :icon="timeOutline" style="font-size:11px"></ion-icon>
                  {{ formatDate(req.created_at) }}
                </span>
              </div>
            </div>
            <div class="req-actions">
              <ion-button color="success" size="small" @click="resolveRequest(req.user_id, 'approve')" class="approve-btn">
                <ion-icon slot="start" :icon="checkmarkCircleOutline"></ion-icon>
                Approve
              </ion-button>
              <ion-button color="danger" fill="outline" size="small" @click="resolveRequest(req.user_id, 'reject')" class="reject-btn">
                <ion-icon slot="start" :icon="closeCircleOutline"></ion-icon>
                Reject
              </ion-button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── STAFF MANAGEMENT TAB ──────────────────────────── -->
      <div v-else-if="adminTab === 'members'" class="tab-pane">

        <!-- Header actions -->
        <div class="staff-header">
          <div class="staff-title-row">
            <h3 class="staff-title">Staff & Managers</h3>
            <span class="staff-count">{{ members.length }} members</span>
          </div>
          <ion-button fill="outline" size="small" @click="showInvite = !showInvite" class="invite-toggle-btn">
            <ion-icon slot="start" :icon="personAddOutline"></ion-icon>
            {{ showInvite ? 'Cancel' : 'Invite' }}
          </ion-button>
        </div>

        <!-- Invite Panel -->
        <div v-if="showInvite" class="invite-panel">
          <h4 class="invite-title">
            <ion-icon :icon="mailOutline"></ion-icon>
            Invite a User
          </h4>
          <div class="invite-username-row">
            <div class="username-input-wrap">
              <span class="at-prefix">@</span>
              <input
                v-model="inviteUsername"
                placeholder="nexfi username"
                class="username-input"
                @keyup.enter="sendInvite"
              />
            </div>
          </div>
          <div class="invite-selectors">
            <div class="select-group">
              <label class="select-label">Role</label>
              <ion-select v-model="inviteRole" interface="popover" class="invite-select">
                <ion-select-option value="dept_viewer">Viewer</ion-select-option>
                <ion-select-option value="dept_manager">Manager</ion-select-option>
                <ion-select-option value="org_admin">Admin</ion-select-option>
              </ion-select>
            </div>
            <div class="select-group">
              <label class="select-label">Department</label>
              <ion-select v-model="inviteDeptId" interface="popover" placeholder="None" class="invite-select">
                <ion-select-option :value="null">Global</ion-select-option>
                <ion-select-option v-for="d in departments" :key="d.id" :value="d.id">
                  {{ d.name }}
                </ion-select-option>
              </ion-select>
            </div>
          </div>
          <ion-button expand="block" color="warning" @click="sendInvite" :disabled="!inviteUsername || sendingInvite" class="send-invite-btn">
            <ion-spinner v-if="sendingInvite" name="crescent" style="margin-right:8px;width:16px;height:16px"></ion-spinner>
            <ion-icon v-else :icon="sendOutline" slot="start"></ion-icon>
            Send Invite
          </ion-button>
        </div>

        <!-- Loading -->
        <div v-if="loadingMembers" class="panel-loading">
          <ion-spinner name="crescent" color="warning"></ion-spinner>
        </div>

        <!-- Dept-grouped member list -->
        <div v-else>
          <div v-for="group in membersGroupedByDept" :key="group.label" class="dept-group">
            <!-- Group header -->
            <div class="dept-group-header">
              <div class="dept-group-icon">
                <ion-icon :icon="businessOutline"></ion-icon>
              </div>
              <div>
                <span class="dept-group-name">{{ group.label }}</span>
                <span class="dept-group-count">{{ group.members.length }} member{{ group.members.length !== 1 ? 's' : '' }}</span>
              </div>
            </div>

            <!-- Members in this dept -->
            <div class="member-cards">
              <div v-for="member in group.members" :key="member.user_id" class="member-card">

                <!-- Member identity row -->
                <div class="member-top">
                  <div class="member-identity">
                    <div class="mem-avatar-wrap">
                      <img :src="member.profile_pic || defaultAvatar" class="mem-avatar" />
                      <span class="role-dot" :class="'role-dot--' + member.role"></span>
                    </div>
                    <div class="mem-text">
                      <span class="mem-name">
                        {{ member.first_name ? (member.first_name + ' ' + (member.last_name || '')) : member.username }}
                      </span>
                      <span class="mem-handle">@{{ member.username }}</span>
                    </div>
                  </div>

                  <div class="member-right">
                    <span class="role-chip" :class="'role-chip--' + member.role">
                      {{ formatRole(member.role) }}
                    </span>
                    <ion-badge color="warning" class="invited-badge" v-if="member.status === 'invited'">
                      Pending
                    </ion-badge>
                    <!-- Edit toggle — cannot edit self -->
                    <ion-button
                      v-if="String(member.user_id) !== String(userId)"
                      fill="clear"
                      size="small"
                      class="edit-btn"
                      @click="toggleEdit(member)"
                    >
                      <ion-icon slot="icon-only" :icon="editingId === member.user_id ? chevronUpOutline : createOutline"></ion-icon>
                    </ion-button>
                  </div>
                </div>

                <!-- Inline edit form -->
                <div v-if="editingId === member.user_id" class="edit-form">
                  <div class="edit-fields">
                    <div class="edit-field-group">
                      <label class="edit-label">Role</label>
                      <ion-select
                        v-model="editRole"
                        interface="popover"
                        class="edit-select"
                      >
                        <ion-select-option value="dept_viewer">
                          <ion-icon :icon="eyeOutline"></ion-icon> Viewer
                        </ion-select-option>
                        <ion-select-option value="dept_manager">
                          <ion-icon :icon="settingsOutline"></ion-icon> Manager
                        </ion-select-option>
                        <ion-select-option value="org_admin">
                          <ion-icon :icon="shieldCheckmarkOutline"></ion-icon> Admin
                        </ion-select-option>
                      </ion-select>
                    </div>

                    <div class="edit-field-group">
                      <label class="edit-label">Department</label>
                      <ion-select
                        v-model="editDeptId"
                        interface="popover"
                        placeholder="No Dept"
                        class="edit-select"
                      >
                        <ion-select-option :value="null">Global (No Dept)</ion-select-option>
                        <ion-select-option v-for="d in departments" :key="d.id" :value="d.id">
                          {{ d.name }}
                        </ion-select-option>
                      </ion-select>
                    </div>
                  </div>

                  <div class="edit-action-row">
                    <ion-button
                      color="warning"
                      size="small"
                      @click="saveRoleAndDept(member.user_id)"
                      :disabled="savingId === member.user_id"
                      class="save-btn"
                    >
                      <ion-spinner v-if="savingId === member.user_id" name="crescent" style="width:14px;height:14px;margin-right:5px"></ion-spinner>
                      <ion-icon v-else :icon="checkmarkOutline" slot="start"></ion-icon>
                      Save Changes
                    </ion-button>
                    <ion-button fill="clear" size="small" @click="editingId = null" class="cancel-edit-btn">
                      Cancel
                    </ion-button>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div v-if="members.length === 0" class="panel-empty">
            <div class="empty-icon-wrap">
              <ion-icon :icon="peopleOutline"></ion-icon>
            </div>
            <p>No staff members yet. Invite users to get started.</p>
          </div>
        </div>
      </div>

      <!-- ── DEPARTMENTS TAB ───────────────────────────────── -->
      <div v-else-if="adminTab === 'depts'" class="tab-pane">
        <div class="dept-tab-header">
          <h3 class="staff-title">Departments</h3>
          <ion-button fill="outline" size="small" @click="showNewDept = !showNewDept; editingDeptId = null" class="invite-toggle-btn">
            <ion-icon slot="start" :icon="addCircleOutline"></ion-icon>
            {{ showNewDept ? 'Cancel' : 'Add Dept' }}
          </ion-button>
        </div>

        <!-- ── Create new dept form ── -->
        <div v-if="showNewDept" class="new-dept-form">
          <h4 class="invite-title">
            <ion-icon :icon="businessOutline"></ion-icon>
            New Department
          </h4>
          <!-- Name -->
          <div class="username-input-wrap">
            <input
              v-model="newDeptName"
              placeholder="e.g. Science, Finance, Engineering..."
              class="username-input"
              @keyup.enter="createDept"
            />
          </div>
          <!-- Logo picker (optional) -->
          <div class="dept-logo-picker" @click="$refs.newDeptLogoInput.click()">
            <img v-if="newDeptLogoPreview" :src="newDeptLogoPreview" class="dept-logo-preview-img" />
            <div v-else class="dept-logo-placeholder">
              <ion-icon :icon="imageOutline"></ion-icon>
              <span>Logo / Icon (optional)</span>
            </div>
          </div>
          <input ref="newDeptLogoInput" type="file" accept="image/*" style="display:none" @change="onNewDeptLogoChange" />
          <ion-button expand="block" color="warning" @click="createDept" :disabled="!newDeptName.trim() || creatingDept" class="send-invite-btn">
            <ion-spinner v-if="creatingDept" name="crescent" style="width:14px;height:14px;margin-right:6px"></ion-spinner>
            <ion-icon v-else slot="start" :icon="addCircleOutline"></ion-icon>
            Create Department
          </ion-button>
        </div>

        <!-- ── Dept list ── -->
        <div class="dept-list">
          <div v-for="dept in departments" :key="dept.id">
            <!-- Normal view row -->
            <div class="dept-row" v-if="editingDeptId !== dept.id">
              <div class="dept-icon-wrap">
                <img v-if="dept.logo_url" :src="resolveUrl(dept.logo_url)" class="dept-logo-img" @error="e => e.target.style.display='none'" />
                <ion-icon v-else :icon="businessOutline"></ion-icon>
              </div>
              <div class="dept-info">
                <span class="dept-name">{{ dept.name }}</span>
                <span class="dept-member-count">{{ dept.member_count || 0 }} members</span>
              </div>
              <!-- Edit button -->
              <ion-button fill="clear" size="small" color="warning" @click="startEditDept(dept)" class="edit-dept-btn">
                <ion-icon slot="icon-only" :icon="createOutline"></ion-icon>
              </ion-button>
              <!-- Delete button -->
              <ion-button fill="clear" size="small" color="danger" @click="deleteDept(dept.id)" class="delete-dept-btn">
                <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
              </ion-button>
            </div>

            <!-- Inline edit form (shown when editing this dept) -->
            <div class="dept-edit-form" v-else>
              <div class="dept-edit-header">
                <span class="edit-label">Editing: {{ dept.name }}</span>
                <ion-button fill="clear" size="small" @click="editingDeptId = null" class="cancel-edit-btn">
                  <ion-icon slot="icon-only" :icon="closeOutline"></ion-icon>
                </ion-button>
              </div>
              <!-- Name field -->
              <div class="username-input-wrap" style="margin-bottom:10px">
                <input v-model="editDeptName" placeholder="Department name" class="username-input" />
              </div>
              <!-- Logo picker -->
              <div class="dept-logo-picker" @click="triggerEditDeptLogo(dept.id)">
                <img v-if="editDeptLogoPreview" :src="editDeptLogoPreview" class="dept-logo-preview-img" />
                <img v-else-if="dept.logo_url" :src="resolveUrl(dept.logo_url)" class="dept-logo-preview-img" />
                <div v-else class="dept-logo-placeholder">
                  <ion-icon :icon="imageOutline"></ion-icon>
                  <span>Change logo (optional)</span>
                </div>
              </div>
              <input :ref="'editLogoInput_' + dept.id" type="file" accept="image/*" style="display:none" @change="onEditDeptLogoChange" />
              <!-- Save / Cancel -->
              <div class="edit-action-row" style="margin-top:10px">
                <ion-button color="warning" size="small" @click="saveDept(dept.id)" :disabled="savingDeptId === dept.id" class="save-btn">
                  <ion-spinner v-if="savingDeptId === dept.id" name="crescent" style="width:14px;height:14px;margin-right:5px"></ion-spinner>
                  <ion-icon v-else :icon="checkmarkOutline" slot="start"></ion-icon>
                  Save
                </ion-button>
                <ion-button fill="clear" size="small" @click="editingDeptId = null" class="cancel-edit-btn">Cancel</ion-button>
              </div>
            </div>
          </div>

          <div v-if="departments.length === 0" class="panel-empty">
            <div class="empty-icon-wrap">
              <ion-icon :icon="businessOutline"></ion-icon>
            </div>
            <p>No departments yet. Create one to organize your staff.</p>
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
  IonIcon, IonItem, IonInput, IonSelect, IonSelectOption,
  toastController
} from '@ionic/vue';
import { 
  peopleOutline, personAddOutline, addCircleOutline, businessOutline,
  trashOutline, closeOutline, checkmarkCircleOutline, closeCircleOutline,
  timeOutline, mailOutline, sendOutline, createOutline, checkmarkOutline,
  shieldCheckmarkOutline, settingsOutline, eyeOutline, chevronUpOutline,
  imageOutline
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
      peopleOutline, personAddOutline, addCircleOutline, businessOutline,
      trashOutline, closeOutline, checkmarkCircleOutline, closeCircleOutline,
      timeOutline, mailOutline, sendOutline, createOutline, checkmarkOutline,
      shieldCheckmarkOutline, settingsOutline, eyeOutline, chevronUpOutline,
      imageOutline,

      adminTab: 'requests',
      loadingRequests: false,
      loadingMembers: false,
      requests: [],
      members: [],
      departments: [],

      // Invite form
      inviteUsername: '',
      inviteRole: 'dept_viewer',
      inviteDeptId: null,
      showInvite: false,
      sendingInvite: false,

      // Dept form
      newDeptName: '',
      newDeptLogoFile: null,
      newDeptLogoPreview: null,
      showNewDept: false,
      creatingDept: false,

      // Dept edit state
      editingDeptId: null,
      editDeptName: '',
      editDeptLogoFile: null,
      editDeptLogoPreview: null,
      savingDeptId: null,

      // Edit state
      editingId: null,
      editRole: null,
      editDeptId: null,
      savingId: null,

      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
    };
  },
  computed: {
    membersGroupedByDept() {
      const groups = {};
      this.members.forEach(m => {
        const key = m.dept_name || '__none__';
        const label = m.dept_name || 'General / No Department';
        if (!groups[key]) groups[key] = { label, members: [] };
        groups[key].members.push(m);
      });
      return Object.values(groups).sort((a, b) => {
        if (a.label === 'General / No Department') return 1;
        if (b.label === 'General / No Department') return -1;
        return a.label.localeCompare(b.label);
      });
    }
  },
  watch: {
    isOpen(val) {
      if (val) {
        this.userId = localStorage.getItem('userId');
        this.editingId = null;
        this.showInvite = false;
        this.showNewDept = false;
        this.loadAll();
      }
    },
    adminTab(val) {
      this.editingId = null;
      if (val === 'requests') this.fetchRequests();
      else if (val === 'members') this.fetchMembers();
      else if (val === 'depts') this.fetchDepts();
    }
  },
  methods: {
    async loadAll() {
      this.fetchRequests();
      this.fetchMembers();
      this.fetchDepts();
    },

    // ── Requests ──
    async fetchRequests() {
      this.loadingRequests = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/boards/${this.org.slug}/requests`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) this.requests = res.data.requests;
      } catch (err) {
        console.error('Fetch requests error:', err);
      } finally {
        this.loadingRequests = false;
      }
    },
    async resolveRequest(uid, action) {
      try {
        // Backend expects: POST /api/boards/<slug>/requests/<uid>  with {user_id, action} in body
        const res = await axios.post(
          `${this.API_URL}/api/boards/${this.org.slug}/requests/${uid}`,
          { user_id: this.userId, action }
        );
        if (res.data.success) {
          this.fetchRequests();
          this.$emit('refresh');
          this.showToast(
            action === 'approve' ? 'Member approved ✔' : 'Request rejected',
            action === 'approve' ? 'success' : 'medium'
          );
        } else {
          this.showToast(res.data.error || 'Action failed', 'danger');
        }
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Action failed';
        this.showToast(`Error: ${msg}`, 'danger');
      }
    },

    // ── Members ──
    async fetchMembers() {
      this.loadingMembers = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/boards/${this.org.slug}/members`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) this.members = res.data.members;
      } catch (err) {
        console.error('Fetch members error:', err);
      } finally {
        this.loadingMembers = false;
      }
    },
    toggleEdit(member) {
      if (this.editingId === member.user_id) {
        this.editingId = null;
      } else {
        this.editingId = member.user_id;
        this.editRole = member.role;
        this.editDeptId = member.dept_id || null;
      }
    },
    async saveRoleAndDept(targetUserId) {
      this.savingId = targetUserId;
      try {
        // Build body — only include dept_id if it's actually set (avoid sending null if backend FK rejects it)
        const body = {
          user_id: this.userId,
          role: this.editRole
        };
        // Always send dept_id (null means 'remove from dept'), backend handles it
        body.dept_id = this.editDeptId !== undefined ? this.editDeptId : null;

        console.log('[OrgAdminPanel] PATCH role/dept body:', body, 'target:', targetUserId);

        const res = await axios.patch(
          `${this.API_URL}/api/boards/${this.org.slug}/members/${targetUserId}/role`,
          body
        );

        console.log('[OrgAdminPanel] PATCH response:', res.data);

        if (res.data.success) {
          // Update local state immediately (no full reload)
          const m = this.members.find(x => Number(x.user_id) === Number(targetUserId));
          if (m) {
            m.role = this.editRole;
            m.dept_id = this.editDeptId;
            const dept = this.departments.find(d => d.id === this.editDeptId);
            m.dept_name = dept ? dept.name : null;
          }
          this.editingId = null;
          this.showToast('Role & department updated!', 'success');
        } else {
          const msg = res.data.error || 'Update failed — check server logs';
          console.error('[OrgAdminPanel] Server error:', msg);
          this.showToast(msg, 'danger');
        }
      } catch (err) {
        const serverMsg = err.response?.data?.error || err.message || 'Network error';
        console.error('[OrgAdminPanel] Catch error:', err.response?.status, serverMsg);
        this.showToast(`Error ${err.response?.status || ''}: ${serverMsg}`, 'danger');
      } finally {
        this.savingId = null;
      }
    },

    // ── Invite ──
    async sendInvite() {
      if (!this.inviteUsername) return;
      this.sendingInvite = true;
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
          this.showToast('Invite sent successfully!', 'success');
        } else {
          this.showToast(res.data.error || 'Invite failed', 'danger');
        }
      } catch (err) {
        this.showToast(err.response?.data?.error || 'Invite failed', 'danger');
      } finally {
        this.sendingInvite = false;
      }
    },

    // ── Departments ──
    async fetchDepts() {
      try {
        const res = await axios.get(`${this.API_URL}/api/boards/${this.org.slug}/departments`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) this.departments = res.data.departments;
      } catch (err) {}
    },
    onNewDeptLogoChange(e) {
      const file = e.target.files[0];
      if (!file) return;
      this.newDeptLogoFile = file;
      const reader = new FileReader();
      reader.onload = ev => { this.newDeptLogoPreview = ev.target.result; };
      reader.readAsDataURL(file);
    },
    onEditDeptLogoChange(e) {
      const file = e.target.files[0];
      if (!file) return;
      this.editDeptLogoFile = file;
      const reader = new FileReader();
      reader.onload = ev => { this.editDeptLogoPreview = ev.target.result; };
      reader.readAsDataURL(file);
    },
    triggerEditDeptLogo(deptId) {
      const refKey = 'editLogoInput_' + deptId;
      const target = this.$refs[refKey];
      if (Array.isArray(target) && target[0]) {
        target[0].click();
      } else if (target && typeof target.click === 'function') {
        target.click();
      }
    },
    async createDept() {
      if (!this.newDeptName.trim()) return;
      this.creatingDept = true;
      try {
        const formData = new FormData();
        formData.append('user_id', this.userId);
        formData.append('name', this.newDeptName.trim());
        if (this.newDeptLogoFile) formData.append('logo', this.newDeptLogoFile);

        const res = await axios.post(
          `${this.API_URL}/api/boards/${this.org.slug}/departments`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        if (res.data.success) {
          this.newDeptName = '';
          this.newDeptLogoFile = null;
          this.newDeptLogoPreview = null;
          this.showNewDept = false;
          this.fetchDepts();
          this.showToast('Department created!', 'success');
        } else {
          this.showToast(res.data.error || 'Failed to create', 'danger');
        }
      } catch (err) {
        this.showToast('Failed to create department', 'danger');
      } finally {
        this.creatingDept = false;
      }
    },
    startEditDept(dept) {
      this.editingDeptId = dept.id;
      this.editDeptName = dept.name;
      this.editDeptLogoFile = null;
      this.editDeptLogoPreview = null;
      this.showNewDept = false;
    },
    async saveDept(deptId) {
      this.savingDeptId = deptId;
      try {
        const formData = new FormData();
        formData.append('user_id', this.userId);
        formData.append('name', this.editDeptName.trim());
        if (this.editDeptLogoFile) formData.append('logo', this.editDeptLogoFile);

        const res = await axios.patch(
          `${this.API_URL}/api/boards/${this.org.slug}/departments/${deptId}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        if (res.data.success) {
          this.editingDeptId = null;
          this.editDeptLogoFile = null;
          this.editDeptLogoPreview = null;
          this.fetchDepts();
          this.showToast('Department updated!', 'success');
        } else {
          this.showToast(res.data.error || 'Update failed', 'danger');
        }
      } catch (err) {
        this.showToast('Update failed', 'danger');
      } finally {
        this.savingDeptId = null;
      }
    },
    async deleteDept(deptId) {
      try {
        const res = await axios.delete(`${this.API_URL}/api/boards/${this.org.slug}/departments/${deptId}`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) {
          this.fetchDepts();
          this.showToast('Department deleted', 'medium');
        } else {
          this.showToast(res.data.error || 'Delete failed', 'danger');
        }
      } catch (err) {
        this.showToast('Delete failed', 'danger');
      }
    },

    // ── Utilities ──
    formatRole(role) {
      if (!role) return '';
      const map = { org_admin: 'Admin', dept_manager: 'Manager', dept_viewer: 'Viewer' };
      return map[role] || role;
    },
    resolveUrl(url) {
      if (!url) return null;
      if (url.startsWith('http') || url.startsWith('data:')) return url;
      return `${this.API_URL}${url}`;
    },
    getTierColor(tier) {
      if (tier >= 3) return 'primary';
      if (tier >= 2) return 'success';
      return 'medium';
    },
    formatDate(date) {
      if (!date) return '';
      const d = new Date(date);
      const now = new Date();
      const diff = now - d;
      const days = Math.floor(diff / 86400000);
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },
    async showToast(message, color = 'success') {
      const toast = await toastController.create({
        message,
        duration: 2200,
        color,
        position: 'bottom',
        cssClass: 'panel-toast'
      });
      await toast.present();
    }
  }
};
</script>

<style scoped>
/* ─── Modal shell ───────────────────────────────────────────── */
.glass-toolbar {
  --background: #fff;
  --border-color: rgba(0,0,0,0.07);
}

.close-btn {
  --color: #666;
}

.panel-title {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  padding: 0;
}

.panel-org {
  font-size: 0.95rem;
  font-weight: 900;
  color: #1a1a1a;
}

.panel-sub {
  font-size: 0.68rem;
  font-weight: 600;
  color: #1208a1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tab-toolbar {
  --background: #fafafa;
  --border-color: rgba(0,0,0,0.06);
}

.admin-segment {
  --background: transparent;
}

.seg-btn {
  font-size: 0.82rem;
  font-weight: 700;
}

.seg-badge {
  font-size: 0.65rem;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  margin-left: 4px;
}

.panel-content {
  --background: #f5f5f7;
}

/* ─── Tab pane ──────────────────────────────────────────────── */
.tab-pane {
  padding: 14px;
  padding-bottom: 40px;
}

/* ─── Loading / empty ───────────────────────────────────────── */
.panel-loading {
  display: flex;
  justify-content: center;
  padding: 60px 20px;
}

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 50px 20px;
  text-align: center;
  color: #aaa;
  font-size: 0.9rem;
}

.empty-icon-wrap {
  width: 64px;
  height: 64px;
  background: rgba(18, 8, 161,0.06);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #1208a1;
  opacity: 0.5;
  margin-bottom: 14px;
}

/* ─── Requests ──────────────────────────────────────────────── */
.request-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.request-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.req-user {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}

.req-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid rgba(18, 8, 161,0.2);
}

.req-meta {
  flex: 1;
  min-width: 0;
}

.req-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.req-name {
  font-size: 0.9rem;
  font-weight: 800;
  color: #1a1a1a;
}

.tier-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 7px;
}

.req-bio {
  font-size: 0.8rem;
  color: #555;
  margin: 0 0 4px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.req-date {
  font-size: 0.7rem;
  color: #aaa;
  display: flex;
  align-items: center;
  gap: 4px;
}

.req-actions {
  display: flex;
  gap: 8px;
}

.approve-btn {
  flex: 1;
  --border-radius: 10px;
}

.reject-btn {
  flex: 1;
  --border-radius: 10px;
}

/* ─── Staff header ──────────────────────────────────────────── */
.staff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  background: #fff;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.staff-title-row {
  display: flex;
  flex-direction: column;
}

.staff-title {
  font-size: 1rem;
  font-weight: 900;
  color: #1a1a1a;
  margin: 0;
}

.staff-count {
  font-size: 0.72rem;
  color: #999;
  margin-top: 2px;
}

.invite-toggle-btn {
  --border-radius: 10px;
  --color: #1208a1;
  --border-color: rgba(18, 8, 161,0.4);
  flex-shrink: 0;
}

/* ─── Invite panel ──────────────────────────────────────────── */
.invite-panel {
  background: #fff;
  border: 1.5px dashed rgba(18, 8, 161,0.5);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 14px;
  animation: slideDown 0.2s ease;
}

.invite-title {
  font-size: 0.88rem;
  font-weight: 800;
  color: #1208a1;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.username-input-wrap {
  display: flex;
  align-items: center;
  background: #f7f7f7;
  border: 1.5px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 0 12px;
  margin-bottom: 12px;
  height: 44px;
}

.at-prefix {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1208a1;
  margin-right: 4px;
}

.username-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.9rem;
  color: #1a1a1a;
}

.invite-selectors {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.select-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.select-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.invite-select {
  --background: #f7f7f7;
  --border-radius: 10px;
  border: 1.5px solid rgba(0,0,0,0.08);
  border-radius: 10px;
  font-size: 0.85rem;
  height: 38px;
}

.send-invite-btn {
  --border-radius: 12px;
  --background: #1208a1;
  --color: #000;
  font-weight: 800;
  margin-top: 4px;
}

/* ─── Dept group ────────────────────────────────────────────── */
.dept-group {
  margin-bottom: 16px;
}

.dept-group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: linear-gradient(90deg, rgba(18, 8, 161,0.07), transparent);
  border-left: 3px solid #1208a1;
  border-radius: 10px;
  margin-bottom: 8px;
}

.dept-group-icon {
  width: 30px;
  height: 30px;
  background: rgba(18, 8, 161,0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1208a1;
  font-size: 15px;
  flex-shrink: 0;
}

.dept-group-name {
  font-size: 0.88rem;
  font-weight: 800;
  color: #1a1a1a;
  display: block;
}

.dept-group-count {
  font-size: 0.68rem;
  color: #999;
  display: block;
}

/* ─── Member cards ──────────────────────────────────────────── */
.member-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-card {
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  transition: box-shadow 0.2s;
}

.member-card:hover {
  box-shadow: 0 4px 14px rgba(0,0,0,0.08);
}

.member-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.mem-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.mem-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.role-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2px solid #fff;
}
.role-dot--org_admin    { background: #1208a1; }
.role-dot--dept_manager { background: #6366f1; }
.role-dot--dept_viewer  { background: #10b981; }

.mem-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.mem-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mem-handle {
  font-size: 0.7rem;
  color: #bbb;
}

.member-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.role-chip {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 3px 9px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.role-chip--org_admin    { background: rgba(18, 8, 161,0.12); color: #1208a1; }
.role-chip--dept_manager { background: rgba(99,102,241,0.1);  color: #6366f1; }
.role-chip--dept_viewer  { background: rgba(16,185,129,0.1);  color: #10b981; }

.invited-badge {
  font-size: 0.6rem;
  font-weight: 700;
}

.edit-btn {
  --color: #aaa;
  --padding-start: 6px;
  --padding-end: 6px;
  height: 30px;
}
.edit-btn:hover { --color: #1208a1; }

/* ─── Edit form ─────────────────────────────────────────────── */
.edit-form {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0,0,0,0.05);
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.edit-fields {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.edit-field-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.edit-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.edit-select {
  --background: #f7f7f7;
  --border-radius: 10px;
  border: 1.5px solid rgba(0,0,0,0.08);
  border-radius: 10px;
  font-size: 0.85rem;
  height: 40px;
}

.edit-action-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.save-btn {
  --border-radius: 10px;
  --background: #1208a1;
  --color: #000;
  font-weight: 800;
}

.cancel-edit-btn {
  --color: #999;
}

/* ─── Departments tab ───────────────────────────────────────── */
.dept-tab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  background: #fff;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.05);
}

.new-dept-form {
  background: #fff;
  border: 1.5px dashed rgba(18, 8, 161,0.5);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 14px;
  animation: slideDown 0.2s ease;
}

.dept-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dept-row {
  background: #fff;
  border-radius: 14px;
  padding: 14px 16px;
  border: 1px solid rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  transition: box-shadow 0.2s;
}

.dept-row:hover {
  box-shadow: 0 4px 14px rgba(0,0,0,0.08);
}

.dept-icon-wrap {
  width: 36px;
  height: 36px;
  background: rgba(18, 8, 161,0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1208a1;
  font-size: 18px;
  flex-shrink: 0;
}

.dept-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.dept-name {
  font-size: 0.9rem;
  font-weight: 800;
  color: #1a1a1a;
}

.dept-member-count {
  font-size: 0.7rem;
  color: #aaa;
  margin-top: 2px;
}

.delete-dept-btn {
  --color: #ef4444;
  --padding-start: 8px;
  --padding-end: 8px;
  opacity: 0.6;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.delete-dept-btn:hover {
  opacity: 1;
}

.edit-dept-btn {
  --color: #1208a1;
  --padding-start: 8px;
  --padding-end: 8px;
  opacity: 0.7;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.edit-dept-btn:hover { opacity: 1; }

.dept-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

/* ─── Dept logo picker ───────────────────────────────────────── */
.dept-logo-picker {
  border: 1.5px dashed rgba(18, 8, 161,0.45);
  border-radius: 12px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-bottom: 12px;
  overflow: hidden;
  transition: border-color 0.2s, background 0.2s;
}

.dept-logo-picker:hover {
  background: rgba(18, 8, 161,0.05);
  border-color: #1208a1;
}

.dept-logo-preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 10px;
  padding: 4px;
}

.dept-logo-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #bbb;
  font-size: 0.72rem;
}

.dept-logo-placeholder ion-icon { font-size: 20px; color: #ddd; }

/* ─── Dept inline edit form ──────────────────────────────────── */
.dept-edit-form {
  background: #fff;
  border: 1.5px solid rgba(18, 8, 161,0.3);
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 4px;
  animation: slideDown 0.2s ease;
}

.dept-edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
</style>
