import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import zhTWTranslations from './locales/zh-TW.json';

const resources = {
  en: {
    translation: enTranslations,
  },
  'zh-TW': {
    translation: zhTWTranslations,
  },
};

// Get saved language from localStorage or default to English
const savedLanguage = localStorage.getItem('language');

// Check for language in URL params
const searchParams = new URLSearchParams(window.location.search);
const urlLang = searchParams.get('lang');

// Determine the initial language
let initialLanguage = 'zh-TW';
if (urlLang && ['en', 'zh-TW'].includes(urlLang)) {
  initialLanguage = urlLang;
  // Update localStorage if URL param is present and valid
  localStorage.setItem('language', urlLang);
} else if (savedLanguage) {
  initialLanguage = savedLanguage;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'zh-TW',
  interpolation: {
    escapeValue: false, // React already escapes values
  },
});

export default i18n;
