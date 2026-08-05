// 🌐 i18n.js — Language and UI Translations Dictionary for NexFi
import { reactive, watch } from 'vue';

const STORAGE_LANG_KEY = 'pref_lang';
const STORAGE_THEME_KEY = 'pref_theme';
const STORAGE_AUTO_TRANSLATE_KEY = 'pref_autotranslate';

const initialLang = localStorage.getItem(STORAGE_LANG_KEY) || 'en';
const initialTheme = localStorage.getItem(STORAGE_THEME_KEY) || 'light';
const initialAutoTranslate = localStorage.getItem(STORAGE_AUTO_TRANSLATE_KEY) === 'true';

export const i18nState = reactive({
  lang: initialLang, // 'en', 'sw', 'fr'
  theme: initialTheme, // 'light', 'dark'
  autoTranslate: initialAutoTranslate
});

// UI Dictionary for static strings
const dictionary = {
  en: {
    settings: 'Settings',
    appearance: 'Appearance',
    light_mode: 'Light Mode',
    dark_mode: 'Dark Mode',
    language: 'Language',
    select_language: 'Select Language',
    auto_translate_notices: 'Auto-Translate Notices',
    auto_translate_desc: 'Automatically translate notices to your chosen language on load.',
    departments: 'Departments',
    all_departments: 'All Departments',
    urgent_announcements: 'Urgent Announcements',
    urgent_tag: 'URGENT',
    pin_as_my_dept: '📌 Pin as My Dept',
    pinned: '📌 Pinned (Unpin)',
    pin_short: '📌 Pin',
    saved_short: '📌 Saved',
    read_more: 'Read More',
    show_less: 'Show Less',
    translate: '🌐 Translate',
    translating: '⏳ Translating...',
    show_original: '↩️ Original',
    no_notices: 'No notices found in this section.',
    posted_by: 'Posted by',
    close: 'Close',
    save: 'Save',
    all_members: 'All Members',
  },
  sw: {
    settings: 'Mipangilio',
    appearance: 'Muonekano',
    light_mode: 'Mwangaza',
    dark_mode: 'Kizingiti / Giza',
    language: 'Lugha',
    select_language: 'Chagua Lugha',
    auto_translate_notices: 'Tafsiri Matangazo Moja kwa Moja',
    auto_translate_desc: 'Tafsiri matangazo kiotomatiki kwenda lugha uliyochagua yakipakuliwa.',
    departments: 'Idara',
    all_departments: 'Idara Zote',
    urgent_announcements: 'Matangazo ya Haraka',
    urgent_tag: 'YAHARAKA',
    pin_as_my_dept: '📌 Weka kama Idara Yangu',
    pinned: '📌 Imewekwa (Ondoa)',
    pin_short: '📌 Weka',
    saved_short: '📌 Imewekwa',
    read_more: 'Soma Zaidi',
    show_less: 'Onyesha Chache',
    translate: '🌐 Tafsiri',
    translating: '⏳ Inatafsiri...',
    show_original: '↩️ Onyesha Asili',
    no_notices: 'Hakuna matangazo yaliyopatikana sehemu hii.',
    posted_by: 'Imetumwa na',
    close: 'Funga',
    save: 'Hifadhi',
    all_members: 'Wanachama Wote',
  },
  fr: {
    settings: 'Paramètres',
    appearance: 'Apparence',
    light_mode: 'Mode Clair',
    dark_mode: 'Mode Sombre',
    language: 'Langue',
    select_language: 'Choisir la langue',
    auto_translate_notices: 'Traduire Automatiquement les Annonces',
    auto_translate_desc: 'Traduire automatiquement les annonces dans la langue choisie.',
    departments: 'Départements',
    all_departments: 'Tous les Départements',
    urgent_announcements: 'Annonces Urgentes',
    urgent_tag: 'URGENT',
    pin_as_my_dept: '📌 Épingler mon Dép.',
    pinned: '📌 Épinglé (Détacher)',
    pin_short: '📌 Épingler',
    saved_short: '📌 Épinglé',
    read_more: 'Lire la Suite',
    show_less: 'Réduire',
    translate: '🌐 Traduire',
    translating: '⏳ Traduction...',
    show_original: '↩️ Texte original',
    no_notices: 'Aucune annonce trouvée dans cette section.',
    posted_by: 'Publié par',
    close: 'Fermer',
    save: 'Enregistrer',
    all_members: 'Tous les Membres',
  }
};

export function t(key) {
  const currentDict = dictionary[i18nState.lang] || dictionary.en;
  return currentDict[key] || dictionary.en[key] || key;
}

export function setLanguage(lang) {
  if (['en', 'sw', 'fr'].includes(lang)) {
    i18nState.lang = lang;
    localStorage.setItem(STORAGE_LANG_KEY, lang);
  }
}

export function setTheme(theme) {
  if (['light', 'dark'].includes(theme)) {
    i18nState.theme = theme;
    localStorage.setItem(STORAGE_THEME_KEY, theme);
    applyThemeToBody(theme);
  }
}

export function setAutoTranslate(val) {
  i18nState.autoTranslate = Boolean(val);
  localStorage.setItem(STORAGE_AUTO_TRANSLATE_KEY, String(Boolean(val)));
}

export function applyThemeToBody(theme) {
  const tVal = theme || i18nState.theme;
  if (tVal === 'dark') {
    document.body.classList.add('dark-theme', 'dark');
    document.body.classList.remove('light');
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.body.classList.remove('dark-theme', 'dark');
    document.body.classList.add('light');
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }
  try {
    localStorage.setItem(STORAGE_THEME_KEY, tVal);
    localStorage.setItem('theme', tVal);
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('themeChanged', { detail: tVal }));
}

// Initial theme apply
applyThemeToBody(initialTheme);
