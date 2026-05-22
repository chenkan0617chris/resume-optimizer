// services/storage.js
// localStorage + sessionStorage wrappers per spec §6.1, extended for
// multi-provider API keys (Claude, OpenAI, DeepSeek).
//
// Storage keys:
//   ro.resume.structured            (localStorage)  resume form draft
//   ro.ui.prefs                     (localStorage)  { locale, template }
//   ro.activeProvider               (localStorage)  string
//   ro.providerModels               (localStorage)  JSON of {provider: model}
//   ro.apiKeys                      (sessionStorage) JSON of {provider: key}
//
// Per-provider key safety: keys live only in sessionStorage and are cleared
// on tab close, matching the original single-key behaviour.

import { PROVIDER_IDS, emptyApiKeys, getDefaultModels } from './providers/index.js';

const LS_RESUME_KEY = 'ro.resume.structured';
const LS_UI_PREFS_KEY = 'ro.ui.prefs';
const LS_ACTIVE_PROVIDER = 'ro.activeProvider';
const LS_PROVIDER_MODELS = 'ro.providerModels';
const SS_API_KEYS = 'ro.apiKeys';

// Legacy key from the single-provider era. Migrated into apiKeys.anthropic
// on first load so existing users don't have to re-enter their key.
const SS_LEGACY_API_KEY = 'ro.apiKey';

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function safeParse(json) {
  if (json == null) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// --- Resume draft (localStorage) -----------------------------------------

export function saveResumeDraft(structured) {
  if (structured == null) return false;
  try {
    return safeSet(localStorage, LS_RESUME_KEY, JSON.stringify(structured));
  } catch {
    return false;
  }
}

export function loadResumeDraft() {
  return safeParse(safeGet(localStorage, LS_RESUME_KEY));
}

// --- API keys (sessionStorage) ------------------------------------------

function sanitizeKeys(input) {
  const out = emptyApiKeys();
  if (input && typeof input === 'object') {
    for (const id of PROVIDER_IDS) {
      const v = input[id];
      if (typeof v === 'string' && v.trim()) {
        out[id] = v.trim();
      }
    }
  }
  return out;
}

export function saveApiKeys(keys) {
  const clean = sanitizeKeys(keys);
  try {
    return safeSet(sessionStorage, SS_API_KEYS, JSON.stringify(clean));
  } catch {
    return false;
  }
}

export function loadApiKeys() {
  const stored = safeParse(safeGet(sessionStorage, SS_API_KEYS));
  if (stored) return sanitizeKeys(stored);

  // Legacy migration: a string under the old SS_LEGACY_API_KEY is treated
  // as the Anthropic key, copied into the new dict, and the legacy slot
  // cleared.
  const legacy = safeGet(sessionStorage, SS_LEGACY_API_KEY);
  if (legacy && typeof legacy === 'string' && legacy.trim()) {
    const migrated = emptyApiKeys();
    migrated.anthropic = legacy.trim();
    saveApiKeys(migrated);
    safeRemove(sessionStorage, SS_LEGACY_API_KEY);
    return migrated;
  }
  return emptyApiKeys();
}

export function setProviderKeyStored(providerId, key) {
  const current = loadApiKeys();
  current[providerId] = typeof key === 'string' ? key.trim() : '';
  return saveApiKeys(current);
}

export function clearProviderKeyStored(providerId) {
  const current = loadApiKeys();
  current[providerId] = '';
  return saveApiKeys(current);
}

export function clearAllApiKeys() {
  return safeRemove(sessionStorage, SS_API_KEYS);
}

// --- Active provider (localStorage) -------------------------------------

export function saveActiveProvider(providerId) {
  if (!PROVIDER_IDS.includes(providerId)) return false;
  return safeSet(localStorage, LS_ACTIVE_PROVIDER, providerId);
}

export function loadActiveProvider() {
  const v = safeGet(localStorage, LS_ACTIVE_PROVIDER);
  return PROVIDER_IDS.includes(v) ? v : null;
}

// --- Provider models (localStorage) -------------------------------------

function sanitizeModels(input) {
  const defaults = getDefaultModels();
  if (!input || typeof input !== 'object') return defaults;
  const out = { ...defaults };
  for (const id of PROVIDER_IDS) {
    if (typeof input[id] === 'string' && input[id].trim()) {
      out[id] = input[id].trim();
    }
  }
  return out;
}

export function saveProviderModels(models) {
  const clean = sanitizeModels(models);
  try {
    return safeSet(localStorage, LS_PROVIDER_MODELS, JSON.stringify(clean));
  } catch {
    return false;
  }
}

export function loadProviderModels() {
  return sanitizeModels(safeParse(safeGet(localStorage, LS_PROVIDER_MODELS)));
}

// --- UI prefs (localStorage) --------------------------------------------

export function saveUiPrefs({ locale, template } = {}) {
  const existing = loadUiPrefs() || {};
  const merged = {
    ...existing,
    ...(locale !== undefined ? { locale } : {}),
    ...(template !== undefined ? { template } : {})
  };
  try {
    return safeSet(localStorage, LS_UI_PREFS_KEY, JSON.stringify(merged));
  } catch {
    return false;
  }
}

export function loadUiPrefs() {
  return safeParse(safeGet(localStorage, LS_UI_PREFS_KEY));
}

// --- Boot-time aggregator -----------------------------------------------

export function initFromStorage() {
  return {
    resumeDraft: loadResumeDraft(),
    apiKeys: loadApiKeys(),
    activeProvider: loadActiveProvider(),
    providerModels: loadProviderModels(),
    uiPrefs: loadUiPrefs()
  };
}
