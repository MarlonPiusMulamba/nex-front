<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('update:isOpen', false)">
    <ion-header>
      <ion-toolbar class="glass-toolbar">
        <ion-buttons slot="start">
          <ion-button @click="$emit('update:isOpen', false)">Cancel</ion-button>
        </ion-buttons>
        <ion-title>Create Notice</ion-title>
        <ion-buttons slot="end">
          <ion-button :disabled="!isValid || uploading" @click="submit" color="gold">
            <ion-spinner v-if="uploading" name="crescent"></ion-spinner>
            <span v-else>Post</span>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="composer-container">
        <ion-item class="custom-item">
          <ion-label position="stacked">Title</ion-label>
          <ion-input 
            v-model="formData.title" 
            placeholder="Main heading of the notice"
            maxlength="100"
          ></ion-input>
        </ion-item>

        <ion-item class="custom-item">
          <ion-label position="stacked">Category</ion-label>
          <ion-select v-model="formData.category" interface="popover">
            <ion-select-option value="General">General</ion-select-option>
            <ion-select-option value="Academic">Academic</ion-select-option>
            <ion-select-option value="Finance">Finance</ion-select-option>
            <ion-select-option value="Events">Events</ion-select-option>
            <ion-select-option value="Urgent">Urgent</ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item class="custom-item" v-if="departments.length > 0">
          <ion-label position="stacked">Target Department</ion-label>
          <ion-select v-model="formData.dept_id" interface="popover">
            <ion-select-option :value="null">All Members</ion-select-option>
            <ion-select-option 
              v-for="dept in departments" 
              :key="dept.id" 
              :value="dept.id"
            >
              {{ dept.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item class="custom-item body-item">
          <ion-label position="stacked">Announcement Content</ion-label>
          <ion-textarea 
            v-model="formData.body" 
            placeholder="Type your announcement here..."
            :rows="8"
            auto-grow
          ></ion-textarea>
        </ion-item>

        <div class="attachment-section">
          <input 
            type="file" 
            ref="fileInput" 
            @change="handleFileSelected" 
            style="display: none" 
            accept="image/*,.pdf,.doc,.docx"
          />
          
          <div v-if="formData.attachment" class="file-preview">
            <ion-icon :icon="documentOutline"></ion-icon>
            <span class="file-name">{{ formData.attachment.name }}</span>
            <ion-button fill="clear" color="danger" @click="formData.attachment = null">
              <ion-icon slot="icon-only" :icon="closeCircle"></ion-icon>
            </ion-button>
          </div>
          
          <ion-button 
            v-else 
            fill="outline" 
            color="medium" 
            @click="$refs.fileInput.click()"
            class="attach-btn"
          >
            <ion-icon slot="start" :icon="attachOutline"></ion-icon>
            Add Attachment (PDF/Image)
          </ion-button>
        </div>

        <div class="options-row" v-if="isAdmin">
          <ion-item lines="none" class="toggle-item">
            <ion-label>Pin to top</ion-label>
            <ion-toggle v-model="formData.is_pinned" color="gold"></ion-toggle>
          </ion-item>
        </div>

        <div class="preview-note">
          <ion-icon :icon="informationCircleOutline"></ion-icon>
          <p>This notice will be visible to all {{ formData.dept_id ? 'members of the selected department' : 'verified members' }} of {{ org.name }}.</p>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script>
import { 
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
  IonButton, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
  IonTextarea, IonToggle, IonSpinner, IonIcon
} from '@ionic/vue';
import { 
  attachOutline, documentOutline, closeCircle, 
  informationCircleOutline 
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config';

export default {
  name: 'NoticeComposerModal',
  components: { 
    IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
    IonButton, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
    IonTextarea, IonToggle, IonSpinner, IonIcon
  },
  props: {
    isOpen: Boolean,
    org: Object,
    membership: Object,
    departments: Array
  },
  data() {
    return {
      attachOutline, documentOutline, closeCircle, informationCircleOutline,
      uploading: false,
      formData: {
        title: '',
        body: '',
        category: 'General',
        dept_id: null,
        is_pinned: false,
        attachment: null
      },
      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL
    };
  },
  computed: {
    isValid() {
      return this.formData.title.length > 5 && this.formData.body.length > 10;
    },
    isAdmin() {
      return this.membership?.role === 'org_admin';
    }
  },
  methods: {
    handleFileSelected(event) {
      const file = event.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          alert('File too large (max 5MB)');
          return;
        }
        this.formData.attachment = file;
      }
    },
    async submit() {
      this.uploading = true;
      try {
        const payload = new FormData();
        payload.append('user_id', this.userId);
        payload.append('title', this.formData.title);
        payload.append('body', this.formData.body);
        payload.append('category', this.formData.category);
        payload.append('is_pinned', this.formData.is_pinned);
        
        if (this.formData.dept_id) {
          payload.append('dept_id', this.formData.dept_id);
        }
        
        if (this.formData.attachment) {
          payload.append('file', this.formData.attachment);
        }

        const res = await axios.post(
          `${this.API_URL}/api/boards/${this.org.slug}/notices`, 
          payload,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );

        if (res.data.success) {
          this.$emit('success');
          this.reset();
          this.$emit('update:isOpen', false);
        }
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to post notice');
      } finally {
        this.uploading = false;
      }
    },
    reset() {
      this.formData = {
        title: '',
        body: '',
        category: 'General',
        dept_id: null,
        is_pinned: false,
        attachment: null
      };
    }
  }
};
</script>

<style scoped>
.composer-container {
  max-width: 600px;
  margin: 0 auto;
}

.custom-item {
  --background: rgba(255, 255, 255, 0.05);
  --border-radius: 12px;
  margin-bottom: 20px;
  border-radius: 12px;
}

.body-item {
  --padding-bottom: 10px;
}

.attachment-section {
  margin-bottom: 25px;
}

.attach-btn {
  --border-style: dashed;
  --border-width: 2px;
  height: 45px;
  margin: 0;
}

.file-preview {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 15px;
  border-radius: 10px;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.file-name {
  flex: 1;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toggle-item {
  --background: transparent;
  padding: 0;
}

.preview-note {
  display: flex;
  gap: 12px;
  padding: 15px;
  background: rgba(212, 175, 55, 0.05);
  border-radius: 12px;
  margin-top: 30px;
}

.preview-note p {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.6;
}

.preview-note ion-icon {
  color: gold;
  font-size: 1.2rem;
}
</style>
