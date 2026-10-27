<template>
  <ion-page class="nr-auth-page">
    <ion-content class="nr-auth-content" :fullscreen="true">
      <div class="nr-auth-shell">
        <div class="nr-auth-card">
          <!-- Logo -->
          <a href="/rooms" class="nr-auth-back">← Back to NexRooms</a>
          <div class="nr-auth-brand">
            <img src="/nexrooms-logo.png" class="nr-auth-logo" alt="NexRooms" />
            <span class="nr-auth-name">NexRooms</span>
          </div>
          <h1 class="nr-auth-title">{{ mode === 'login' ? 'Sign in' : 'Create account' }}</h1>
          <p class="nr-auth-sub">{{ mode === 'login' ? 'to access your rooms and scheduled talks' : 'to start hosting meetings on NexRooms' }}</p>

          <!-- Tabs -->
          <div class="nr-auth-tabs">
            <button class="nr-tab" :class="{ active: mode === 'login' }" @click="mode = 'login'; errorMessage = ''">Sign in</button>
            <button class="nr-tab" :class="{ active: mode === 'register' }" @click="mode = 'register'; errorMessage = ''">Register</button>
          </div>

          <!-- Error -->
          <p v-if="errorMessage" class="nr-auth-error">{{ errorMessage }}</p>

          <!-- LOGIN -->
          <form v-if="mode === 'login'" @submit.prevent="handleLogin" class="nr-form">
            <input v-model="loginForm.username" class="nr-input" type="text" placeholder="Username or email" required autocomplete="username" />
            <div class="nr-pw-wrap">
              <input v-model="loginForm.password" class="nr-input" :type="showPw ? 'text' : 'password'" placeholder="Password" required autocomplete="current-password" />
              <button type="button" class="nr-pw-toggle" @click="showPw = !showPw">{{ showPw ? 'Hide' : 'Show' }}</button>
            </div>
            <button type="submit" class="nr-btn nr-btn-primary" :disabled="loading">
              <span v-if="loading" class="nr-spinner"></span>
              <span v-else>Sign in</span>
            </button>
          </form>

          <!-- REGISTER -->
          <form v-else @submit.prevent="handleRegister" class="nr-form">
            <input v-model="regForm.first_name" class="nr-input" type="text" placeholder="First name" required />
            <input v-model="regForm.last_name"  class="nr-input" type="text" placeholder="Last name" required />
            <input v-model="regForm.username"   class="nr-input" type="text" placeholder="Username" required autocomplete="username" />
            <input v-model="regForm.email"      class="nr-input" type="email" placeholder="Email address" required autocomplete="email" />
            <div class="nr-pw-wrap">
              <input v-model="regForm.password" class="nr-input" :type="showPw ? 'text' : 'password'" placeholder="Password" required autocomplete="new-password" />
              <button type="button" class="nr-pw-toggle" @click="showPw = !showPw">{{ showPw ? 'Hide' : 'Show' }}</button>
            </div>
            <button type="submit" class="nr-btn nr-btn-primary" :disabled="loading">
              <span v-if="loading" class="nr-spinner"></span>
              <span v-else>Create account</span>
            </button>
          </form>

          <p class="nr-auth-footer">Powered by <a href="https://nexfi.org.uk" class="nr-link" target="_blank">NexFi</a></p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent } from '@ionic/vue';
import axios from 'axios';
import config from '@/config/index.js';

const API_URL = config.api.baseURL;
const router  = useRouter();

const mode         = ref('login');
const loading      = ref(false);
const showPw       = ref(false);
const errorMessage = ref('');

const loginForm = ref({ username: '', password: '' });
const regForm   = ref({ first_name: '', last_name: '', username: '', email: '', password: '' });

const saveAuth = (data) => {
  localStorage.setItem('token',      data.token     || '');
  localStorage.setItem('userId',     data.user_id   || data.id || '');
  localStorage.setItem('username',   data.username  || '');
  localStorage.setItem('userAvatar', data.avatar    || '');
  if (data.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.user.id)       localStorage.setItem('userId',   data.user.id);
    if (data.user.username) localStorage.setItem('username', data.user.username);
  }
};

const handleLogin = async () => {
  errorMessage.value = '';
  loading.value = true;
  try {
    const res = await axios.post(`${API_URL}/api/login`, {
      username: loginForm.value.username.trim(),
      password: loginForm.value.password
    });
    if (res.data?.success || res.data?.token || res.data?.user_id) {
      saveAuth(res.data);
      router.push('/rooms');
    } else {
      errorMessage.value = res.data?.message || 'Invalid username or password.';
    }
  } catch (err) {
    errorMessage.value = err.response?.data?.message || err.message || 'Login failed. Please try again.';
  } finally {
    loading.value = false;
  }
};

const handleRegister = async () => {
  errorMessage.value = '';
  loading.value = true;
  try {
    const res = await axios.post(`${API_URL}/api/register`, {
      first_name: regForm.value.first_name.trim(),
      last_name:  regForm.value.last_name.trim(),
      username:   regForm.value.username.trim(),
      email:      regForm.value.email.trim(),
      password:   regForm.value.password
    });
    if (res.data?.success || res.data?.token || res.data?.user_id) {
      saveAuth(res.data);
      router.push('/rooms');
    } else {
      errorMessage.value = res.data?.message || 'Registration failed.';
    }
  } catch (err) {
    errorMessage.value = err.response?.data?.message || err.message || 'Registration failed.';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.nr-auth-page,
.nr-auth-content {
  --background: #000000 !important;
  background-color: #000000 !important;
  color: #ffffff !important;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.nr-auth-shell {
  min-height: 100vh;
  min-height: 100dvh;
  background: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  box-sizing: border-box;
}

.nr-auth-card {
  width: 100%;
  max-width: 420px;
  background: #0a0a0a;
  border: 1px solid #1f1f1f;
  border-radius: 16px;
  padding: 36px 32px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
}

.nr-auth-back {
  font-size: 12px;
  color: #666666;
  text-decoration: none;
  margin-bottom: -6px;
}
.nr-auth-back:hover { color: #ffffff; }

.nr-auth-brand { display: flex; align-items: center; gap: 10px; }
.nr-auth-logo  { width: 36px; height: 36px; object-fit: contain; border-radius: 8px; border: 1px solid #222; }
.nr-auth-name  { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }

.nr-auth-title { font-size: 22px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: -0.5px; }
.nr-auth-sub   { font-size: 13px; color: #888888; margin: -8px 0 0; line-height: 1.5; }

/* TABS */
.nr-auth-tabs { display: flex; border: 1px solid #222; border-radius: 10px; overflow: hidden; background: #121212; }
.nr-tab {
  flex: 1;
  background: transparent;
  border: none;
  color: #888888;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.nr-tab.active { background: #ffffff; color: #000000; font-weight: 700; }

/* FORM */
.nr-form { display: flex; flex-direction: column; gap: 12px; }

.nr-input {
  width: 100%;
  box-sizing: border-box;
  background: #121212 !important;
  border: 1px solid #262626 !important;
  border-radius: 8px;
  color: #ffffff !important;
  font-family: inherit;
  font-size: 14px;
  padding: 12px 14px;
  outline: none;
  transition: border-color 0.15s;
  color-scheme: dark;
}
.nr-input:focus { border-color: #ffffff !important; }
.nr-input::placeholder { color: #555555; }

.nr-pw-wrap { position: relative; }
.nr-pw-wrap .nr-input { padding-right: 70px; }
.nr-pw-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #888888;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  padding: 0;
}
.nr-pw-toggle:hover { color: #ffffff; }

/* BUTTONS */
.nr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: 8px;
  padding: 13px 20px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.nr-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.nr-btn-primary { background: #ffffff !important; color: #000000 !important; width: 100%; }
.nr-btn-primary:not(:disabled):hover { background: #e0e0e0 !important; }

/* SPINNER */
.nr-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: #000000;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* MISC */
.nr-auth-error { font-size: 13px; color: #ffffff; background: #1a1a1a; border: 1px solid #333333; border-radius: 6px; padding: 10px 12px; margin: 0; }
.nr-auth-footer { font-size: 12px; color: #555555; text-align: center; margin: 4px 0 0; }
.nr-link { color: #888888; text-decoration: none; }
.nr-link:hover { color: #ffffff; }

@media (max-width: 480px) {
  .nr-auth-card { padding: 28px 20px 24px; }
}
</style>
