import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enTranslation from "@/shared/locales/en/translation.json";
import zhTranslation from "@/shared/locales/zh/translation.json";

const resources = {
  en: {
    translation: enTranslation,
  },
  zh: {
    translation: zhTranslation,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
