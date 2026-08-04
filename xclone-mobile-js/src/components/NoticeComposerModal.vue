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
          <ion-input v-model="formData.title" placeholder="Main heading of the notice" maxlength="100"></ion-input>
        </ion-item>

        <ion-item class="custom-item">
          <ion-label position="stacked">Category</ion-label>
          <ion-select v-model="formData.category" interface="popover">
            <ion-select-option value="General">General</ion-select-option>
            <ion-select-option value="Academic">Academic</ion-select-option>
            <ion-select-option value="Finance">Finance</ion-select-option>
            <ion-select-option value="Events">Events</ion-select-option>
            <ion-select-option value="Urgent">🚨 Urgent</ion-select-option>
          </ion-select>
        </ion-item>

        <!-- 🚨 Urgency Active Window / Expiry Picker -->
        <transition name="fade">
          <div v-if="formData.category === 'Urgent'" class="urgent-expiry-wrapper">
            <ion-item class="custom-item urgent-item">
              <ion-label position="stacked">Urgency Duration</ion-label>
              <ion-select v-model="formData.urgent_duration" interface="popover">
                <ion-select-option value="12h">12 Hours (Same day alert)</ion-select-option>
                <ion-select-option value="24h">24 Hours (1 Day — Default)</ion-select-option>
                <ion-select-option value="48h">48 Hours (2 Days)</ion-select-option>
                <ion-select-option value="3d">3 Days</ion-select-option>
                <ion-select-option value="7d">7 Days (1 Week)</ion-select-option>
                <ion-select-option value="custom">Custom Date & Time</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item class="custom-item urgent-item" v-if="formData.urgent_duration === 'custom'">
              <ion-label position="stacked">Urgency Stops On</ion-label>
              <input
                type="datetime-local"
                v-model="formData.custom_expires_at"
                class="custom-datetime-picker"
              />
            </ion-item>
          </div>
        </transition>

        <ion-item class="custom-item" v-if="departments.length > 0">
          <ion-label position="stacked">Target Department</ion-label>
          <ion-select v-model="formData.dept_id" interface="popover">
            <ion-select-option :value="null">All Members</ion-select-option>
            <ion-select-option v-for="dept in departments" :key="dept.id" :value="dept.id">
              {{ dept.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item class="custom-item body-item">
          <ion-label position="stacked">Announcement Content</ion-label>
          <ion-textarea v-model="formData.body" placeholder="Type your announcement here..." :rows="6" auto-grow></ion-textarea>
        </ion-item>

        <!-- ── Media attachment section ────────────────────── -->
        <div class="attachment-section">
          <!-- Hidden file inputs -->
          <input ref="imageInput" type="file" accept="image/*" multiple style="display:none" @change="onImagesSelected" />
          <input ref="pdfInput" type="file" accept=".pdf,.doc,.docx" style="display:none" @change="onPdfSelected" />

          <!-- Action buttons row -->
          <div class="attach-actions">
            <button class="attach-action-btn" @click="triggerImageInput" :disabled="imageFiles.length >= 4" type="button">
              <ion-icon :icon="imagesOutline"></ion-icon>
              <span>Images ({{ imageFiles.length }}/4)</span>
            </button>
            <button class="attach-action-btn" @click="triggerPdfInput" type="button">
              <ion-icon :icon="documentTextOutline"></ion-icon>
              <span>{{ pdfFile ? pdfFile.name : 'Add PDF / Doc' }}</span>
            </button>
          </div>

          <!-- X-style image preview grid -->
          <div v-if="imagePreviews.length > 0" class="media-preview-grid" :class="`count-${Math.min(imagePreviews.length, 4)}`">
            <div
              v-for="(preview, i) in imagePreviews.slice(0, 4)"
              :key="i"
              class="media-preview-cell"
            >
              <img :src="preview" class="media-preview-img" />
              <button class="media-remove-btn" @click="removeImage(i)" type="button">
                <ion-icon :icon="closeCircle"></ion-icon>
              </button>
            </div>
          </div>

          <!-- PDF chip -->
          <div v-if="pdfFile" class="pdf-chip">
            <ion-icon :icon="documentOutline"></ion-icon>
            <span class="pdf-name">{{ pdfFile.name }}</span>
            <button class="pdf-remove-btn" @click="pdfFile = null" type="button">
              <ion-icon :icon="closeCircle"></ion-icon>
            </button>
          </div>
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
  informationCircleOutline, imagesOutline, documentTextOutline
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
      attachOutline, documentOutline, closeCircle,
      informationCircleOutline, imagesOutline, documentTextOutline,
      uploading: false,
      imageFiles: [],      // File objects for images
      imagePreviews: [],   // data-URL previews
      pdfFile: null,       // single PDF/doc File object
      formData: {
        title: '',
        body: '',
        category: 'General',
        dept_id: null,
        is_pinned: false,
        urgent_duration: '24h',
        custom_expires_at: ''
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
    triggerImageInput() {
      const el = this.$refs.imageInput;
      if (el) el.click();
    },
    triggerPdfInput() {
      const el = this.$refs.pdfInput;
      if (el) el.click();
    },
    onImagesSelected(e) {
      const selected = Array.from(e.target.files || []);
      const remaining = 4 - this.imageFiles.length;
      const toAdd = selected.slice(0, remaining);
      for (const f of toAdd) {
        if (f.size > 10 * 1024 * 1024) { alert(`${f.name} is too large (max 10MB)`); continue; }
        this.imageFiles.push(f);
        const reader = new FileReader();
        reader.onload = ev => this.imagePreviews.push(ev.target.result);
        reader.readAsDataURL(f);
      }
      // Reset input so same file can be re-selected if removed
      e.target.value = '';
    },
    onPdfSelected(e) {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 20 * 1024 * 1024) { alert('Document too large (max 20MB)'); return; }
      this.pdfFile = f;
      e.target.value = '';
    },
    removeImage(index) {
      this.imageFiles.splice(index, 1);
      this.imagePreviews.splice(index, 1);
    },
    async submit() {
      this.uploading = true;
      try {
        const payload = new FormData();
        payload.append('user_id', this.userId || localStorage.getItem('userId'));
        payload.append('title', this.formData.title);
        payload.append('body', this.formData.body);
        payload.append('category', this.formData.category);
        payload.append('is_pinned', this.formData.is_pinned);
        if (this.formData.dept_id) payload.append('dept_id', this.formData.dept_id);

        // 🚨 Compute Urgent Expiry Timestamp
        let calculatedExpiresAt = null;
        if (this.formData.category === 'Urgent') {
          const now = new Date();
          if (this.formData.urgent_duration === '12h') {
            calculatedExpiresAt = new Date(now.getTime() + 12 * 3600 * 1000).toISOString();
          } else if (this.formData.urgent_duration === '24h') {
            calculatedExpiresAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
          } else if (this.formData.urgent_duration === '48h') {
            calculatedExpiresAt = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
          } else if (this.formData.urgent_duration === '3d') {
            calculatedExpiresAt = new Date(now.getTime() + 72 * 3600 * 1000).toISOString();
          } else if (this.formData.urgent_duration === '7d') {
            calculatedExpiresAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
          } else if (this.formData.urgent_duration === 'custom' && this.formData.custom_expires_at) {
            calculatedExpiresAt = new Date(this.formData.custom_expires_at).toISOString();
          } else {
            calculatedExpiresAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
          }
        }
        if (calculatedExpiresAt) {
          payload.append('expires_at', calculatedExpiresAt);
        }

        // Append images under key "files" (supports multiple)
        for (const img of this.imageFiles) {
          payload.append('files', img);
        }
        // Append PDF under key "files" too — backend separates by extension
        if (this.pdfFile) payload.append('files', this.pdfFile);

        const res = await axios.post(
          `${this.API_URL}/api/boards/${this.org.slug}/notices`,
          payload,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );

        if (res.data.success) {
          this.$emit('success');
          this.reset();
          this.$emit('update:isOpen', false);
        } else {
          alert(res.data.error || 'Failed to post notice');
        }
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to post notice');
      } finally {
        this.uploading = false;
      }
    },
    reset() {
      this.imageFiles = [];
      this.imagePreviews = [];
      this.pdfFile = null;
      this.formData = {
        title: '',
        body: '',
        category: 'General',
        dept_id: null,
        is_pinned: false,
        urgent_duration: '24h',
        custom_expires_at: ''
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
  margin-bottom: 14px;
  border-radius: 12px;
}

.body-item { --padding-bottom: 10px; }

/* ── Attachment section ──────────────────────────────── */
.attachment-section { margin-bottom: 18px; }

.attach-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.attach-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  padding: 10px 14px;
  border: 1.5px dashed rgba(218,165,32,0.4);
  border-radius: 10px;
  background: rgba(218,165,32,0.05);
  color: #c0921c;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.attach-action-btn:hover:not(:disabled) {
  background: rgba(218,165,32,0.12);
  border-color: rgba(218,165,32,0.7);
}
.attach-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.attach-action-btn ion-icon { font-size: 1.1rem; }

/* ── X-style image grid ─────────────────────────────── */
.media-preview-grid {
  display: grid;
  gap: 3px;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 10px;
}

.media-preview-grid.count-1 {
  grid-template-columns: 1fr;
  max-height: 300px;
}

.media-preview-grid.count-2 {
  grid-template-columns: 1fr 1fr;
  height: 200px;
}

.media-preview-grid.count-3 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  height: 230px;
}
.media-preview-grid.count-3 .media-preview-cell:first-child {
  grid-row: 1 / span 2;
}

.media-preview-grid.count-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  height: 230px;
}

.media-preview-cell {
  position: relative;
  overflow: hidden;
  background: #111;
}

.media-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.media-remove-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  background: rgba(0,0,0,0.65);
  border: none;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  font-size: 1rem;
  padding: 0;
}
.media-remove-btn:hover { background: rgba(220,50,50,0.8); }

/* ── PDF chip ───────────────────────────────────────── */
.pdf-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 4px;
  color: var(--ion-text-color, #eee);
}
.pdf-chip ion-icon { font-size: 1.3rem; color: #e05c5c; flex-shrink: 0; }
.pdf-name {
  flex: 1;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pdf-remove-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #aaa;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  padding: 0;
}
.pdf-remove-btn:hover { color: #e05c5c; }

/* ── Other ──────────────────────────────────────────── */
.toggle-item { --background: transparent; padding: 0; }

.preview-note {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: rgba(212, 175, 55, 0.05);
  border-radius: 12px;
  margin-top: 20px;
}
.preview-note p { margin: 0; font-size: 0.85rem; opacity: 0.6; }
.preview-note ion-icon { color: gold; font-size: 1.2rem; }

/* ── Urgent Expiry Section ── */
.urgent-expiry-wrapper {
  background: rgba(239, 68, 68, 0.04);
  border: 1px dashed rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  padding: 8px 10px;
  margin-bottom: 14px;
}

.urgent-item {
  --background: transparent;
  margin-bottom: 6px;
}

.custom-datetime-picker {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(218, 165, 32, 0.3);
  background: var(--ion-background-color, #ffffff);
  color: var(--ion-text-color, #1a1a1a);
  font-family: inherit;
  font-size: 0.9rem;
  margin-top: 4px;
  outline: none;
}
.custom-datetime-picker:focus {
  border-color: #daa520;
}
</style>
