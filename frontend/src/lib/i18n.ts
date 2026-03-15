import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../../public/locales/en/common.json";
import es from "../../public/locales/es/common.json";
import enKyc from "../../public/locales/en/kyc.json";
import esKyc from "../../public/locales/es/kyc.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { common: en, kyc: enKyc },
    es: { common: es, kyc: esKyc },
  },
  lng: localStorage.getItem("language") || "es",
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: {
    // escapeValue: false is the react-i18next convention since React JSX auto-escapes.
    // SECURITY: Never use dangerouslySetInnerHTML with t() output containing user/AI data.
    escapeValue: false,
  },
});

export default i18n;
