// hooks/useI18n.js
// Returns a translator function `t(key, vars?) => string`.
// - Reads `ui.locale` from the Zustand store.
// - Resolves dotted keys against the active dictionary; falls back to EN; then to key.
// - Supports `{name}` style interpolation.

import { useCallback } from 'react';
import { useAppStore } from '../store/appStore.js';
import { dictionaries } from '../i18n/index.js';

function resolve(dict, key) {
  if (dict == null) return undefined;
  // Flat-key lookup first (our dictionaries are flat with dotted keys).
  if (Object.prototype.hasOwnProperty.call(dict, key)) {
    return dict[key];
  }
  // Defensive: also support nested objects.
  const parts = key.split('.');
  let cur = dict;
  for (const part of parts) {
    if (cur != null && typeof cur === 'object' && part in cur) {
      cur = cur[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(template, vars) {
  if (!vars || typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      const value = vars[name];
      return value == null ? '' : String(value);
    }
    return match;
  });
}

export function useI18n() {
  const locale = useAppStore((s) => s.ui.locale) || 'en';

  return useCallback(
    (key, vars) => {
      const active = dictionaries[locale] || dictionaries.en;
      let value = resolve(active, key);
      if (value === undefined && locale !== 'en') {
        value = resolve(dictionaries.en, key);
      }
      if (value === undefined) {
        return key;
      }
      return interpolate(value, vars);
    },
    [locale]
  );
}

export default useI18n;
