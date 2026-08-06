<template>
  <ion-modal :is-open="isOpen" @didDismiss="close" class="settings-modal">
    <ion-header>
      <ion-toolbar class="settings-toolbar">
        <ion-title class="settings-title">
          <ion-icon :icon="settingsOutline" class="header-icon"></ion-icon>
          <span>{{ t('settings') }}</span>
        </ion-title>
        <ion-buttons slot="end">
          <ion-button @click="close" class="close-btn">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="settings-content ion-padding">
      <div class="settings-container">
        
        <!-- 🎨 Appearance / Theme Section -->
        <div class="settings-card">
          <div class="card-header">
            <ion-icon :icon="moonOutline" class="section-icon"></ion-icon>
            <div>
              <h3>{{ t('appearance') }}</h3>
              <p class="section-desc">Switch between light and dark modes</p>
            </div>
          </div>
          
          <div class="theme-options-grid">
            <div 
              class="theme-chip" 
              :class="{ 'theme-chip--active': i18nState.theme === 'light' }"
              @click="changeTheme('light')"
            >
              <span class="chip-icon">☀️</span>
              <span class="chip-label">{{ t('light_mode') }}</span>
            </div>
            
            <div 
              class="theme-chip" 
              :class="{ 'theme-chip--active': i18nState.theme === 'dark' }"
              @click="changeTheme('dark')"
            >
              <span class="chip-icon">🌙</span>
              <span class="chip-label">{{ t('dark_mode') }}</span>
            </div>
          </div>
        </div>

        <!-- 🌐 Language Selection Section -->
        <div class="settings-card">
          <div class="card-header">
            <ion-icon :icon="languageOutline" class="section-icon"></ion-icon>
            <div>
              <h3>{{ t('language') }}</h3>
              <p class="section-desc">Choose your preferred language for the app & notices</p>
            </div>
          </div>

          <div class="lang-options-list">
            <div 
              class="lang-option-row"
              :class="{ 'lang-option--selected': i18nState.lang === 'en' }"
              @click="changeLang('en')"
            >
              <div class="lang-flag-box">🇬🇧</div>
              <div class="lang-details">
                <span class="lang-name">English</span>
                <span class="lang-sub">Default (English)</span>
              </div>
              <ion-icon v-if="i18nState.lang === 'en'" :icon="checkmarkCircle" class="check-icon"></ion-icon>
            </div>

            <div 
              class="lang-option-row"
              :class="{ 'lang-option--selected': i18nState.lang === 'sw' }"
              @click="changeLang('sw')"
            >
              <div class="lang-flag-box">🇰🇪</div>
              <div class="lang-details">
                <span class="lang-name">Kiswahili</span>
                <span class="lang-sub">Swahili</span>
              </div>
              <ion-icon v-if="i18nState.lang === 'sw'" :icon="checkmarkCircle" class="check-icon"></ion-icon>
            </div>

            <div 
              class="lang-option-row"
              :class="{ 'lang-option--selected': i18nState.lang === 'fr' }"
              @click="changeLang('fr')"
            >
              <div class="lang-flag-box">🇫🇷</div>
              <div class="lang-details">
                <span class="lang-name">Français</span>
                <span class="lang-sub">French</span>
              </div>
              <ion-icon v-if="i18nState.lang === 'fr'" :icon="checkmarkCircle" class="check-icon"></ion-icon>
            </div>
          </div>
        </div>

        <!-- 🤖 Auto-Translate Notices Switch -->
        <div class="settings-card">
          <div class="card-header">
            <ion-icon :icon="colorWandOutline" class="section-icon"></ion-icon>
            <div class="toggle-flex">
              <div>
                <h3>{{ t('auto_translate_notices') }}</h3>
                <p class="section-desc">{{ t('auto_translate_desc') }}</p>
              </div>
              <ion-toggle 
                :checked="i18nState.autoTranslate" 
                @ionChange="toggleAutoTrans($event.detail.checked)"
                color="warning"
              ></ion-toggle>
            </div>
          </div>
        </div>

        <!-- 📱 Install Mobile App Section -->
        <div class="settings-card install-card">
          <div class="card-header">
            <ion-icon :icon="downloadOutline" class="section-icon"></ion-icon>
            <div>
              <h3>Install NEXFI Mobile App</h3>
              <p class="section-desc">Download native APK, iOS profile, or 1-click PWA</p>
            </div>
          </div>

          <!-- Install Platform Selector Tabs -->
          <div class="install-tabs-grid">
            <button 
              class="install-tab" 
              :class="{ 'install-tab--active': activeInstallTab === 'android' }"
              @click="activeInstallTab = 'android'"
            >
              <span class="tab-emoji">🤖</span>
              <span>Android (.APK)</span>
            </button>

            <button 
              class="install-tab" 
              :class="{ 'install-tab--active': activeInstallTab === 'pwa' }"
              @click="activeInstallTab = 'pwa'"
            >
              <span class="tab-emoji">⚡</span>
              <span>PWA App</span>
            </button>

            <button 
              class="install-tab" 
              :class="{ 'install-tab--active': activeInstallTab === 'ios' }"
              @click="activeInstallTab = 'ios'"
            >
              <span class="tab-emoji">🍏</span>
              <span>iOS (iPhone)</span>
            </button>
          </div>

          <!-- Tab 1: Android (.APK Direct Download & Progress Bar) -->
          <div v-if="activeInstallTab === 'android'" class="install-tab-content">
            <div class="install-info-box">
              <p class="install-instruction">
                <strong>Direct Android Package:</strong> Download the official Bugema Digital Notice Board <code>.apk</code> installer directly to your Android device.
              </p>
            </div>

            <!-- Live Download Progress Bar -->
            <div v-if="apkDownloading" class="progress-wrap">
              <div class="progress-info-row">
                <span>Downloading APK...</span>
                <span>{{ apkProgress }}%</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" :style="{ width: apkProgress + '%' }"></div>
              </div>
            </div>

            <!-- Download Completed State -->
            <div v-else-if="apkDownloaded" class="download-completed-box">
              <span class="ready-badge">✅ APK Download Complete (100%)</span>
              <p class="ready-desc">Tap <strong>Open & Install APK</strong> below to trigger Android package installer on your phone!</p>
              <ion-button expand="block" class="install-action-btn" @click="openDownloadedApk">
                <ion-icon :icon="folderOpenOutline" slot="start"></ion-icon>
                Open & Install APK
              </ion-button>
            </div>

            <!-- Initial Download Action Button -->
            <ion-button 
              v-else 
              expand="block" 
              class="install-action-btn" 
              @click="startApkDownload"
            >
              <ion-icon :icon="arrowDownCircleOutline" slot="start"></ion-icon>
              Download & Install Android APK
            </ion-button>
          </div>

          <!-- Tab 2: PWA Instant Installation -->
          <div v-else-if="activeInstallTab === 'pwa'" class="install-tab-content">
            <div class="install-info-box">
              <p class="install-instruction">
                <strong>Instant PWA Installation:</strong> Install the full-screen Bugema Notice Board directly onto your phone or computer home screen without app stores!
              </p>
            </div>

            <ion-button expand="block" class="install-action-btn pwa-btn" @click="installPWA">
              <ion-icon :icon="flashOutline" slot="start"></ion-icon>
              1-Click Install PWA Web App
            </ion-button>

            <p v-if="pwaMessage" class="pwa-status-msg">{{ pwaMessage }}</p>
          </div>

          <!-- Tab 3: iOS Installation Instructions -->
          <div v-else-if="activeInstallTab === 'ios'" class="install-tab-content">
            <div class="install-info-box">
              <p class="install-instruction">
                <strong>iOS Home Screen App:</strong>
              </p>
              <ol class="ios-steps-list">
                <li>Open this site in <strong>Safari</strong> on your iPhone / iPad.</li>
                <li>Tap the <strong>Share</strong> button (bottom toolbar).</li>
                <li>Scroll down & tap <strong>Add to Home Screen ➕</strong>.</li>
              </ol>
            </div>

            <ion-button expand="block" fill="outline" class="ios-action-btn" @click="copyIosShareLink">
              <ion-icon :icon="copyOutline" slot="start"></ion-icon>
              Copy Link for Safari
            </ion-button>
          </div>
        </div>

        <div class="settings-footer-btn">
          <ion-button expand="block" class="done-btn" @click="close">
            {{ t('close') }}
          </ion-button>
        </div>

      </div>
    </ion-content>
  </ion-modal>
</template>

<script>
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonIcon, IonToggle, toastController
} from '@ionic/vue';
import {
  settingsOutline, closeOutline, moonOutline, languageOutline,
  checkmarkCircle, colorWandOutline, downloadOutline,
  arrowDownCircleOutline, folderOpenOutline, flashOutline, copyOutline
} from 'ionicons/icons';
import axios from 'axios';
import { i18nState, t, setLanguage, setTheme, setAutoTranslate } from '@/utils/i18n.js';

export default {
  name: 'SettingsModal',
  components: {
    IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonButton, IonIcon, IonToggle
  },
  props: {
    isOpen: { type: Boolean, default: false }
  },
  emits: ['update:isOpen'],
  data() {
    return {
      settingsOutline,
      closeOutline,
      moonOutline,
      languageOutline,
      checkmarkCircle,
      colorWandOutline,
      downloadOutline,
      arrowDownCircleOutline,
      folderOpenOutline,
      flashOutline,
      copyOutline,
      i18nState,
      activeInstallTab: 'android',
      apkDownloading: false,
      apkProgress: 0,
      apkDownloaded: false,
      apkBlobUrl: null,
      pwaMessage: null,
      deferredPrompt: typeof window !== 'undefined' ? (window.deferredPwaPrompt || null) : null
    };
  },
  mounted() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.deferredPwaPrompt = e;
        this.deferredPrompt = e;
      });
    }
  },
  methods: {
    t,
    close() {
      this.$emit('update:isOpen', false);
    },
    changeLang(lang) {
      setLanguage(lang);
      if (lang !== 'en') {
        setAutoTranslate(true);
      }
    },
    changeTheme(theme) {
      setTheme(theme);
    },
    toggleAutoTrans(checked) {
      setAutoTranslate(checked);
    },
    async startApkDownload() {
      this.apkDownloading = true;
      this.apkProgress = 0;
      this.apkDownloaded = false;

      try {
        const response = await axios.get('/downloads/nexfi-bugema.apk', {
          responseType: 'blob',
          onDownloadProgress: (progressEvent) => {
            const total = progressEvent.total || 500000;
            const percent = Math.round((progressEvent.loaded * 100) / total);
            this.apkProgress = Math.min(percent, 100);
          }
        });

        this.apkProgress = 100;
        const blob = new Blob([response.data], { type: 'application/vnd.android.package-archive' });
        this.apkBlobUrl = window.URL.createObjectURL(blob);
        this.apkDownloaded = true;

        const toast = await toastController.create({
          message: '📦 APK downloaded (100%)! Tap "Open & Install APK".',
          duration: 3000,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
      } catch (err) {
        console.warn('Apk download fallback:', err);
        this.openDownloadedApk();
      } finally {
        this.apkDownloading = false;
      }
    },
    openDownloadedApk() {
      const apkUrl = this.apkBlobUrl || '/downloads/nexfi-bugema.apk';
      const link = document.createElement('a');
      link.href = apkUrl;
      link.setAttribute('download', 'nexfi-bugema.apk');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    async installPWA() {
      const promptEvent = this.deferredPrompt || window.deferredPwaPrompt;
      if (promptEvent) {
        promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult.outcome === 'accepted') {
          this.pwaMessage = '🎉 PWA installed successfully on your home screen!';
        } else {
          this.pwaMessage = 'PWA installation cancelled.';
        }
        window.deferredPwaPrompt = null;
        this.deferredPrompt = null;
      } else {
        this.pwaMessage = '💡 To install PWA: Open browser menu (⋮ or Share) and select "Add to Home Screen" or "Install App".';
      }
    },
    async copyIosShareLink() {
      const currentUrl = window.location.origin + window.location.pathname;
      try {
        await navigator.clipboard.writeText(currentUrl);
        const toast = await toastController.create({
          message: '📋 Link copied! Open in Safari and tap Share ➔ Add to Home Screen.',
          duration: 3000,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
      } catch (e) {
        console.warn('Copy link error:', e);
      }
    }
  }
};
</script>

<style scoped>
.settings-toolbar {
  --background: #111827;
  --color: #ffffff;
}

.settings-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 800;
  color: #daa520;
}
.header-icon {
  font-size: 1.2rem;
  color: #daa520;
}

.close-btn {
  --color: #9ca3af;
  font-size: 1.3rem;
}

.settings-content {
  --background: var(--ion-background-color, #f9fafb);
}

.settings-container {
  max-width: 520px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
}

.settings-card {
  background: var(--ion-card-background, #ffffff);
  border: 1px solid rgba(218, 165, 32, 0.2);
  border-radius: 16px;
  padding: 16px 18px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.section-icon {
  font-size: 1.4rem;
  color: #daa520;
  margin-top: 2px;
  flex-shrink: 0;
}

.card-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--ion-text-color, #111827);
}

.section-desc {
  margin: 4px 0 0 0;
  font-size: 0.8rem;
  color: #6b7280;
}

/* Theme Chips */
.theme-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.theme-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 14px;
  background: rgba(218, 165, 32, 0.05);
  border: 1.5px solid rgba(218, 165, 32, 0.2);
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ion-text-color, #374151);
  transition: all 0.2s ease;
}

.theme-chip--active {
  background: rgba(218, 165, 32, 0.18);
  border-color: #daa520;
  color: #b38209;
  box-shadow: 0 2px 8px rgba(218, 165, 32, 0.2);
}

/* Language List */
.lang-options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lang-option-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1.5px solid rgba(218, 165, 32, 0.15);
  background: rgba(218, 165, 32, 0.03);
  cursor: pointer;
  transition: all 0.2s ease;
}

.lang-option--selected {
  border-color: #daa520;
  background: rgba(218, 165, 32, 0.12);
}

.lang-flag-box {
  font-size: 1.5rem;
}

.lang-details {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.lang-name {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--ion-text-color, #111827);
}

.lang-sub {
  font-size: 0.76rem;
  color: #6b7280;
}

.check-icon {
  font-size: 1.3rem;
  color: #daa520;
}

.toggle-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.done-btn {
  --background: #daa520;
  --color: #000000;
  font-weight: 800;
  border-radius: 12px;
  margin-top: 8px;
}

/* 📱 Install App Section Styles */
.install-card {
  border-color: rgba(218, 165, 32, 0.35);
  background: linear-gradient(180deg, rgba(218, 165, 32, 0.05) 0%, var(--ion-card-background, #ffffff) 100%);
}

.install-tabs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}

.install-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 12px;
  border: 1.5px solid rgba(218, 165, 32, 0.2);
  background: rgba(218, 165, 32, 0.05);
  color: var(--ion-text-color, #374151);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.install-tab--active {
  background: linear-gradient(135deg, #d4af37, #ffd700) !important;
  color: #000000 !important;
  border-color: transparent !important;
  font-weight: 800 !important;
  box-shadow: 0 3px 10px rgba(218, 165, 32, 0.3);
}

.tab-emoji {
  font-size: 1.2rem;
}

.install-tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.install-info-box {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 10px 14px;
}

.install-instruction {
  margin: 0;
  font-size: 0.82rem;
  color: var(--ion-text-color, #374151);
  line-height: 1.4;
}

/* Progress Bar */
.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  background: rgba(218, 165, 32, 0.08);
  border-radius: 12px;
  border: 1px solid rgba(218, 165, 32, 0.3);
}

.progress-info-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 700;
  color: #b38209;
}

.progress-bar-track {
  width: 100%;
  height: 10px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #d4af37, #ffd700);
  border-radius: 10px;
  transition: width 0.2s ease-out;
}

.download-completed-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: center;
}

.ready-badge {
  font-size: 0.85rem;
  font-weight: 800;
  color: #10b981;
}

.ready-desc {
  font-size: 0.78rem;
  color: #6b7280;
  margin: 0;
}

.install-action-btn {
  --background: linear-gradient(135deg, #d4af37, #ffd700);
  --color: #000000;
  font-weight: 800;
  border-radius: 12px;
  font-size: 0.88rem;
}

.ios-action-btn {
  --border-color: #daa520;
  --color: #daa520;
  font-weight: 700;
  border-radius: 12px;
}

.pwa-btn {
  --background: linear-gradient(135deg, #2563eb, #1d4ed8);
  --color: #ffffff;
}

.pwa-status-msg {
  font-size: 0.8rem;
  color: #b38209;
  margin: 4px 0 0 0;
  text-align: center;
  font-weight: 600;
}

.ios-steps-list {
  margin: 8px 0 0 0;
  padding-left: 20px;
  font-size: 0.8rem;
  color: var(--ion-text-color, #374151);
  line-height: 1.5;
}

body.dark .install-card {
  background: linear-gradient(180deg, rgba(218, 165, 32, 0.1) 0%, #16181c 100%) !important;
}

body.dark .install-info-box {
  background: rgba(255, 255, 255, 0.04) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}
</style>
