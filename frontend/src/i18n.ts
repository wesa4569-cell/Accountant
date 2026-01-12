import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ar from './locales/ar.json';

const stored = localStorage.getItem('lang');
const fallback = stored || (navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en');

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: fallback,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export function setDocumentDirection(lang: string) {
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
}

setDocumentDirection(i18n.language);

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('lang', lng);
  setDocumentDirection(lng);
});

export default i18n;
