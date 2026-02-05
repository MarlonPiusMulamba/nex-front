<template>
  <ion-page>
    <ion-content :fullscreen="true" class="login-content">
      <div class="login-wrapper">
        <!-- Logo Section -->
        <div class="logo-section">
          <img src="/logo.png" alt="NexFi Logo" class="logo-image" />
          <h1 class="brand-name">NexFi</h1>
          <p class="tagline">Connect with the world</p>
        </div>

        <!-- Login Card -->
        <div class="login-card">
          <div class="card-header">
            <p class="card-subtitle">Sign in to continue</p>
          </div>

          <form @submit.prevent="login" class="login-form">
            <!-- Username Input -->
            <div class="input-group">
              <div class="input-wrapper">
                <ion-icon :icon="personOutline" class="input-icon"></ion-icon>
                <ion-input
                  v-model="username"
                  type="text"
                  placeholder="Username or Email"
                  class="custom-input"
                  :clear-input="true"
                ></ion-input>
              </div>
            </div>

            <!-- Password Input -->
            <div class="input-group">
              <div class="input-wrapper">
                <ion-icon :icon="lockClosedOutline" class="input-icon"></ion-icon>
                <ion-input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Password"
                  class="custom-input"
                ></ion-input>
                <ion-icon
                  :icon="showPassword ? eyeOffOutline : eyeOutline"
                  class="toggle-password"
                  @click="showPassword = !showPassword"
                ></ion-icon>
              </div>
            </div>

            <!-- Forgot Password -->
            <div class="forgot-password">
              <a @click="showForgotPasswordModal = true" class="forgot-link">Forgot password?</a>
            </div>

            <!-- Login Button -->
            <ion-button
              expand="block"
              type="submit"
              class="login-button"
              :disabled="isLoading"
            >
              <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
              <span v-else>Sign In</span>
            </ion-button>

            <!-- Divider -->
            <div class="divider">
              <span class="divider-text">or</span>
            </div>

            <!-- Social Login Buttons -->
            <!-- <div class="social-login">
              <ion-button fill="outline" class="social-button">
                <ion-icon :icon="logoGoogle" slot="start"></ion-icon>
                Google
              </ion-button>
              <ion-button fill="outline" class="social-button">
                <ion-icon :icon="logoApple" slot="start"></ion-icon>
                Apple
              </ion-button>
            </div> -->

            <!-- Signup Link -->
            <div class="signup-section">
              <p class="signup-text">
                Don't have an account?
                <a @click="$router.push('/register')" class="signup-link" style="color:#daa520; font-weight:700;">Sign up</a>
              </p>
            </div>
          </form>
        </div>

        <!-- Footer -->
        <div class="footer-section">
          <p class="footer-text">© 2026 NexFi. All rights reserved.</p>
        </div>
      </div>
    </ion-content>

    <!-- Forgot Password Modal -->
    <ion-modal :is-open="showForgotPasswordModal" @did-dismiss="closeForgotPasswordModal">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button @click="closeForgotPasswordModal">Cancel</ion-button>
          </ion-buttons>
          <ion-title>Reset Password</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <!-- Step 1: Email Input -->
        <div v-if="resetStep === 1" class="reset-step">
          <h2>Enter Your Email</h2>
          <p>We'll send you a 6-digit code to reset your password.</p>
          
          <div class="input-group">
            <div class="input-wrapper">
              <ion-icon :icon="mailOutline" class="input-icon"></ion-icon>
              <ion-input
                v-model="resetEmail"
                type="email"
                placeholder="Email address"
                class="custom-input"
                :clear-input="true"
              ></ion-input>
            </div>
          </div>

          <ion-button
            expand="block"
            @click="sendOTP"
            :disabled="isResetting || !resetEmail"
            class="reset-button"
          >
            <ion-spinner v-if="isResetting" name="crescent"></ion-spinner>
            <span v-else>Send Code</span>
          </ion-button>
        </div>

        <!-- Step 2: OTP Verification -->
        <div v-if="resetStep === 2" class="reset-step">
          <h2>Enter Verification Code</h2>
          <p>We sent a 6-digit code to <strong>{{ resetEmail }}</strong></p>
          
          <div class="input-group">
            <div class="input-wrapper">
              <ion-icon :icon="keyOutline" class="input-icon"></ion-icon>
              <ion-input
                v-model="resetOTP"
                type="text"
                inputmode="numeric"
                maxlength="6"
                placeholder="000000"
                class="custom-input otp-input"
              ></ion-input>
            </div>
          </div>

          <ion-button
            expand="block"
            @click="verifyOTP"
            :disabled="isResetting || resetOTP.length !== 6"
            class="reset-button"
          >
            <ion-spinner v-if="isResetting" name="crescent"></ion-spinner>
            <span v-else>Verify Code</span>
          </ion-button>

          <ion-button
            expand="block"
            fill="clear"
            @click="resetStep = 1; resetOTP = ''"
            class="back-button"
          >
            Back to Email
          </ion-button>
        </div>

        <!-- Step 3: New Password -->
        <div v-if="resetStep === 3" class="reset-step">
          <h2>Create New Password</h2>
          <p>Enter your new password below.</p>
          
          <div class="input-group">
            <div class="input-wrapper">
              <ion-icon :icon="lockClosedOutline" class="input-icon"></ion-icon>
              <ion-input
                v-model="newPassword"
                :type="showNewPassword ? 'text' : 'password'"
                placeholder="New password"
                class="custom-input"
              ></ion-input>
              <ion-icon
                :icon="showNewPassword ? eyeOffOutline : eyeOutline"
                class="toggle-password"
                @click="showNewPassword = !showNewPassword"
              ></ion-icon>
            </div>
          </div>

          <div class="input-group">
            <div class="input-wrapper">
              <ion-icon :icon="lockClosedOutline" class="input-icon"></ion-icon>
              <ion-input
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="Confirm password"
                class="custom-input"
              ></ion-input>
              <ion-icon
                :icon="showConfirmPassword ? eyeOffOutline : eyeOutline"
                class="toggle-password"
                @click="showConfirmPassword = !showConfirmPassword"
              ></ion-icon>
            </div>
          </div>

          <ion-button
            expand="block"
            @click="resetPassword"
            :disabled="isResetting || !newPassword || newPassword !== confirmPassword"
            class="reset-button"
          >
            <ion-spinner v-if="isResetting" name="crescent"></ion-spinner>
            <span v-else>Reset Password</span>
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script>

import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons
} from '@ionic/vue';
import {
  flash,
  personOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  logoGoogle,
  logoApple,
  mailOutline,
  keyOutline
} from 'ionicons/icons';
import api from '@/utils/api';

export default {
  name: 'LoginPage',
  components: {
    IonPage,
    IonContent,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons
  },
  async mounted() {
    console.log('Testing API connection...');
    try {
      const response = await api.get('/');
      console.log('✅ API connected:', response);
    } catch (error) {
      console.error('❌ API error:', error);
    }
  },
  data() {
    return {
      username: '',
      password: '',
      showPassword: false,
      isLoading: false,
      // Forgot password
      showForgotPasswordModal: false,
      resetStep: 1,
      resetEmail: '',
      resetOTP: '',
      newPassword: '',
      confirmPassword: '',
      showNewPassword: false,
      showConfirmPassword: false,
      isResetting: false,
      // Icons
      flash,
      personOutline,
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      logoGoogle,
      logoApple,
      mailOutline,
      keyOutline
    };
  },
  methods: {
    async login() {
      if (!this.username || !this.password) {
        this.showAlert('Please enter both username/email and password');
        return;
      }

      this.isLoading = true;

      try {
        const response = await api.post('/api/login', {
          username: this.username,
          password: this.password
        });

        if (response.success) {
          localStorage.setItem('userId', response.user_id);
          localStorage.setItem('username', response.username);
          
          this.showSuccess();
          
          // Redirect to home after successful login
          setTimeout(() => {
            this.$router.push('/tabs/feed');
          }, 1500);
        } else {
          this.showAlert(response.message || 'Login failed. Please try again.');
        }
      } catch (error) {
        console.error('Login error:', error);
        const status = error.response?.status;
        const serverMsg = error.response?.data?.message;
        const networkMsg = error.message;
        const baseUrl = api?.defaults?.baseURL;
        const pageOrigin = window.location.origin;
        const isNetworkError = !status && (networkMsg === 'Network Error' || String(networkMsg || '').toLowerCase().includes('network'));
        const msg =
          (serverMsg || (status ? `Request failed (${status})` : networkMsg) || 'An error occurred. Please try again later.') +
          `\n\nPage: ${pageOrigin}` +
          (baseUrl ? `\nAPI: ${baseUrl}` : '') +
          (isNetworkError ? '\n\nHint: this often means the browser blocked the request (CORS/preflight) or the backend is unreachable from this device.' : '');
        this.showAlert(msg);
      } finally {
        this.isLoading = false;
      }
    },

    showAlert(message) {
      alert(message);
    },

    showSuccess() {
      const button = document.querySelector('.login-button');
      if (button) {
        button.classList.add('success-animation');
      }
    },

    // Forgot Password Methods
    closeForgotPasswordModal() {
      this.showForgotPasswordModal = false;
      this.resetStep = 1;
      this.resetEmail = '';
      this.resetOTP = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.showNewPassword = false;
      this.showConfirmPassword = false;
    },

    async sendOTP() {
      if (!this.resetEmail) {
        this.showAlert('Please enter your email address');
        return;
      }

      this.isResetting = true;
      try {
        const response = await api.post('/api/auth/forgot-password', {
          email: this.resetEmail
        });

        if (response.success) {
          this.resetStep = 2;
          this.showAlert('A verification code has been sent to your email');
        } else {
          this.showAlert(response.message || 'Failed to send code');
        }
      } catch (error) {
        console.error('Send OTP error:', error);
        this.showAlert('Failed to send verification code. Please try again.');
      } finally {
        this.isResetting = false;
      }
    },

    async verifyOTP() {
      if (this.resetOTP.length !== 6) {
        this.showAlert('Please enter the 6-digit code');
        return;
      }

      this.isResetting = true;
      try {
        const response = await api.post('/api/auth/verify-otp', {
          email: this.resetEmail,
          otp: this.resetOTP
        });

        if (response.success) {
          this.resetStep = 3;
        } else {
          this.showAlert(response.message || 'Invalid or expired code');
        }
      } catch (error) {
        console.error('Verify OTP error:', error);
        this.showAlert(error.response?.data?.message || 'Invalid or expired code');
      } finally {
        this.isResetting = false;
      }
    },

    async resetPassword() {
      if (!this.newPassword || !this.confirmPassword) {
        this.showAlert('Please enter and confirm your new password');
        return;
      }

      if (this.newPassword !== this.confirmPassword) {
        this.showAlert('Passwords do not match');
        return;
      }

      if (this.newPassword.length < 6) {
        this.showAlert('Password must be at least 6 characters');
        return;
      }

      this.isResetting = true;
      try {
        const response = await api.post('/api/auth/reset-password', {
          email: this.resetEmail,
          otp: this.resetOTP,
          new_password: this.newPassword
        });

        if (response.success) {
          this.showAlert('Password reset successful! You can now login with your new password.');
          this.closeForgotPasswordModal();
        } else {
          this.showAlert(response.message || 'Failed to reset password');
        }
      } catch (error) {
        console.error('Reset password error:', error);
        this.showAlert(error.response?.data?.message || 'Failed to reset password. Please try again.');
      } finally {
        this.isResetting = false;
      }
    }
  }
};
</script>

<style scoped>
.login-content {
  --background: #ffffff;
}

.login-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: #ffffff;
}

/* Logo Section */
.logo-section {
  text-align: center;
  margin-bottom: 40px;
  animation: fadeInDown 0.6s ease-out;
}

.logo-image {
  width: 120px;
  height: 120px;
  margin: 0 auto 20px;
  display: block;
  object-fit: cover;
  border-radius: 50%;
  background: #fff;
  padding: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.brand-name {
  font-size: 36px;
  font-weight: 700;
  color: #000000;
  margin: 0;
  letter-spacing: -0.5px;
}

.tagline {
  font-size: 16px;
  color: #666666;
  margin: 8px 0 0;
  font-weight: 400;
}

/* Login Card */
.login-card {
  width: 100%;
  max-width: 440px;
  background: #ffffff;
  border-radius: 24px;
  padding: 40px 32px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.12);
  border: 1px solid #e5e7eb;
  animation: fadeInUp 0.6s ease-out;
}

.card-header {
  text-align: center;
  margin-bottom: 32px;
}

.card-title {
  font-size: 28px;
  font-weight: 700;
  color: #000000;
  margin: 0 0 8px;
}

.card-subtitle {
  font-size: 15px;
  color: #666666;
  margin: 0;
}

/* Form */
.login-form {
  width: 100%;
}

.input-group {
  margin-bottom: 20px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 0 16px;
  transition: all 0.3s ease;
  border: 2px solid #e5e7eb;
}

.input-wrapper:focus-within {
  background: #ffffff;
  border-color: #daa520;
  box-shadow: 0 0 0 4px rgba(218, 165, 32, 0.05);
}

.input-icon {
  font-size: 20px;
  color: #666666;
  margin-right: 12px;
}

.custom-input {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 16px;
  --padding-bottom: 16px;
  --background: transparent;
  --color: #000000;
  flex: 1;
  font-size: 15px;
}

.toggle-password {
  font-size: 20px;
  color: #666666;
  cursor: pointer;
  padding: 8px;
  margin-left: 8px;
  transition: color 0.3s ease;
}

.toggle-password:hover {
  color: #000000;
}

.forgot-password {
  text-align: right;
  margin-bottom: 24px;
}

.forgot-link {
  color: #000000;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.3s ease;
}

.forgot-link:hover {
  opacity: 0.7;
}

/* Login Button */
.login-button {
  --background: linear-gradient(135deg, #daa520 0%, #ffd700 100%);
  --background-hover: #ffd700;
  --border-radius: 12px;
  --box-shadow: 0 4px 12px rgba(218, 165, 32, 0.2);
  --color: #000;
  height: 52px;
  font-size: 16px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.3px;
  margin-bottom: 24px;
  transition: transform 0.2s ease;
}

.login-button:not([disabled]):hover {
  transform: translateY(-2px);
  --box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.login-button:not([disabled]):active {
  transform: translateY(0);
}

.login-button.success-animation {
  animation: successPulse 0.5s ease;
}

/* Divider */
.divider {
  position: relative;
  text-align: center;
  margin: 24px 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #e5e7eb;
}

.divider-text {
  position: relative;
  background: #ffffff;
  padding: 0 16px;
  color: #999999;
  font-size: 14px;
  font-weight: 500;
}

/* Social Login */
.social-login {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.social-button {
  --border-width: 2px;
  --border-color: #e5e7eb;
  --color: #000000;
  --border-radius: 12px;
  height: 48px;
  font-size: 14px;
  font-weight: 600;
  text-transform: none;
  transition: all 0.3s ease;
}

.social-button:hover {
  --border-color: #000000;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.social-button ion-icon {
  font-size: 20px;
}

/* Signup Section */
.signup-section {
  text-align: center;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.signup-text {
  font-size: 14px;
  color: #666666;
  margin: 0;
}

.signup-link {
  color: #daa520;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.3s ease;
}

.signup-link:hover {
  opacity: 0.7;
}

/* Footer */
.footer-section {
  margin-top: 32px;
  animation: fadeIn 1s ease-out;
}

.footer-text {
  font-size: 13px;
  color: #999999;
  text-align: center;
  margin: 0;
}

/* Animations */
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes successPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* Responsive Design */
@media (max-width: 480px) {
  .login-card {
    padding: 32px 24px;
    border-radius: 20px;
  }

  .brand-name {
    font-size: 32px;
  }

  .card-title {
    font-size: 24px;
  }

  .social-login {
    grid-template-columns: 1fr;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .login-content {
    --background: #000000;
  }

  .login-wrapper {
    background: #000000;
  }

  .logo-circle {
    background: #ffffff;
  }

  .logo-icon {
    color: #000000;
  }

  .brand-name {
    color: #ffffff;
  }

  .tagline {
    color: #999999;
  }

  .login-card {
    background: #1a1a1a;
    border-color: #333333;
  }

  .card-title {
    color: #ffffff;
  }

  .card-subtitle {
    color: #999999;
  }

  .input-wrapper {
    background: #2a2a2a;
    border-color: #333333;
  }

  .input-wrapper:focus-within {
    background: #1a1a1a;
    border-color: #ffffff;
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.05);
  }

  .custom-input {
    --color: #ffffff;
  }

  .input-icon {
    color: #999999;
  }

  .toggle-password {
    color: #999999;
  }

  .toggle-password:hover {
    color: #ffffff;
  }

  .forgot-link {
    color: #ffffff;
  }

  .login-button {
    --background: #ffffff;
    --background-hover: #e5e5e5;
    --color: #000000;
  }

  .divider::before {
    background: #333333;
  }

  .divider-text {
    background: #1a1a1a;
  }

  .social-button {
    --border-color: #333333;
    --color: #ffffff;
  }

  .social-button:hover {
    --border-color: #ffffff;
  }

  .signup-section {
    border-top-color: #333333;
  }

  .signup-text {
    color: #999999;
  }

  .signup-link {
    color: #ffffff;
  }

  .footer-text {
    color: #666666;
  }
}

/* Forgot Password Modal Styles */
.reset-step {
  max-width: 500px;
  margin: 0 auto;
}

.reset-step h2 {
  font-size: 24px;
  font-weight: 700;
  color: #000;
  margin: 0 0 12px;
  text-align: center;
}

.reset-step p {
  font-size: 15px;
  color: #666;
  margin: 0 0 32px;
  text-align: center;
}

.reset-button {
  --background: linear-gradient(135deg, #daa520 0%, #ffd700 100%);
  --background-hover: #ffd700;
  --border-radius: 12px;
  --box-shadow: 0 4px 12px rgba(218, 165, 32, 0.2);
  --color: #000;
  height: 52px;
  font-size: 16px;
  font-weight: 600;
  text-transform: none;
  margin-top: 8px;
}

.back-button {
  --color: #666;
  margin-top: 8px;
}

.otp-input {
  text-align: center;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 8px;
}

@media (prefers-color-scheme: dark) {
  .reset-step h2 {
    color: #fff;
  }
  
  .reset-step p {
    color: #999;
  }
}
</style>