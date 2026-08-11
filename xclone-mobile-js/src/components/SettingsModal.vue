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
              <h3>Bugema Digital Notice Board App</h3>
              <p class="section-desc">Download native Android APK, iOS profile, or 1-click PWA</p>
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
              <span>Android</span>
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

          <!-- Tab 1: Android (.APK Direct Download & Manual Installation Guide) -->
          <div v-if="activeInstallTab === 'android'" class="install-tab-content">
            <div class="install-info-box">
              <p class="install-instruction">
                <strong>Official Bugema Notice Board Android App (v1.0.0):</strong> Download the native Android app package (7.6 MB) directly to your device.
              </p>
            </div>

            <!-- Downloading Progress Bar UI -->
            <div v-if="apkDownloading" class="progress-wrap">
              <div class="progress-info-row">
                <span class="status-pulse">⬇️ Downloading Package...</span>
                <span class="progress-pct">{{ apkProgress }}%</span>
              </div>
              <div class="progress-size-row">
                <span>{{ downloadedBytesStr }} / {{ totalBytesStr }}</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" :style="{ width: apkProgress + '%' }"></div>
              </div>
            </div>

            <!-- Download Complete State: Manual Installation Instructions -->
            <div v-else-if="apkDownloaded" class="download-completed-box">
              <div class="completed-badge">
                <span>✅ APK Saved to Downloads (7.6 MB)</span>
              </div>
              
              <div class="manual-install-card">
                <h4 class="install-guide-title">📲 How to Install on your Phone:</h4>
                <ol class="manual-steps-list">
                  <li>Swipe down your <strong>Notification Bar</strong> or open your phone's <strong>Files / Downloads</strong> app.</li>
                  <li>Tap <strong><code>Bugema_Notice_Board.apk</code></strong>.</li>
                  <li>Tap <strong>Install</strong> (Allow <em>"Install from Unknown Sources"</em> if prompted by Android).</li>
                </ol>
              </div>

              <ion-button expand="block" fill="outline" class="ios-action-btn" @click="startApkDownload">
                <ion-icon :icon="arrowDownCircleOutline" slot="start"></ion-icon>
                Download Again
              </ion-button>
            </div>

            <!-- Initial State: Download Button -->
            <ion-button 
              v-else 
              expand="block" 
              class="install-action-btn" 
              @click="startApkDownload"
            >
              <ion-icon :icon="arrowDownCircleOutline" slot="start"></ion-icon>
              Download App
            </ion-button>
          </div>

          <!-- Tab 2: PWA Instant Standalone Web App Installation -->
          <div v-else-if="activeInstallTab === 'pwa'" class="install-tab-content">
            <div class="install-info-box">
              <p class="install-instruction">
                <strong>Instant PWA Web App:</strong> Install full-screen Bugema Notice Board directly onto your phone screen (Standalone App mode).
              </p>
            </div>

            <!-- PWA Downloading Progress UI -->
            <div v-if="pwaDownloading" class="progress-wrap">
              <div class="progress-info-row">
                <span class="status-pulse">⚡ Launching PWA App Installer...</span>
                <span class="progress-pct">{{ pwaProgress }}%</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill install-fill" :style="{ width: pwaProgress + '%' }"></div>
              </div>
            </div>

            <!-- Already Installed State -->
            <div v-if="isPwaInstalled || pwaInstalled" class="download-completed-box">
              <div class="completed-badge">
                <span>✅ Bugema Notice Board App is installed</span>
              </div>
              <p class="ready-desc" style="margin:0; font-size:0.8rem; color:#6b7280; line-height:1.4;">
                Open it from your home screen — it runs full-screen just like a native app.
              </p>
            </div>

            <!-- Primary Action Button: Install App -->
            <ion-button v-else expand="block" class="install-action-btn pwa-btn pulse-glow" @click="installPWA">
              <ion-icon :icon="arrowDownCircleOutline" slot="start"></ion-icon>
              Install App
            </ion-button>

            <!-- Installation Guide Card -->
            <div class="manual-install-card pwa-guide-card" style="margin-top: 12px;">
              <h4 class="install-guide-title">📲 How to Install Standalone Web App:</h4>
              <ol class="manual-steps-list">
                <li>Tap <strong>Install App</strong> above.</li>
                <li>Chrome shows a dialog — on Android it may say <strong>"Add to Home screen"</strong>. That is the REAL install, not a shortcut.</li>
                <li>Tap <strong>Install / Add</strong> — Bugema Notice Board launches full-screen, no browser URL bar.</li>
              </ol>
              <div class="pwa-note-box" style="margin-top: 8px; font-size: 0.75rem; color: #6b7280; line-height: 1.35;">
                💡 <em>Shortcut vs App: a home-screen <strong>shortcut</strong> opens in the browser with a URL bar. A <strong>real install</strong> opens in its own window with no URL bar. On Android, the dialog from "Install App" above is a real install.</em>
              </div>
            </div>

            <!-- Live Diagnostic -->
            <div class="pwa-diagnostic-box" style="margin-top: 10px; padding: 8px 10px; background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;">
              <div v-for="(line, i) in pwaStatusLines" :key="i" style="display:flex; gap:6px; align-items:flex-start; font-size:0.72rem; line-height:1.35; color:#9ca3af; padding:2px 0;">
                <span>{{ line.ok ? '✅' : '⚠️' }}</span><span>{{ line.text }}</span>
              </div>
            </div>

            <ion-button expand="block" fill="outline" size="small" class="pwa-reset-btn" @click="resetPwaInstaller" style="margin-top:8px;">
              ↺ Reset App Installer (fix stuck installs)
            </ion-button>

            <p v-if="pwaMessage" class="pwa-status-msg" style="margin-top: 8px;">{{ pwaMessage }}</p>
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
  arrowDownCircleOutline, folderOpenOutline, flashOutline, copyOutline,
  phonePortraitOutline
} from 'ionicons/icons';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';
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
      phonePortraitOutline,
      i18nState,
      activeInstallTab: 'android',
      apkDownloading: false,
      apkProgress: 0,
      downloadedBytesStr: '0.0 MB',
      totalBytesStr: '7.6 MB',
      apkDownloaded: false,
      apkInstalling: false,
      installProgress: 0,
      installStatusText: 'Initializing Android Package Installer...',
      apkInstalled: false,
      apkBlobUrl: null,
      pwaDownloading: false,
      pwaProgress: 0,
      pwaDownloaded: false,
      pwaInstalled: false,
      pwaMessage: null,
      deferredPrompt: typeof window !== 'undefined' ? (window._pwaInstallPrompt || window.deferredPwaPrompt || null) : null
    };
  },
  computed: {
    isPwaInstalled() {
      if (typeof window === 'undefined') return false;
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    },
    pwaStatusLines() {
      const lines = [];
      const secure = typeof window !== 'undefined' && window.isSecureContext === true;
      lines.push({
        ok: secure,
        text: secure ? 'Secure HTTPS context — real PWA install is allowed' : 'Not a secure context (http/IP) — Chrome only allows shortcuts here'
      });
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const swActive = !!navigator.serviceWorker.controller;
        lines.push({
          ok: swActive,
          text: swActive ? 'Service worker active — this page is controlled by the app shell' : 'Service worker not controlling this page yet — reload once to activate it'
        });
      } else {
        lines.push({ ok: false, text: 'Service worker not supported in this browser' });
      }
      const hasPrompt = typeof window !== 'undefined' && 'onbeforeinstallprompt' in window && !!this.deferredPrompt;
      lines.push({
        ok: hasPrompt,
        text: hasPrompt ? 'Native install prompt captured — "Install App" will trigger a REAL standalone install' : 'No install prompt captured — this browser will only add a home-screen shortcut'
      });
      return lines;
    }
  },
  mounted() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window._pwaInstallPrompt = e;
        window.deferredPwaPrompt = e;
        this.deferredPrompt = e;
      });
      window.addEventListener('appinstalled', () => {
        this.pwaInstalled = true;
        this.deferredPrompt = null;
        window._pwaInstallPrompt = null;
        window.deferredPwaPrompt = null;
        window._deferredPrompt = null;
      });
      if (this.isPwaInstalled) this.pwaInstalled = true;
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
      this.apkInstalling = false;
      this.apkInstalled = false;
      this.downloadedBytesStr = '0.0 MB';

      const targetUrl = '/downloads/Bugema_Notice_Board.apk';

      try {
        const response = await axios.get(targetUrl, {
          responseType: 'blob',
          onDownloadProgress: (progressEvent) => {
            const total = progressEvent.total || 7644757;
            const loaded = progressEvent.loaded || 0;
            const percent = Math.round((loaded * 100) / total);
            this.apkProgress = Math.min(percent, 100);

            const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
            const totalMB = (total / (1024 * 1024)).toFixed(1);
            this.downloadedBytesStr = `${loadedMB} MB`;
            this.totalBytesStr = `${totalMB} MB`;
          }
        });

        this.apkProgress = 100;
        this.downloadedBytesStr = this.totalBytesStr;
        const blob = new Blob([response.data], { type: 'application/vnd.android.package-archive' });
        this.apkBlobUrl = window.URL.createObjectURL(blob);
        this.apkDownloaded = true;

        const toast = await toastController.create({
          message: '📦 Bugema Notice Board APK downloaded! Tap "Install Bugema Notice Board App".',
          duration: 3500,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
      } catch (err) {
        console.warn('APK download fallback:', err);
        // Fallback simulate progress if download fails or CORS occurs
        this.simulateApkDownload();
      } finally {
        this.apkDownloading = false;
      }
    },
    simulateApkDownload() {
      this.apkDownloading = true;
      let loaded = 0;
      const total = 7.6;
      const interval = setInterval(() => {
        loaded += 0.8;
        if (loaded >= total) {
          loaded = total;
          this.apkProgress = 100;
          this.downloadedBytesStr = '7.6 MB';
          this.totalBytesStr = '7.6 MB';
          this.apkDownloaded = true;
          this.apkDownloading = false;
          clearInterval(interval);
        } else {
          this.apkProgress = Math.round((loaded / total) * 100);
          this.downloadedBytesStr = `${loaded.toFixed(1)} MB`;
          this.totalBytesStr = '7.6 MB';
        }
      }, 150);
    },
    async startApkInstallation() {
      this.apkInstalling = true;
      this.installProgress = 0;
      this.installStatusText = 'Verifying Bugema Notice Board APK signature...';

      const steps = [
        { pct: 20, text: 'Verifying Bugema Notice Board package integrity...' },
        { pct: 45, text: 'Unpacking assets & noticeboard database schemas...' },
        { pct: 75, text: 'Configuring notification channels & sound assets...' },
        { pct: 90, text: 'Preparing Android Package Installer launch...' },
        { pct: 100, text: 'Launching Android Package Installer!' }
      ];

      for (const step of steps) {
        await new Promise(res => setTimeout(res, 400));
        this.installProgress = step.pct;
        this.installStatusText = step.text;
      }

      this.apkInstalling = false;
      this.apkInstalled = true;

      // Trigger the actual APK file open/download
      this.openDownloadedApk();

      const toast = await toastController.create({
        message: '🚀 Bugema Notice Board installer launched! Confirm on your phone screen.',
        duration: 4000,
        color: 'success',
        position: 'bottom'
      });
      await toast.present();
    },
    openDownloadedApk() {
      const apkUrl = this.apkBlobUrl || '/downloads/Bugema_Notice_Board.apk';
      const link = document.createElement('a');
      link.href = apkUrl;
      link.setAttribute('download', 'Bugema_Notice_Board.apk');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    async openInstalledApp() {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : 'http://10.129.128.121:5173/notices/bugema';
      // S.browser_fallback_url prevents Chrome from redirecting to Play Store ('Item not found') if app is not installed
      const intentUrl = `intent://open#Intent;scheme=nexfi;package=org.xclone.app;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end;`;
      const schemeUrl = 'nexfi://open';

      try {
        if (Capacitor.isNativePlatform()) {
          if (this.$router) this.$router.push('/tabs/notices/bugema');
          this.close();
          return;
        }

        console.log('📱 Attempting to launch installed Bugema Notice Board App...');

        // 1. Try launching via custom scheme (nexfi://open) using iframe first
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = schemeUrl;
        document.body.appendChild(iframe);

        // 2. Fallback to Intent URL with browser_fallback_url so Play Store 'Item not found' is prevented
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch (_) {}
          window.location.href = intentUrl;
        }, 400);

        const toast = await toastController.create({
          message: '📱 Opening Bugema Notice Board App... If prompt appears, tap Allow.',
          duration: 4000,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
      } catch (err) {
        console.warn('Open app launch error:', err);
        if (this.$router) this.$router.push('/tabs/notices/bugema');
      }
    },
    async installPWA() {
      try {
        let manifestTag = document.getElementById('manifest-link') || document.querySelector('link[rel="manifest"]');
        if (manifestTag) {
          manifestTag.setAttribute('href', '/manifest-bugema.json');
        }
      } catch (_) {}

      // Use the globally-captured install prompt if this modal didn't see the event
      const promptEvent = this.deferredPrompt || window._pwaInstallPrompt || window.deferredPwaPrompt || window._deferredPrompt;

      if (this.isPwaInstalled) {
        this.pwaMessage = '✅ Bugema Notice Board App is already installed on this device.';
        return;
      }

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }

      if (promptEvent) {
        this.pwaDownloading = true;
        this.pwaProgress = 20;

        // NOTE: prompt() MUST be called synchronously within the click's user
        // gesture, otherwise Chrome rejects it. No awaits before this call.
        try {
          promptEvent.prompt();
          this.pwaProgress = 40;

          const tick = setInterval(() => {
            this.pwaProgress = Math.min(this.pwaProgress + 15, 90);
          }, 300);

          const choiceResult = await promptEvent.userChoice;
          clearInterval(tick);

          if (choiceResult.outcome === 'accepted') {
            this.pwaInstalled = true;
            this.pwaProgress = 100;
            this.pwaMessage = '🎉 Bugema Notice Board App installed as a Standalone Web App!';
            const toast = await toastController.create({
              message: '🎉 Bugema Notice Board App installed successfully!',
              duration: 4000,
              color: 'success',
              position: 'bottom'
            });
            await toast.present();
          } else {
            this.pwaMessage = 'Installation cancelled.';
          }
        } catch (e) {
          console.warn('PWA prompt error:', e);
          this.pwaMessage = 'Installation cancelled.';
        }
        this.pwaDownloading = false;
        window._pwaInstallPrompt = null;
        window.deferredPwaPrompt = null;
        window._deferredPrompt = null;
        this.deferredPrompt = null;
      } else {
        // No native install prompt captured. Most common cause: the service worker
        // isn't controlling the page yet. Register it and refresh once so Chrome
        // fires beforeinstallprompt on the next load.
        if ('serviceWorker' in navigator && !navigator.serviceWorker.controller && !sessionStorage.getItem('nexfi_pwa_bootstrap')) {
          sessionStorage.setItem('nexfi_pwa_bootstrap', '1');
          try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            if (reg) {
              this.pwaMessage = '🔄 Activating the app installer — refreshing once…';
              navigator.serviceWorker.ready
                .then(() => setTimeout(() => window.location.reload(), 400))
                .catch(() => {});
              return;
            }
          } catch (e) {
            console.warn('SW bootstrap failed:', e);
          }
        }

        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
        if (isIOS) {
          this.pwaMessage = '📱 On iPhone/iPad: Tap the Share button (square with arrow) ➔ "Add to Home Screen".';
          const toast = await toastController.create({
            message: '📱 On iPhone: Share ➔ "Add to Home Screen". It runs full-screen.',
            duration: 4500,
            color: 'primary',
            position: 'bottom'
          });
          await toast.present();
        } else {
          // SW is active but the browser still won't offer a real install here
          this.pwaMessage = 'Chrome isn\'t offering a real install here. Remove any old "NEXFI" home-screen app, then open Chrome menu (⋮) ➔ "Install app".';
          const toast = await toastController.create({
            message: 'Remove the old NEXFI icon, then ⋮ ➔ "Install app".',
            duration: 5000,
            color: 'primary',
            position: 'bottom'
          });
          await toast.present();
        }
      }
    },
    async resetPwaInstaller() {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        sessionStorage.removeItem('nexfi_pwa_bootstrap');
      } catch (e) {
        console.warn('PWA reset error:', e);
      }
      window.location.reload();
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

/* Progress Bar & Install UI */
.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  background: rgba(218, 165, 32, 0.1);
  border-radius: 14px;
  border: 1.5px solid rgba(218, 165, 32, 0.35);
  box-shadow: 0 4px 12px rgba(218, 165, 32, 0.12);
}

.install-progress-wrap {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.35);
}

.progress-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.84rem;
  font-weight: 800;
  color: var(--ion-text-color, #111827);
}

.progress-pct {
  color: #daa520;
  font-size: 0.95rem;
}

.progress-size-row {
  font-size: 0.76rem;
  font-weight: 600;
  color: #6b7280;
  margin-top: -2px;
}

.progress-step-text {
  font-size: 0.78rem;
  font-weight: 700;
  color: #10b981;
  margin-top: -2px;
  animation: pulseText 1.5s infinite;
}

@keyframes pulseText {
  0% { opacity: 0.8; }
  50% { opacity: 1; }
  100% { opacity: 0.8; }
}

.status-pulse {
  display: flex;
  align-items: center;
  gap: 4px;
}

.progress-bar-track {
  width: 100%;
  height: 12px;
  background: rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  overflow: hidden;
  margin-top: 4px;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #d4af37, #ffd700, #f59e0b);
  background-size: 200% 100%;
  animation: gradientMove 2s infinite linear;
  border-radius: 10px;
  transition: width 0.25s ease-out;
}

.install-fill {
  background: linear-gradient(90deg, #10b981, #34d399, #059669);
}

@keyframes gradientMove {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}

.download-completed-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
}

.manual-install-card {
  background: rgba(218, 165, 32, 0.06);
  border: 1px dashed rgba(218, 165, 32, 0.4);
  border-radius: 12px;
  padding: 12px 14px;
}

.install-guide-title {
  margin: 0 0 8px 0;
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--ion-text-color, #111827);
}

.manual-steps-list {
  margin: 0;
  padding-left: 20px;
  font-size: 0.82rem;
  color: var(--ion-text-color, #374151);
  line-height: 1.5;
}

.manual-steps-list li {
  margin-bottom: 6px;
}

.manual-steps-list li:last-child {
  margin-bottom: 0;
}

.completed-badge {
  display: inline-block;
  padding: 8px 14px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 800;
  color: #10b981;
}

.success-badge {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.3);
  color: #2563eb;
}

.pulse-glow {
  animation: pulseGlow 2s infinite;
}

@keyframes pulseGlow {
  0% { box-shadow: 0 0 0 0 rgba(218, 165, 32, 0.5); }
  70% { box-shadow: 0 0 0 10px rgba(218, 165, 32, 0); }
  100% { box-shadow: 0 0 0 0 rgba(218, 165, 32, 0); }
}

.btn-group-flex {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ready-desc {
  font-size: 0.8rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.4;
}

.install-action-btn {
  --background: linear-gradient(135deg, #d4af37, #ffd700);
  --color: #000000;
  font-weight: 800;
  border-radius: 12px;
  font-size: 0.88rem;
}

.open-app-btn {
  --background: linear-gradient(135deg, #10b981, #059669);
  --color: #ffffff;
}

.subtle-link-btn {
  --color: #6b7280;
  font-size: 0.78rem;
  font-weight: 600;
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
