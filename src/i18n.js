import en from './locales/en.json';
import de from './locales/de.json';

const translations = {
    en,
    de
};

let currentLang = 'en';

/**
 * Initialize i18n with browser/device language
 */
export function initI18n() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0]; // Extract language code: 'en-US' -> 'en'

    if (translations[langCode]) {
        currentLang = langCode;
    }

    console.log(`[i18n] Initialized with language: ${currentLang} (browser: ${browserLang})`);
    return currentLang;
}

/**
 * Get current language
 */
export function getCurrentLang() {
    return currentLang;
}

/**
 * Set language manually
 * @param {string} lang - Language code (en, de, etc.)
 */
export function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        console.log(`[i18n] Language changed to: ${lang}`);
        return true;
    }
    console.warn(`[i18n] Language ${lang} not available`);
    return false;
}

/**
 * Translate a key with optional replacements
 * @param {string} key - Translation key (e.g., 'setup.title')
 * @param {object} replacements - Object with replacements (e.g., {url: 'https://example.com'})
 * @returns {string} - Translated string
 *
 * @example
 * t('setup.title') // "Connect to your Nuxbe ERP Server"
 * t('loading.openingServer', {url: 'https://example.com'}) // "Opening https://example.com..."
 */
export function t(key, replacements = {}) {
    const keys = key.split('.');
    let value = translations[currentLang];

    for (const k of keys) {
        if (value && typeof value === 'object') {
            value = value[k];
        } else {
            console.warn(`[i18n] Translation key not found: ${key}`);
            return key;
        }
    }

    if (typeof value !== 'string') {
        console.warn(`[i18n] Translation value is not a string: ${key}`);
        return key;
    }

    // Replace placeholders: {url}, {name}, etc.
    let result = value;
    for (const [placeholder, replacement] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), replacement);
    }

    return result;
}

/**
 * Update all elements with data-i18n attributes
 */
export function updateUI() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    console.log(`[i18n] UI updated with language: ${currentLang}`);
}

initI18n();
