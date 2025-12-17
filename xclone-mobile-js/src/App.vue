<template>
  <ion-app :class="theme">
    <ion-router-outlet />
  </ion-app>
</template>

<script>
import { IonApp, IonRouterOutlet } from '@ionic/vue';

export default {
  name: 'App',
  components: {
    IonApp,
    IonRouterOutlet
  },
  data() {
    return {
      theme: 'light'
    };
  },
  methods: {
    applyTheme(nextTheme) {
      const t = nextTheme === 'dark' ? 'dark' : 'light';
      this.theme = t;
      try {
        localStorage.setItem('theme', t);
      } catch (_) {}

      // Keep the root element in sync for :root.light / :root.dark CSS
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(t);

      window.dispatchEvent(new CustomEvent('themeChanged', { detail: t }));
    },
    toggleTheme() {
      this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
    }
  },
  mounted() {
    console.log('✅ App mounted successfully');
    console.log('Current route:', this.$router.currentRoute.value.path);

    // Default to light theme unless user explicitly chose dark before
    let saved = null;
    try {
      saved = localStorage.getItem('theme');
    } catch (_) {}
    this.applyTheme(saved === 'dark' ? 'dark' : 'light');
  },
  errorCaptured(err, instance, info) {
    console.error('❌ App Error:', err, info);
    alert(`Error: ${err.message}`);
    return false;
  }
};
</script>

<style>
:root.light {
  --ion-background-color: #ffffff;
  --ion-text-color: #000000;
  --ion-card-background: #f8f9fa;
  --ion-card-text: #000000;
  --ion-input-background: #ffffff;
  --ion-input-text: #000000;
  --ion-toolbar-background: #ffffff;
  --ion-toolbar-text: #000000;
  --ion-tab-bar-background: #ffffff;
  --ion-tab-bar-text: #555555;
  --ion-tab-bar-hover: #1a73e8;
  --ion-border-color: #e0e0e0;
  --ion-avatar-background: #c7c7c7;
}

:root.dark {
  --ion-background-color: #0b0f14;
  --ion-text-color: #e5e7eb;
  --ion-card-background: #111827;
  --ion-card-text: #e5e7eb;
  --ion-color-light: #111827;
  --ion-color-light-rgb: 17,24,39;
  --ion-color-medium: #9ca3af;
  --ion-color-medium-rgb: 156,163,175;
  --ion-input-background: #111827;
  --ion-input-text: #e5e7eb;
  --ion-toolbar-background: #0b0f14;
  --ion-toolbar-text: #e5e7eb;
  --ion-tab-bar-background: #0b0f14;
  --ion-tab-bar-text: #9ca3af;
  --ion-tab-bar-hover: #60a5fa;
  --ion-border-color: #1f2937;
  --ion-avatar-background: #374151;
}
</style>
