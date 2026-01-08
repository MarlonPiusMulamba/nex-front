<template>
  <ion-page>
    <ion-content :fullscreen="true" class="register-content">
      <div class="register-wrapper">
        <!-- Logo Section -->
        <div class="logo-section">
          <div class="logo-circle">
            <ion-icon :icon="flash" class="logo-icon"></ion-icon>
          </div>
          <h1 class="brand-name">Join NexFi</h1>
          <p class="tagline">Create your account</p>
        </div>

        <!-- Register Card -->
        <div class="register-card">
          <div class="card-header">
            <h2 class="card-title">Get started</h2>
            <p class="card-subtitle">Sign up to connect with others</p>
          </div>

          <form @submit.prevent="handleRegisterSubmit" class="register-form">
            <!-- Cover Photo Upload -->
            <div class="cover-upload-section" @click="$refs.coverInput.click()">
              <div class="cover-preview" :class="{ 'has-image': !!coverPreview }">
                <img 
                  v-if="coverPreview"
                  :src="coverPreview"
                  alt="Cover"
                />
                <div v-else class="cover-placeholder">
                  <span class="cover-label">Add a cover photo</span>
                  <span class="cover-sub">Make your profile stand out</span>
                </div>
                <div class="cover-gradient-overlay"></div>
              </div>
              <input
                type="file"
                ref="coverInput"
                accept="image/*"
                @change="onCoverChange"
                style="display: none"
              />
            </div>

            <!-- Profile Picture Upload -->
            <div class="profile-upload-section">
              <div class="avatar-upload" @click="$refs.fileInput.click()">
                <img 
                  v-if="profilePicPreview" 
                  :src="profilePicPreview" 
                  class="avatar-preview"
                  alt="Profile"
                />
                <div v-else class="avatar-placeholder">
                  <ion-icon :icon="camera" class="camera-icon"></ion-icon>
                  <span class="upload-text">Add photo</span>
                </div>
              </div>
              <input 
                type="file" 
                ref="fileInput"
                accept="image/*" 
                @change="onProfilePicChange"
                style="display: none"
              />
            </div>

            <!-- Name Inputs -->
            <div class="name-row">
              <div class="input-group half">
                <div class="input-wrapper">
                  <ion-input
                    v-model="firstName"
                    type="text"
                    placeholder="First name"
                    class="custom-input"
                    :clear-input="true"
                  ></ion-input>
                </div>
              </div>
              <div class="input-group half">
                <div class="input-wrapper">
                  <ion-input
                    v-model="lastName"
                    type="text"
                    placeholder="Last name"
                    class="custom-input"
                    :clear-input="true"
                  ></ion-input>
                </div>
              </div>
            </div>

            <!-- Username Input -->
            <div class="input-group">
              <div class="input-wrapper">
                <ion-icon :icon="personOutline" class="input-icon"></ion-icon>
                <ion-input
                  v-model="username"
                  type="text"
                  placeholder="Username (min 3 chars)"
                  class="custom-input"
                  :clear-input="true"
                ></ion-input>
              </div>
              <span v-if="usernameError" class="error-text">{{ usernameError }}</span>
            </div>

            <!-- Email Input -->
            <div class="input-group">
              <div class="input-wrapper">
                <ion-icon :icon="mailOutline" class="input-icon"></ion-icon>
                <ion-input
                  v-model="email"
                  type="email"
                  placeholder="Email address"
                  class="custom-input"
                  :clear-input="true"
                ></ion-input>
              </div>
              <span v-if="emailError" class="error-text">{{ emailError }}</span>
            </div>

            <!-- Password Input -->
            <div class="input-group">
              <div class="input-wrapper">
                <ion-icon :icon="lockClosedOutline" class="input-icon"></ion-icon>
                <ion-input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Password (min 6 chars)"
                  class="custom-input"
                ></ion-input>
                <ion-icon
                  :icon="showPassword ? eyeOffOutline : eyeOutline"
                  class="toggle-password"
                  @click="showPassword = !showPassword"
                ></ion-icon>
              </div>
              <span v-if="passwordError" class="error-text">{{ passwordError }}</span>
            </div>

            <!-- Confirm Password Input -->
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
              <span v-if="confirmPasswordError" class="error-text">{{ confirmPasswordError }}</span>
            </div>

            <!-- Date of Birth Input -->
            <div class="input-group">
              <div class="input-wrapper">
                <ion-icon :icon="calendarOutline" class="input-icon"></ion-icon>
                <ion-input
                  v-model="dob"
                  type="date"
                  placeholder="Date of Birth"
                  class="custom-input"
                ></ion-input>
              </div>
              <span v-if="dobError" class="error-text">{{ dobError }}</span>
            </div>

            <!-- Gender Selection -->
            <div class="input-group">
              <div class="gender-selector">
                <button
                  type="button"
                  :class="['gender-button', { active: gender === 'M' }]"
                  @click="gender = 'M'">
                  Male
                </button>
                <button
                  type="button"
                  :class="['gender-button', { active: gender === 'F' }]"
                  @click="gender = 'F'">
                  Female
                </button>
                <button
                  type="button"
                  :class="['gender-button', { active: gender === 'O' }]"
                  @click="gender = 'O'">
                  Other
                </button>
              </div>
              <span v-if="genderError" class="error-text">{{ genderError }}</span>
            </div>

            <!-- Register Button -->
            <ion-button
              expand="block"
              type="submit"
              class="register-button"
              :disabled="isRegistering || showOtpStep">
              <ion-spinner v-if="isRegistering" name="crescent"></ion-spinner>
              <span v-else>Continue</span>
            </ion-button>

            <!-- Login Link -->
            <div class="login-section">
              <p class="login-text">
                Already have an account?
                <a @click="$router.push('/login')" class="login-link">Sign in</a>
              </p>
            </div>
          </form>
        </div>

        <!-- Footer -->
        <div class="footer-section">
          <p class="footer-text">© 2025 NexFi. All rights reserved.</p>
        </div>
      </div>
    </ion-content>

    <!-- OTP Verification Sheet -->
    <ion-modal :is-open="showOtpStep" @did-dismiss="cancelOtp">
      <ion-content class="otp-content ion-padding">
        <div class="otp-card">
          <h2>Email verification</h2>
          <p>We have sent a 6‑digit code to <strong>{{ email }}</strong>. Enter it below to complete your registration.</p>
          <div class="otp-input-group">
            <ion-input
              v-model="otpCode"
              type="tel"
              maxlength="6"
              placeholder="Enter OTP"
              class="otp-input"
            ></ion-input>
          </div>
          <ion-button
            expand="block"
            class="register-button"
            :disabled="isVerifying || !otpCode"
            @click="confirmOtp">
            <ion-spinner v-if="isVerifying" name="crescent"></ion-spinner>
            <span v-else>Verify &amp; Create Account</span>
          </ion-button>
          <button class="otp-cancel" type="button" @click="cancelOtp">Cancel</button>
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
  IonModal
} from '@ionic/vue';
import {
  flash,
  personOutline,
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  calendarOutline,
  camera
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config/index.js';

export default {
  name: 'RegisterPage',
  components: {
    IonPage,
    IonContent,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner,
    IonModal
  },
  data() {
    return {
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      dob: '',
      gender: '',
      profilePic: null,
      profilePicPreview: '',
      coverPhoto: null,
      coverPreview: '',
      showPassword: false,
      showConfirmPassword: false,
      isRegistering: false,
      usernameError: '',
      emailError: '',
      passwordError: '',
      confirmPasswordError: '',
      dobError: '',
      genderError: '',
      API_URL: config.api.baseURL,
      flash,
      personOutline,
      mailOutline,
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      calendarOutline,
      camera,
      // OTP state
      showOtpStep: false,
      verificationId: null,
      otpCode: '',
      isVerifying: false
    };
  },
  methods: {
    onCoverChange(e) {
      const file = e.target.files[0];
      if (!file) {
        this.coverPhoto = null;
        this.coverPreview = '';
        return;
      }

      if (file.size > 8 * 1024 * 1024) {
        alert('Cover image must be less than 8MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        this.coverPreview = ev.target.result;
        this.coverPhoto = ev.target.result.split(',')[1];
      };
      reader.readAsDataURL(file);
    },
    onProfilePicChange(e) {
      const file = e.target.files[0];
      if (!file) {
        this.profilePic = null;
        this.profilePicPreview = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        this.profilePicPreview = ev.target.result;
        this.profilePic = ev.target.result.split(',')[1];
      };
      reader.readAsDataURL(file);
    },

    validateForm() {
      let isValid = true;

      if (!this.username || this.username.length < 3) {
        this.usernameError = 'Username must be at least 3 characters';
        isValid = false;
      } else {
        this.usernameError = '';
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!this.email || !emailRegex.test(this.email)) {
        this.emailError = 'Please enter a valid email';
        isValid = false;
      } else {
        this.emailError = '';
      }

      if (!this.password || this.password.length < 6) {
        this.passwordError = 'Password must be at least 6 characters';
        isValid = false;
      } else {
        this.passwordError = '';
      }

      if (this.password !== this.confirmPassword) {
        this.confirmPasswordError = 'Passwords do not match';
        isValid = false;
      } else {
        this.confirmPasswordError = '';
      }

      if (!this.dob) {
        this.dobError = 'Date of birth is required';
        isValid = false;
      } else {
        this.dobError = '';
      }

      if (!this.gender) {
        this.genderError = 'Please select a gender';
        isValid = false;
      } else {
        this.genderError = '';
      }

      return isValid;
    },

    async handleRegisterSubmit() {
      if (!this.validateForm()) {
        return;
      }

      this.isRegistering = true;

      try {
        const response = await axios.post(`${this.API_URL}/api/register/start`, {
          first_name: this.firstName,
          last_name: this.lastName,
          username: this.username,
          password: this.password,
          date_of_birth: this.dob,
          gender: this.gender,
          email: this.email,
          profile_pic: this.profilePic,
          cover_photo: this.coverPhoto
        });

        if (response.data.success) {
          this.verificationId = response.data.verification_id;
          this.showOtpStep = true;
        } else {
          alert(response.data.message || 'Failed to start registration');
        }
      } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed: ' + (error.response?.data?.message || error.message));
      } finally {
        this.isRegistering = false;
      }
    },

    async confirmOtp() {
      if (!this.verificationId || !this.otpCode) return;

      this.isVerifying = true;
      try {
        const res = await axios.post(`${this.API_URL}/api/register/confirm`, {
          verification_id: this.verificationId,
          otp: this.otpCode
        });

        if (res.data.success) {
          alert('Account created successfully! Please log in.');
          this.showOtpStep = false;
          this.$router.push('/login');
        } else {
          alert(res.data.message || 'Invalid verification code');
        }
      } catch (err) {
        console.error('OTP verify error:', err);
        alert('Failed to verify code. Please try again.');
      } finally {
        this.isVerifying = false;
      }
    },

    cancelOtp() {
      this.showOtpStep = false;
      this.verificationId = null;
      this.otpCode = '';
    }
  }
};
</script>

<style scoped>
.register-content {
  --background: #ffffff;
}

.register-wrapper {
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
  margin-bottom: 32px;
  animation: fadeInDown 0.6s ease-out;
}

.logo-circle {
  width: 70px;
  height: 70px;
  background: #000000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.logo-icon {
  font-size: 36px;
  color: #ffffff;
}

.brand-name {
  font-size: 32px;
  font-weight: 700;
  color: #000000;
  margin: 0;
  letter-spacing: -0.5px;
}

.tagline {
  font-size: 15px;
  color: #666666;
  margin: 6px 0 0;
  font-weight: 400;
}

/* Register Card */
.register-card {
  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border-radius: 24px;
  padding: 36px 28px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.12);
  border: 1px solid #e5e7eb;
  animation: fadeInUp 0.6s ease-out;
  max-height: 85vh;
  overflow-y: auto;
}

.card-header {
  text-align: center;
  margin-bottom: 24px;
}

.card-title {
  font-size: 26px;
  font-weight: 700;
  color: #000000;
  margin: 0 0 6px;
}

.card-subtitle {
  font-size: 14px;
  color: #666666;
  margin: 0;
}

/* Profile Upload */
.profile-upload-section {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.cover-upload-section {
  position: relative;
}

.cover-upload-section::after {
  content: 'Tap to add cover';
  position: absolute;
  bottom: 10px;
  right: 16px;
  background: rgba(15,23,42,0.9);
  color: #e5e7eb;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.cover-upload-section::after {
  box-shadow: 0 8px 24px rgba(15,23,42,0.6);
}

.cover-upload-section {
  width: 100%;
  border-radius: 18px;
  overflow: hidden;
  margin-bottom: 20px;
  cursor: pointer;
  position: relative;
  background: linear-gradient(135deg, #111827 0%, #020617 50%, #0f172a 100%);
}

.cover-preview {
  position: relative;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.02);
}

.cover-gradient-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top left, rgba(59,130,246,0.35), transparent 55%),
              radial-gradient(circle at bottom right, rgba(236,72,153,0.35), transparent 55%);
  mix-blend-mode: screen;
}

.cover-placeholder {
  position: relative;
  z-index: 1;
  text-align: center;
  color: #e5e7eb;
}

.cover-label {
  display: block;
  font-weight: 600;
  font-size: 14px;
}

.cover-sub {
  display: block;
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
}

.name-row {
  display: flex;
  gap: 12px;
  margin-bottom: 4px;
}

.input-group.half {
  flex: 1;
}

.avatar-upload {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 2px dashed #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  overflow: hidden;
  background: #f8f9fa;
}

.avatar-upload:hover {
  border-color: #000000;
  transform: scale(1.05);
}

.avatar-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.camera-icon {
  font-size: 28px;
  color: #4f46e5;
}

.upload-text {
  font-size: 11px;
  color: #4b5563;
}

.avatar-upload::after {
  content: 'Add avatar';
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #6b7280;
}

.register-button {
  --background: #111827;
  --background-hover: #000000;
  --border-radius: 999px;
  font-weight: 700;
  margin-top: 8px;
}

.otp-content {
  --background: rgba(0,0,0,0.65);
}

.otp-card {
  max-width: 420px;
  margin: 80px auto;
  background: #ffffff;
  border-radius: 20px;
  padding: 24px 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
}

.otp-card h2 {
  margin: 0 0 8px;
  font-size: 20px;
}

.otp-card p {
  margin: 0 0 20px;
  font-size: 14px;
  color: #4b5563;
}

.otp-input-group {
  margin-bottom: 16px;
}

.otp-input {
  --background: #f3f4f6;
  --border-radius: 12px;
  text-align: center;
  font-size: 20px;
  letter-spacing: 0.35em;
  padding-inline: 16px;
}

.otp-cancel {
  margin-top: 10px;
  width: 100%;
  background: transparent;
  border: none;
  color: #6b7280;
  font-size: 13px;
}

/* Form */
.register-form {
  width: 100%;
}

.input-group {
  margin-bottom: 16px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 0 14px;
  transition: all 0.3s ease;
  border: 2px solid #e5e7eb;
}

.input-wrapper:focus-within {
  background: #ffffff;
  border-color: #000000;
  box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.05);
}

.input-icon {
  font-size: 18px;
  color: #666666;
  margin-right: 10px;
}

.custom-input {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 14px;
  --padding-bottom: 14px;
  --background: transparent;
  --color: #000000;
  flex: 1;
  font-size: 14px;
}

.toggle-password {
  font-size: 18px;
  color: #666666;
  cursor: pointer;
  padding: 6px;
  margin-left: 6px;
  transition: color 0.3s ease;
}

.toggle-password:hover {
  color: #000000;
}

.error-text {
  font-size: 12px;
  color: #f4212e;
  margin-top: 4px;
  display: block;
}

/* Gender Selector */
.gender-selector {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.gender-button {
  padding: 12px;
  background: #f8f9fa;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #666666;
  cursor: pointer;
  transition: all 0.3s ease;
}

.gender-button:hover {
  background: #e5e7eb;
}

.gender-button.active {
  background: #000000;
  border-color: #000000;
  color: #ffffff;
}

/* Register Button */
.register-button {
  --background: #000000;
  --background-hover: #333333;
  --border-radius: 12px;
  --box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  height: 50px;
  font-size: 15px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.3px;
  margin: 20px 0 16px;
  transition: transform 0.2s ease;
}

.register-button:not([disabled]):hover {
  transform: translateY(-2px);
  --box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.register-button:not([disabled]):active {
  transform: translateY(0);
}

/* Login Section */
.login-section {
  text-align: center;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.login-text {
  font-size: 14px;
  color: #666666;
  margin: 0;
}

.login-link {
  color: #000000;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.3s ease;
}

.login-link:hover {
  opacity: 0.7;
}

/* Footer */
.footer-section {
  margin-top: 24px;
  animation: fadeIn 1s ease-out;
}

.footer-text {
  font-size: 12px;
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

/* Scrollbar */
.register-card::-webkit-scrollbar {
  width: 6px;
}

.register-card::-webkit-scrollbar-track {
  background: transparent;
}

.register-card::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

/* Responsive */
@media (max-width: 480px) {
  .register-card {
    padding: 28px 20px;
    border-radius: 20px;
  }

  .brand-name {
    font-size: 28px;
  }

  .card-title {
    font-size: 22px;
  }

  .input-group {
    margin-bottom: 14px;
  }

  .gender-selector {
    grid-template-columns: 1fr;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .register-content {
    --background: #000000;
  }

  .register-wrapper {
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

  .register-card {
    background: #1a1a1a;
    border-color: #333333;
  }

  .card-title {
    color: #ffffff;
  }

  .card-subtitle {
    color: #999999;
  }

  .avatar-upload {
    background: #2a2a2a;
    border-color: #333333;
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

  .gender-button {
    background: #2a2a2a;
    border-color: #333333;
    color: #999999;
  }

  .gender-button:hover {
    background: #333333;
  }

  .gender-button.active {
    background: #ffffff;
    border-color: #ffffff;
    color: #000000;
  }

  .register-button {
    --background: #ffffff;
    --background-hover: #e5e5e5;
    --color: #000000;
  }

  .login-section {
    border-top-color: #333333;
  }

  .login-text {
    color: #999999;
  }

  .login-link {
    color: #ffffff;
  }

  .footer-text {
    color: #666666;
  }
}
</style>