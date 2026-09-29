import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';
import as from './as.json';

const LANG_KEY = 'nwis_lang';

/** UI languages (Section 9: bilingual support). Labels are shown in their own script. */
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'as', label: 'অসমীয়া' },
];

function storedLanguage() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return LANGUAGES.some((l) => l.code === v) ? v : 'en';
  } catch {
    return 'en';
  }
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, as: { translation: as } },
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React escapes
  returnNull: false,
});

function applyLanguage(lng) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
  try {
    localStorage.setItem(LANG_KEY, lng);
  } catch {
    /* storage unavailable */
  }
}

applyLanguage(i18n.language);
i18n.on('languageChanged', applyLanguage);

export default i18n;
