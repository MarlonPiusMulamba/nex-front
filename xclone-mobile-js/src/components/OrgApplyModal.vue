<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('update:isOpen', false)">
    <ion-header>
      <ion-toolbar class="glass-toolbar">
        <ion-buttons slot="start">
          <ion-button @click="$emit('update:isOpen', false)" class="cancel-modal-btn">Cancel</ion-button>
        </ion-buttons>
        <ion-title class="modal-title">Create Notice Board</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding modal-content-dark">
      <!-- STEP 1: Basic Information -->
      <div v-if="step === 'apply'" class="apply-form">
        <div class="form-header">
          <div class="icon-circle">
            <ion-icon :icon="businessOutline" class="header-icon"></ion-icon>
          </div>
          <h3>Setup a Notice Board</h3>
          <p>Launch an official digital notice space for your company, department, university, or organization.</p>
        </div>

        <div class="form-group">
          <label class="field-label">Notice Board Name *</label>
          <ion-item class="custom-item" lines="none">
            <ion-input 
              v-model="formData.name" 
              placeholder="e.g. Company Name, Department, University, Organization"
              class="custom-input"
            ></ion-input>
          </ion-item>
          <span class="field-hint">The primary title displayed on your official board banner.</span>
        </div>

        <div class="form-group">
          <label class="field-label">Domain or Company Identifier *</label>
          <ion-item class="custom-item" lines="none">
            <ion-input 
              v-model="formData.domain" 
              placeholder="e.g. nexfi.net, vu.ac.ug, x.com"
              class="custom-input"
            ></ion-input>
          </ion-item>
          <span class="field-hint">Official domain you own or administer (e.g. nexfi.net, vu.ac.ug, x.com).</span>
        </div>

        <div class="form-group">
          <label class="field-label">Audience &amp; Visibility</label>
          <ion-item class="custom-item" lines="none">
            <ion-select v-model="formData.visibility" interface="popover" class="custom-select">
              <ion-select-option value="public">Public (Open Reading — Anyone can view official notices)</ion-select-option>
              <ion-select-option value="locked">Protected (Members Only — Requires join approval)</ion-select-option>
            </ion-select>
          </ion-item>
        </div>

        <div class="info-card">
          <ion-icon :icon="informationCircleOutline" class="info-icon"></ion-icon>
          <div class="info-text">
            <strong>DNS Ownership Verification Required</strong>
            <p>To prevent impersonation, you will be given a secure TXT record token to add to your domain DNS before this board becomes active.</p>
          </div>
        </div>

        <ion-button 
          expand="block" 
          @click="submitApply" 
          :disabled="loading || !isValid"
          class="submit-btn"
        >
          <ion-spinner v-if="loading" name="crescent"></ion-spinner>
          <span v-else>Continue to Domain Verification</span>
        </ion-button>
      </div>

      <!-- STEP 2: Strict DNS Ownership Verification -->
      <div v-else-if="step === 'verify'" class="verify-instructions">
        <div class="form-header">
          <div class="icon-circle active">
            <ion-icon :icon="globeOutline" class="header-icon pulse"></ion-icon>
          </div>
          <h3>Verify Domain Ownership</h3>
          <p>
            Prove ownership of <strong>{{ formData.domain }}</strong> for <strong>{{ formData.name }}</strong> by adding the following DNS TXT record.
          </p>
        </div>

        <div class="dns-card">
          <div class="dns-badge">REQUIRED DNS TXT RECORD</div>
          
          <div class="dns-row">
            <span class="label">Record Type</span>
            <span class="value">TXT</span>
          </div>
          
          <div class="dns-row">
            <span class="label">Host / Name</span>
            <span class="value">@ (or root)</span>
          </div>
          
          <div class="dns-row">
            <span class="label">Verification Token / TXT Value</span>
            <div class="token-wrapper">
              <span class="value token">{{ orgData?.dns_token }}</span>
              <ion-button fill="clear" size="small" @click="copyToken" class="copy-btn" title="Copy Token">
                <ion-icon slot="icon-only" :icon="copyOutline"></ion-icon>
              </ion-button>
            </div>
          </div>

          <div class="steps-guide">
            <div class="guide-title">HOW TO VERIFY:</div>
            <div class="step-line"><span class="step-num">1</span> Log in to your domain DNS manager (Cloudflare, Namecheap, GoDaddy, Route53, cPanel, etc.).</div>
            <div class="step-line"><span class="step-num">2</span> Add a new <strong>TXT</strong> record with host <code>@</code> and paste the token above.</div>
            <div class="step-line"><span class="step-num">3</span> Click <strong>Check &amp; Verify DNS Record</strong> below.</div>
          </div>

          <div class="status-box" :class="verificationStatus" v-if="statusMessage">
            <ion-spinner v-if="verifying" name="crescent"></ion-spinner>
            <ion-icon v-else-if="verificationStatus === 'failed'" :icon="alertCircleOutline" class="status-icon"></ion-icon>
            <ion-icon v-else-if="verificationStatus === 'success'" :icon="checkmarkCircle" class="status-icon"></ion-icon>
            <p>{{ statusMessage }}</p>
          </div>

          <ion-button 
            expand="block" 
            @click="checkDNS" 
            :disabled="verifying"
            class="dns-check-btn"
          >
            <ion-spinner v-if="verifying" name="crescent"></ion-spinner>
            <span v-else>🔍 Check &amp; Verify DNS Record</span>
          </ion-button>
        </div>
      </div>

      <!-- STEP 3: Success -->
      <div v-else-if="step === 'success'" class="success-screen">
        <div class="success-icon-wrap">
          <ion-icon :icon="checkmarkCircle" class="success-icon"></ion-icon>
        </div>
        <h3>Domain Verified &amp; Board Live!</h3>
        <p>Your official notice board for <strong>{{ formData.name }}</strong> has been verified via DNS and is now active on NexFi.</p>
        
        <div class="action-stack">
          <ion-button expand="block" class="open-btn" @click="finish">
            <ion-icon slot="start" :icon="arrowForwardOutline"></ion-icon>
            Open Notice Board
          </ion-button>
          <ion-button expand="block" fill="clear" color="light" @click="finishDirectory">
            Back to Directory
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script>
import { 
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
  IonButton, IonItem, IonInput, IonSelect, IonSelectOption,
  IonSpinner, IonIcon
} from '@ionic/vue';
import { 
  businessOutline, informationCircleOutline, globeOutline, 
  copyOutline, alertCircleOutline, checkmarkCircle, arrowForwardOutline
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config';

export default {
  name: 'OrgApplyModal',
  components: { 
    IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
    IonButton, IonItem, IonInput, IonSelect, IonSelectOption,
    IonSpinner, IonIcon
  },
  props: {
    isOpen: Boolean
  },
  emits: ['update:isOpen', 'success'],
  data() {
    return {
      businessOutline, informationCircleOutline, globeOutline, 
      copyOutline, alertCircleOutline, checkmarkCircle, arrowForwardOutline,
      step: 'apply',
      loading: false,
      verifying: false,
      verificationStatus: 'idle',
      statusMessage: '',
      formData: {
        name: '',
        domain: '',
        visibility: 'public'
      },
      orgData: null,
      API_URL: config.api.baseURL
    };
  },
  computed: {
    isValid() {
      return (
        this.formData.name && 
        this.formData.name.trim().length >= 2 && 
        this.formData.domain && 
        this.formData.domain.trim().length >= 3 &&
        this.formData.domain.includes('.')
      );
    }
  },
  methods: {
    async submitApply() {
      const currentUserId = localStorage.getItem('userId') || '1';
      this.loading = true;
      try {
        const domainClean = this.formData.domain.trim().toLowerCase();

        const res = await axios.post(`${this.API_URL}/api/boards/apply`, {
          user_id: currentUserId,
          name: this.formData.name.trim(),
          domain: domainClean,
          visibility: this.formData.visibility
        });

        if (res.data.success) {
          this.orgData = res.data.org;
          this.step = 'verify';
          this.verificationStatus = 'idle';
          this.statusMessage = '';
        } else {
          alert(res.data.error || 'Failed to register notice board application');
        }
      } catch (err) {
        alert(err.response?.data?.error || 'Server error while registering board');
      } finally {
        this.loading = false;
      }
    },
    async checkDNS() {
      if (!this.orgData) return;
      this.verifying = true;
      this.verificationStatus = 'verifying';
      this.statusMessage = 'Querying global DNS records for TXT verification token...';
      
      try {
        const res = await axios.get(`${this.API_URL}/api/boards/verify-dns/${this.orgData.id}`);
        if (res.data.success) {
          this.verificationStatus = 'success';
          this.statusMessage = '✅ Domain ownership verified successfully! Activating notice board...';
          setTimeout(() => {
            this.step = 'success';
          }, 1200);
        } else {
          this.verificationStatus = 'failed';
          this.statusMessage = res.data.message || 'TXT verification token not detected in DNS. DNS changes can take a few minutes to propagate.';
        }
      } catch (err) {
        this.verificationStatus = 'failed';
        this.statusMessage = err.response?.data?.message || err.response?.data?.error || 'DNS query failed. Could not find or reach domain DNS records.';
      } finally {
        this.verifying = false;
      }
    },
    copyToken() {
      if (this.orgData?.dns_token) {
        navigator.clipboard.writeText(this.orgData.dns_token);
        alert('Verification token copied to clipboard!');
      }
    },
    finish() {
      const slug = this.orgData?.slug;
      this.$emit('success');
      this.$emit('update:isOpen', false);
      this.resetModal();
      if (slug) {
        this.$router.push(`/tabs/notices/${slug}`);
      }
    },
    finishDirectory() {
      this.$emit('success');
      this.$emit('update:isOpen', false);
      this.resetModal();
    },
    resetModal() {
      this.step = 'apply';
      this.formData = { name: '', domain: '', visibility: 'public' };
      this.orgData = null;
      this.statusMessage = '';
      this.verificationStatus = 'idle';
    }
  }
};
</script>

<style scoped>
.glass-toolbar {
  --background: #11131c;
  --border-color: rgba(255, 215, 0, 0.2);
  backdrop-filter: blur(15px);
}

.cancel-modal-btn {
  --color: #ffffff;
  font-weight: 600;
}

.modal-title {
  color: #ffd700;
  font-weight: 800;
  letter-spacing: -0.3px;
}

.modal-content-dark {
  --background: #0d0f18;
  color: #f1f5f9;
}

.apply-form, .verify-instructions, .success-screen {
  max-width: 520px;
  margin: 0 auto;
  padding: 10px 8px 30px;
}

.form-header {
  text-align: center;
  margin-bottom: 24px;
}

.icon-circle {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: rgba(255, 215, 0, 0.12);
  border: 1px solid rgba(255, 215, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
}

.icon-circle.active {
  background: rgba(255, 215, 0, 0.18);
  border-color: #ffd700;
}

.header-icon {
  font-size: 2.2rem;
  color: #ffd700;
}

.form-header h3 {
  margin: 0;
  font-weight: 800;
  font-size: 1.45rem;
  color: #ffffff;
}

.form-header p {
  opacity: 0.8;
  margin: 8px 0 0;
  font-size: 0.9rem;
  line-height: 1.45;
  color: #e2e8f0;
}

.form-group {
  margin-bottom: 18px;
}

.field-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field-hint {
  display: block;
  font-size: 0.76rem;
  color: #cbd5e1;
  margin-top: 5px;
  line-height: 1.35;
}

.custom-item {
  --background: #171926;
  --border-radius: 12px;
  --padding-start: 14px;
  --padding-end: 14px;
  border: 1px solid rgba(255, 215, 0, 0.25);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.custom-item:focus-within {
  border-color: #ffd700;
}

.custom-input {
  --color: #ffffff;
  --placeholder-color: rgba(255, 255, 255, 0.45);
  font-size: 0.95rem;
}

.custom-select {
  --color: #ffffff;
  width: 100%;
  font-size: 0.92rem;
}

.info-card {
  background: rgba(255, 215, 0, 0.08);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin: 22px 0;
}

.info-icon {
  font-size: 1.45rem;
  color: #ffd700;
  flex-shrink: 0;
  margin-top: 2px;
}

.info-text strong {
  display: block;
  font-size: 0.88rem;
  color: #ffd700;
  margin-bottom: 2px;
}

.info-text p {
  margin: 0;
  font-size: 0.82rem;
  color: #f1f5f9;
  line-height: 1.4;
}

.submit-btn {
  margin-top: 24px;
  height: 50px;
  font-weight: 800;
  font-size: 0.95rem;
  --background: #ffd700;
  --color: #000000;
  --border-radius: 12px;
  box-shadow: 0 4px 16px rgba(255, 215, 0, 0.25);
}

/* DNS CARD */
.dns-card {
  background: #171926;
  border: 1px solid rgba(255, 215, 0, 0.35);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
}

.dns-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.6px;
  color: #000000;
  background: #ffd700;
  padding: 3px 9px;
  border-radius: 6px;
  margin-bottom: 14px;
}

.dns-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.dns-row:nth-of-type(3) {
  border-bottom: none;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.dns-row .label {
  font-size: 0.78rem;
  color: #cbd5e1;
  text-transform: uppercase;
  font-weight: 700;
}

.dns-row .value {
  font-weight: 700;
  color: #ffd700;
  font-size: 0.88rem;
}

.token-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
  background: rgba(0, 0, 0, 0.6);
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 215, 0, 0.45);
}

.token {
  font-family: monospace;
  font-size: 0.86rem;
  word-break: break-all;
  flex: 1;
}

.copy-btn {
  --color: #ffd700;
}

/* STEP GUIDE */
.steps-guide {
  margin: 18px 0;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.guide-title {
  font-size: 0.72rem;
  font-weight: 800;
  color: #ffd700;
  letter-spacing: 0.6px;
  margin-bottom: 8px;
}

.step-line {
  font-size: 0.8rem;
  color: #e2e8f0;
  margin-bottom: 6px;
  line-height: 1.4;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.step-line:last-child {
  margin-bottom: 0;
}

.step-num {
  display: inline-flex;
  width: 18px;
  height: 18px;
  background: #ffd700;
  color: #000000;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 800;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.step-line code {
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 4px;
  border-radius: 4px;
  font-family: monospace;
  color: #ffd700;
}

/* STATUS FEEDBACK BOX */
.status-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  margin: 16px 0 12px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.85rem;
}

.status-icon {
  font-size: 1.4rem;
  flex-shrink: 0;
}

.status-box.failed {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.status-box.success {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.dns-check-btn {
  margin-top: 14px;
  height: 48px;
  font-size: 0.92rem;
  font-weight: 800;
  --background: #ffd700;
  --color: #000000;
  --border-radius: 10px;
  box-shadow: 0 4px 14px rgba(255, 215, 0, 0.3);
}

/* SUCCESS SCREEN */
.success-screen {
  text-align: center;
  padding: 40px 10px;
}

.success-icon-wrap {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: rgba(255, 215, 0, 0.15);
  border: 2px solid #ffd700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.success-icon {
  font-size: 4.5rem;
  color: #ffd700;
}

.success-screen h3 {
  font-size: 1.55rem;
  font-weight: 800;
  margin: 0 0 10px;
  color: #ffffff;
}

.success-screen p {
  font-size: 0.92rem;
  color: #e2e8f0;
  line-height: 1.45;
  margin-bottom: 28px;
}

.action-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.open-btn {
  height: 50px;
  font-weight: 800;
  --background: #ffd700;
  --color: #000000;
  --border-radius: 12px;
  box-shadow: 0 4px 18px rgba(255, 215, 0, 0.3);
}

.pulse {
  animation: pulse-animation 2s infinite;
}

@keyframes pulse-animation {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.08); opacity: 0.75; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
