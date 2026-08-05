// 🌐 translationService.js — Client-side translation helper with instant caching
import axios from 'axios';

const translationCache = reactiveCacheLoad();

function reactiveCacheLoad() {
  try {
    const raw = localStorage.getItem('notice_translation_cache');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveCache() {
  try {
    // Keep cache size bounded to last 500 items
    const keys = Object.keys(translationCache);
    if (keys.length > 500) {
      keys.slice(0, 100).forEach(k => delete translationCache[k]);
    }
    localStorage.setItem('notice_translation_cache', JSON.stringify(translationCache));
  } catch (e) {
    console.warn('Could not persist translation cache:', e);
  }
}

/**
 * Translates a given text string to target language ('en', 'sw', 'fr').
 * Returns the translated string.
 */
export async function translateText(text, targetLang = 'en') {
  if (!text || typeof text !== 'string' || !text.trim()) return text;
  if (!targetLang || targetLang === 'en') return text;

  const cleanText = text.trim();
  const cacheKey = `${targetLang}:${cleanText}`;

  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  try {
    // Primary: Google Translate GTX endpoint (Free, Fast, Client-side)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(cleanText)}`;
    const res = await axios.get(url, { timeout: 8000 });
    
    if (res.data && Array.isArray(res.data[0])) {
      const translatedParts = res.data[0].map(part => part[0] || '').join('');
      if (translatedParts) {
        translationCache[cacheKey] = translatedParts;
        saveCache();
        return translatedParts;
      }
    }
  } catch (err) {
    console.warn(`Primary Google GTX translation failed for lang '${targetLang}':`, err?.message || err);
  }

  try {
    // Secondary Fallback: MyMemory Free Translation API
    const fallbackUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=autodetect|${targetLang}`;
    const res2 = await axios.get(fallbackUrl, { timeout: 6000 });
    if (res2.data && res2.data.responseData && res2.data.responseData.translatedText) {
      const trans = res2.data.responseData.translatedText;
      translationCache[cacheKey] = trans;
      saveCache();
      return trans;
    }
  } catch (err2) {
    console.warn(`Fallback MyMemory translation failed for lang '${targetLang}':`, err2?.message || err2);
  }

  return text; // Fallback to original text if offline or API failure
}

/**
 * Translates an entire notice object (title and body).
 * Returns a new object with translated title and body.
 */
export async function translateNotice(notice, targetLang = 'en') {
  if (!notice || targetLang === 'en') {
    return {
      title: notice?.title || '',
      body: notice?.body || '',
      isTranslated: false,
      lang: 'en'
    };
  }

  const [translatedTitle, translatedBody] = await Promise.all([
    translateText(notice.title || '', targetLang),
    translateText(notice.body || '', targetLang)
  ]);

  return {
    title: translatedTitle,
    body: translatedBody,
    isTranslated: true,
    lang: targetLang
  };
}
