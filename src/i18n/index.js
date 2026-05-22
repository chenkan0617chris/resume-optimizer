// i18n/index.js
// Loads EN and ZH dictionaries and exposes them along with locale detection.

import en from './en.json';
import zh from './zh.json';

export const dictionaries = { en, zh };

/**
 * Returns the default locale by inspecting `navigator.language`.
 * Any value starting with `zh` (e.g. zh-CN, zh-TW, zh-Hans) maps to 'zh'.
 * Otherwise falls back to 'en'.
 */
export function defaultLocale() {
  if (typeof navigator === 'undefined' || !navigator.language) {
    return 'en';
  }
  const lang = String(navigator.language).toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  return 'en';
}
