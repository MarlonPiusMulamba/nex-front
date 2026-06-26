<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('update:isOpen', false)">
    <ion-header>
      <ion-toolbar class="glass-toolbar">
        <ion-buttons slot="start">
          <ion-button @click="$emit('update:isOpen', false)">Cancel</ion-button>
        </ion-buttons>
        <ion-title>Register Organisation</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="step === 'apply'" class="apply-form">
        <div class="form-header">
          <ion-icon :icon="businessOutline" class="header-icon"></ion-icon>
          <h3>Institution Details</h3>
          <p>Official notice boards require domain-based verification to prevent impersonation.</p>
        </div>

        <ion-item class="custom-item">
          <ion-label position="stacked">Organisation Name</ion-label>
          <ion-input 
            v-model="formData.name" 
            placeholder="e.g. Bugema University"
          ></ion-input>
        </ion-item>

        <ion-item class="custom-item">
          <ion-label position="stacked">Official Domain</ion-label>
          <ion-input 
            v-model="formData.domain" 
            placeholder="e.g. bugema.ac.ug"
          ></ion-input>
        </ion-item>

        <ion-item class="custom-item">
          <ion-label position="stacked">Visibility Mode</ion-label>
          <ion-select v-model="formData.visibility">
            <ion-select-option value="public">Public (Open Reading)</ion-select-option>
            <ion-select-option value="locked">Locked (Request to Join)</ion-select-option>
          </ion-select>
        </ion-item>

        <div class="info-box">
          <ion-icon :icon="informationCircleOutline"></ion-icon>
          <p>You will need to add a DNS TXT record to your domain to verify ownership.</p>
        </div>

        <ion-button 
          expand="block" 
          color="gold" 
          @click="submitApply" 
          :disabled="loading || !isValid"
          class="submit-btn"
        >
          <ion-spinner v-if="loading" name="crescent"></ion-spinner>
          <span v-else>Apply for Verification</span>
        </ion-button>
      </div>

      <div v-else-if="step === 'verify'" class="verify-instructions">
        <div class="form-header">
          <ion-icon :icon="globeOutline" class="header-icon pulse"></ion-icon>
          <h3>Verify Domain Ownership</h3>
          <p>Please add the following TXT record to your DNS settings for <strong>{{ formData.domain }}</strong></p>
        </div>

        <div class="dns-card">
          <div class="dns-row">
            <span class="label">Type</span>
            <span class="value">TXT</span>
          </div>
          <div class="dns-row">
            <span class="label">Host/Name</span>
            <span class="value">@</span>
          </div>
          <div class="dns-row">
            <span class="label">Value</span>
            <div class="token-wrapper">
              <span class="value token">{{ orgData?.dns_token }}</span>
              <ion-button fill="clear" size="small" @click="copyToken">
                <ion-icon slot="icon-only" :icon="copyOutline"></ion-icon>
              </ion-button>
            </div>
          </div>
        </div>

        <div class="status-box" :class="verificationStatus">
          <ion-spinner v-if="verifying" name="crescent"></ion-spinner>
          <ion-icon v-else-if="verificationStatus === 'failed'" :icon="alertCircleOutline"></ion-icon>
          <p>{{ statusMessage || 'Waiting to detect DNS record...' }}</p>
        </div>

        <ion-button 
          expand="block" 
          color="gold" 
          @click="checkDNS" 
          :disabled="verifying"
        >
          Verify Now
        </ion-button>
        
        <p class="note">DNS changes can take up to 24 hours to propagate, but usually happen in minutes.</p>
      </div>

      <div v-else-if="step === 'success'" class="success-screen">
        <ion-icon :icon="checkmarkCircle" class="success-icon"></ion-icon>
        <h3>Verification Successful!</h3>
        <p>Your organisation board for <strong>{{ formData.name }}</strong> is now active.</p>
        <ion-button expand="block" color="gold" @click="finish">
          Go to Admin Panel
        </ion-button>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script>
import { 
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
  IonButton, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
  IonSpinner, IonIcon
} from '@ionic/vue';
import { 
  businessOutline, informationCircleOutline, globeOutline, 
  copyOutline, alertCircleOutline, checkmarkCircle 
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config';

export default {
  name: 'OrgApplyModal',
  components: { 
    IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
    IonButton, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
    IonSpinner, IonIcon
  },
  props: {
    isOpen: Boolean
  },
  data() {
    return {
      businessOutline, informationCircleOutline, globeOutline, 
      copyOutline, alertCircleOutline, checkmarkCircle,
      step: 'apply', // apply, verify, success
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
      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL
    };
  },
  computed: {
    isValid() {
      return this.formData.name.length > 2 && this.formData.domain.includes('.');
    }
  },
  methods: {
    async submitApply() {
      this.loading = true;
      try {
        const res = await axios.post(`${this.API_URL}/api/boards/apply`, {
          user_id: this.userId,
          ...this.formData
        });
        if (res.data.success) {
          this.orgData = res.data.org;
          this.step = 'verify';
        } else {
          alert(res.data.error || 'Failed to submit application');
        }
      } catch (err) {
        alert(err.response?.data?.error || 'Server error');
      } finally {
        this.loading = false;
      }
    },
    async checkDNS() {
      if (!this.orgData) return;
      this.verifying = true;
      this.verificationStatus = 'verifying';
      this.statusMessage = 'Checking DNS records...';
      
      try {
        const res = await axios.get(`${this.API_URL}/api/boards/verify-dns/${this.orgData.id}`);
        if (res.data.success) {
          this.verificationStatus = 'success';
          this.statusMessage = 'Domain verified!';
          setTimeout(() => {
            this.step = 'success';
          }, 1500);
        } else {
          this.verificationStatus = 'failed';
          this.statusMessage = res.data.message || 'Token not found yet.';
        }
      } catch (err) {
        this.verificationStatus = 'failed';
        this.statusMessage = 'Verification service error.';
      } finally {
        this.verifying = false;
      }
    },
    copyToken() {
      navigator.clipboard.writeText(this.orgData?.dns_token);
      // Optional: show toast
    },
    finish() {
      this.$emit('success');
      this.$emit('update:isOpen', false);
      // Reset
      this.step = 'apply';
      this.formData = { name: '', domain: '', visibility: 'public' };
    }
  }
};
</script>

<style scoped>
.apply-form, .verify-instructions, .success-screen {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px 10px;
}

.form-header {
  text-align: center;
  margin-bottom: 30px;
}

.header-icon {
  font-size: 3.5rem;
  color: gold;
  margin-bottom: 15px;
}

.form-header h3 {
  margin: 0;
  font-weight: 800;
  font-size: 1.5rem;
}

.form-header p {
  opacity: 0.6;
  margin: 10px 0 0 0;
  line-height: 1.4;
}

.custom-item {
  --background: rgba(255, 255, 255, 0.05);
  --border-radius: 12px;
  --padding-start: 15px;
  margin-bottom: 15px;
  border-radius: 12px;
  overflow: hidden;
}

.info-box {
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 20px 0;
}

.info-box p {
  margin: 0;
  font-size: 0.85rem;
  color: gold;
}

.submit-btn {
  margin-top: 30px;
  height: 50px;
  font-weight: 700;
}

.dns-card {
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 30px;
}

.dns-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.dns-row:last-child {
  border-bottom: none;
  flex-direction: column;
  gap: 8px;
}

.dns-row .label {
  font-size: 0.8rem;
  opacity: 0.5;
  text-transform: uppercase;
}

.dns-row .value {
  font-weight: 600;
  color: gold;
}

.token-wrapper {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
  padding: 10px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 215, 0, 0.3);
}

.token {
  font-family: monospace;
  font-size: 0.95rem;
  word-break: break-all;
  flex: 1;
}

.status-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px;
  border-radius: 12px;
  margin-bottom: 20px;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
}

.status-box.failed {
  background: rgba(255, 0, 0, 0.1);
  color: #ff4d4d;
}

.status-box.success {
  background: rgba(0, 255, 0, 0.1);
  color: #4df;
}

.note {
  font-size: 0.75rem;
  text-align: center;
  opacity: 0.4;
  margin-top: 20px;
}

.success-screen {
  text-align: center;
  padding: 60px 20px;
}

.success-icon {
  font-size: 6rem;
  color: #4df;
  margin-bottom: 20px;
}

.pulse {
  animation: pulse-animation 2s infinite;
}

@keyframes pulse-animation {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
