import { createI18n } from 'vue-i18n';
import en from './locales/en';
import zh from './locales/zh';

// check browser language
const browserLang = navigator.language.toLowerCase();
const defaultLocale = browserLang.startsWith('zh') ? 'zh' : 'en';

const i18n = createI18n({
    legacy: false, // use Composition API
    locale: defaultLocale,
    fallbackLocale: 'en',
    messages: {
        en,
        zh
    }
});

export default i18n;
