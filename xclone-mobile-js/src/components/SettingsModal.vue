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
  IonButton, IonIcon, IonToggle
} from '@ionic/vue';
import {
  settingsOutline, closeOutline, moonOutline, languageOutline,
  checkmarkCircle, colorWandOutline
} from 'ionicons/icons';
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
      i18nState
    };
  },
  methods: {
    t,
    close() {
      this.$emit('update:isOpen', false);
    },
    changeLang(lang) {
      setLanguage(lang);
      // Selecting a language other than English automatically turns on
      // notice translation, so notices switch immediately.
      if (lang !== 'en') {
        setAutoTranslate(true);
      }
    },
    changeTheme(theme) {
      setTheme(theme);
    },
    toggleAutoTrans(checked) {
      setAutoTranslate(checked);
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
</style>
