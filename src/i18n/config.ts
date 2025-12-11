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
const savedLanguage = localStorage.getItem('language') || 'zh-TW';

void i18n.use(initReactI18next).init({
  resources,
  lng: savedLanguage,
  fallbackLng: 'zh-TW',
  interpolation: {
    escapeValue: false, // React already escapes values
  },
});

export default i18n;
