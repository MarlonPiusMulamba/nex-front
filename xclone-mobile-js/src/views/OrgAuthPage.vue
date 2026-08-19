<template>
  <ion-page>
    <ion-content class="org-auth-content">
      <div class="org-auth-container">

        <!-- Top Header Back Button -->
        <div class="top-nav-bar">
          <button class="back-link-btn" @click="goBackToBoard">
            <ion-icon :icon="chevronBackOutline"></ion-icon>
            <span>Back to {{ org ? org.name : 'Notice Board' }}</span>
          </button>
        </div>

        <!-- Main Auth Card -->
        <div class="org-auth-card">

          <!-- Loading state -->
          <div v-if="loadingOrg" class="org-loader">
            <ion-spinner name="crescent" color="warning"></ion-spinner>
            <p>Loading institutional portal...</p>
          </div>

          <template v-else>
            <!-- Organisation Branding Header -->
            <div class="org-brand-header">
              <div class="org-logo-wrapper">
                <img :src="org?.logo_url || defaultLogo" class="org-logo" />
                <div class="org-logo-glow"></div>
              </div>
              <h1 class="org-title">{{ org?.name || 'Digital Notice Board' }}</h1>
              <p class="org-subtitle" v-if="org?.official_domain">
                <ion-icon :icon="globeOutline"></ion-icon>
                {{ org.official_domain }}
              </p>
              <div class="org-portal-badge">
                <ion-icon :icon="shieldCheckmarkOutline"></ion-icon>
                Verified Official Portal
              </div>
            </div>

            <!-- Auth Mode Switcher Tabs -->
            <div class="auth-mode-tabs">
              <button 
                class="mode-tab" 
                :class="{ 'mode-tab--active': mode === 'login' }"
                @click="mode = 'login'"
              >
                Sign In
              </button>
              <button 
                class="mode-tab" 
                :class="{ 'mode-tab--active': mode === 'register' }"
                @click="mode = 'register'"
              >
                Create Account
              </button>
            </div>

            <!-- Form Error Alert -->
            <div v-if="errorMessage" class="auth-error-box">
              <ion-icon :icon="alertCircleOutline"></ion-icon>
              <span>{{ errorMessage }}</span>
            </div>

            <!-- LOGIN FORM -->
            <form v-if="mode === 'login'" @submit.prevent="handleLogin" class="auth-form">
              <div class="input-group">
                <label class="input-label">Username or Email</label>
                <div class="input-field-wrap">
                  <ion-icon :icon="personOutline" class="field-icon"></ion-icon>
                  <input 
                    v-model="loginForm.username" 
                    type="text" 
                    placeholder="Enter your username or email"
                    class="custom-input"
                    required
                  />
                </div>
              </div>

              <div class="input-group">
                <label class="input-label">Password</label>
                <div class="input-field-wrap">
                  <ion-icon :icon="lockClosedOutline" class="field-icon"></ion-icon>
                  <input 
                    v-model="loginForm.password" 
                    :type="showPassword ? 'text' : 'password'" 
                    placeholder="Enter your password"
                    class="custom-input"
                    required
                  />
                  <button type="button" class="eye-btn" @click="showPassword = !showPassword">
                    <ion-icon :icon="showPassword ? eyeOffOutline : eyeOutline"></ion-icon>
                  </button>
                </div>
              </div>

              <button type="submit" class="submit-btn" :disabled="submitting">
                <ion-spinner v-if="submitting" name="crescent"></ion-spinner>
                <span v-else>Sign In to Board</span>
              </button>
            </form>

            <!-- REGISTER FORM -->
            <form v-else @submit.prevent="handleRegister" class="auth-form">
              <div class="input-group">
                <label class="input-label">Username</label>
                <div class="input-field-wrap">
                  <ion-icon :icon="personOutline" class="field-icon"></ion-icon>
                  <input 
                    v-model="registerForm.username" 
                    type="text" 
                    placeholder="Choose a username"
                    class="custom-input"
                    required
                  />
                </div>
              </div>

              <div class="input-group">
                <label class="input-label">Email Address</label>
                <div class="input-field-wrap">
                  <ion-icon :icon="mailOutline" class="field-icon"></ion-icon>
                  <input 
                    v-model="registerForm.email" 
                    type="email" 
                    placeholder="student@bugemauniv.ac.ug"
                    class="custom-input"
                    required
                  />
                </div>
              </div>

              <div class="input-row">
                <div class="input-group">
                  <label class="input-label">First Name</label>
                  <div class="input-field-wrap">
                    <input 
                      v-model="registerForm.first_name" 
                      type="text" 
                      placeholder="First name"
                      class="custom-input"
                    />
                  </div>
                </div>
                <div class="input-group">
                  <label class="input-label">Last Name</label>
                  <div class="input-field-wrap">
                    <input 
                      v-model="registerForm.last_name" 
                      type="text" 
                      placeholder="Last name"
                      class="custom-input"
                    />
                  </div>
                </div>
              </div>

              <div class="input-group">
                <label class="input-label">Password</label>
                <div class="input-field-wrap">
                  <ion-icon :icon="lockClosedOutline" class="field-icon"></ion-icon>
                  <input 
                    v-model="registerForm.password" 
                    :type="showPassword ? 'text' : 'password'" 
                    placeholder="Create a strong password"
                    class="custom-input"
                    required
                  />
                  <button type="button" class="eye-btn" @click="showPassword = !showPassword">
                    <ion-icon :icon="showPassword ? eyeOffOutline : eyeOutline"></ion-icon>
                  </button>
                </div>
              </div>

              <button type="submit" class="submit-btn" :disabled="submitting">
                <ion-spinner v-if="submitting" name="crescent"></ion-spinner>
                <span v-else>Register & Access Board</span>
              </button>
            </form>

            <!-- Footer -->
            <div class="auth-footer-note">
              <p>Protected by <strong>{{ org?.name || 'Notice Board' }}</strong> Institutional Security</p>
            </div>
          </template>

        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script>
import { 
  IonPage, IonContent, IonSpinner, IonIcon, toastController
} from '@ionic/vue';
import { 
  personOutline, lockClosedOutline, mailOutline, globeOutline, 
  shieldCheckmarkOutline, alertCircleOutline, chevronBackOutline,
  eyeOutline, eyeOffOutline
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config';

export default {
  name: 'OrgAuthPage',
  components: {
    IonPage, IonContent, IonSpinner, IonIcon
  },
  data() {
    return {
      personOutline, lockClosedOutline, mailOutline, globeOutline,
      shieldCheckmarkOutline, alertCircleOutline, chevronBackOutline,
      eyeOutline, eyeOffOutline,
      slug: this.$route.params.slug || 'bugema',
      mode: this.$route.path.includes('/register') ? 'register' : 'login',
      org: null,
      loadingOrg: true,
      submitting: false,
      showPassword: false,
      errorMessage: '',
      loginForm: {
        username: '',
        password: ''
      },
      registerForm: {
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        password: ''
      },
      API_URL: config.api.baseURL,
      defaultLogo: 'https://images.unsplash.com/photo-1562564055-71e051d33c19?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80',
      originalFavicon: null,
      originalTitle: ''
    };
  },
  watch: {
    '$route.path'(newPath) {
      this.mode = newPath.includes('/register') ? 'register' : 'login';
    }
  },
  methods: {
    async fetchOrgDetails() {
      this.loadingOrg = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/boards/${this.slug}`);
        if (res.data.success) {
          this.org = res.data.org;
          this.updateDynamicFaviconAndTitle(this.org);
        }
      } catch (err) {
        console.error('Fetch org details error:', err);
      } finally {
        this.loadingOrg = false;
      }
    },
    updateDynamicFaviconAndTitle(org) {
      if (!org) return;
      // Store originals
      this.originalTitle = document.title;
      document.title = `${org.name} - Portal Access`;

      const logo = org.logo_url || this.defaultLogo;
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      this.originalFavicon = link.href;
      link.href = logo;
    },
    restoreFaviconAndTitle() {
      if (this.originalTitle) document.title = this.originalTitle;
      if (this.originalFavicon) {
        const link = document.querySelector("link[rel*='icon']");
        if (link) link.href = this.originalFavicon;
      }
    },
    goBackToBoard() {
      const isTabs = this.$route.path.includes('/tabs/');
      const targetPath = isTabs ? `/tabs/notices/${this.slug}` : `/notices/${this.slug}`;
      this.$router.replace(targetPath);
    },
    async handleLogin() {
      if (!this.loginForm.username || !this.loginForm.password) {
        this.errorMessage = 'Please enter both username/email and password.';
        return;
      }
      this.submitting = true;
      this.errorMessage = '';
      try {
        const res = await axios.post(`${this.API_URL}/api/login`, {
          username: this.loginForm.username,
          password: this.loginForm.password
        });
        if (res.data.success) {
          localStorage.setItem('userId', res.data.user_id);
          localStorage.setItem('username', res.data.username);
          
          const toast = await toastController.create({
            message: `Welcome to ${this.org?.name || 'Notice Board'}!`,
            duration: 2000,
            color: 'success',
            position: 'bottom'
          });
          await toast.present();
          this.goBackToBoard();
        } else {
          this.errorMessage = res.data.message || 'Login failed. Please verify credentials.';
        }
      } catch (err) {
        this.errorMessage = err.response?.data?.message || err.message || 'Unable to sign in. Please try again.';
      } finally {
        this.submitting = false;
      }
    },
    async handleRegister() {
      if (!this.registerForm.username || !this.registerForm.email || !this.registerForm.password) {
        this.errorMessage = 'Please fill in all required registration fields.';
        return;
      }
      this.submitting = true;
      this.errorMessage = '';
      try {
        const res = await axios.post(`${this.API_URL}/api/register`, {
          username: this.registerForm.username,
          email: this.registerForm.email,
          first_name: this.registerForm.first_name,
          last_name: this.registerForm.last_name,
          password: this.registerForm.password
        });
        if (res.data.success) {
          localStorage.setItem('userId', res.data.user_id);
          localStorage.setItem('username', res.data.username);

          // Auto-join board
          try {
            await axios.post(`${this.API_URL}/api/boards/${this.slug}/join`, {
              user_id: res.data.user_id
            });
          } catch (e) {
            console.warn('Auto join board error:', e);
          }

          const toast = await toastController.create({
            message: 'Account created successfully!',
            duration: 2000,
            color: 'success',
            position: 'bottom'
          });
          await toast.present();
          this.goBackToBoard();
        } else {
          this.errorMessage = res.data.message || 'Registration failed.';
        }
      } catch (err) {
        this.errorMessage = err.response?.data?.message || err.message || 'Registration failed.';
      } finally {
        this.submitting = false;
      }
    }
  },
  mounted() {
    this.fetchOrgDetails();
  },
  unmounted() {
    this.restoreFaviconAndTitle();
  }
};
</script>

<style scoped>
.org-auth-content {
  --background: #f4f5f7;
  font-family: Tahoma, 'Segoe UI', Geneva, Verdana, sans-serif !important;
}

.org-auth-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 16px;
  background: radial-gradient(circle at top, rgba(18, 8, 161, 0.08) 0%, rgba(244, 245, 247, 1) 70%);
}

.top-nav-bar {
  width: 100%;
  max-width: 440px;
  margin-bottom: 14px;
  display: flex;
}

.back-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 8px 14px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #1208a1;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  transition: all 0.2s;
}

.back-link-btn:hover {
  background: rgba(18, 8, 161,0.08);
}

.org-auth-card {
  width: 100%;
  max-width: 440px;
  background: #ffffff;
  border-radius: 24px;
  padding: 32px 28px;
  box-shadow: 0 10px 36px rgba(0, 0, 0, 0.06);
  border: 1.5px solid rgba(18, 8, 161, 0.15);
}

.org-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  gap: 12px;
  color: #888;
  font-size: 0.9rem;
}

.org-brand-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 24px;
}

.org-logo-wrapper {
  position: relative;
  width: 72px;
  height: 72px;
  margin-bottom: 14px;
}

.org-logo {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  object-fit: cover;
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  border: 2px solid rgba(18, 8, 161,0.3);
  background: #fff;
}

.org-title {
  font-size: 1.35rem;
  font-weight: 900;
  color: #1a1a1a;
  margin: 0 0 4px 0;
  letter-spacing: -0.3px;
}

.org-subtitle {
  font-size: 0.78rem;
  color: #1208a1;
  font-weight: 700;
  margin: 0 0 10px 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.org-portal-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(18, 8, 161, 0.08);
  color: #1208a1;
  font-size: 0.7rem;
  font-weight: 800;
  padding: 4px 12px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

/* Tabs */
.auth-mode-tabs {
  display: flex;
  background: #f3f4f6;
  padding: 4px;
  border-radius: 14px;
  margin-bottom: 22px;
}

.mode-tab {
  flex: 1;
  padding: 10px 0;
  border: none;
  background: transparent;
  font-size: 0.85rem;
  font-weight: 700;
  color: #666;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-tab--active {
  background: #ffffff;
  color: #1208a1;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

/* Error Box */
.auth-error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #dc2626;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 0.82rem;
  margin-bottom: 18px;
}

.auth-error-box ion-icon {
  font-size: 18px;
  flex-shrink: 0;
}

/* Form inputs */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-row {
  display: flex;
  gap: 10px;
}

.input-row .input-group {
  flex: 1;
}

.input-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #444;
}

.input-field-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: 14px;
  font-size: 18px;
  color: #1208a1;
  pointer-events: none;
}

.custom-input {
  width: 100%;
  height: 46px;
  padding: 0 14px 0 42px;
  border-radius: 12px;
  border: 1.5px solid rgba(0, 0, 0, 0.1);
  background: #fafafa;
  font-size: 0.88rem;
  color: #1a1a1a;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: Tahoma, 'Segoe UI', sans-serif;
}

.custom-input:focus {
  border-color: #1208a1;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(18, 8, 161, 0.15);
}

.eye-btn {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  color: #888;
  font-size: 18px;
  display: flex;
  align-items: center;
}

.submit-btn {
  width: 100%;
  height: 48px;
  border-radius: 14px;
  border: none;
  background: #1208a1;
  color: #000;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(18, 8, 161, 0.35);
  margin-top: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.submit-btn:hover {
  transform: translateY(-1px);
}

.auth-footer-note {
  margin-top: 24px;
  text-align: center;
  font-size: 0.72rem;
  color: #aaa;
  border-top: 1px dashed rgba(0,0,0,0.08);
  padding-top: 14px;
}
.auth-footer-note p { margin: 0; }
</style>
