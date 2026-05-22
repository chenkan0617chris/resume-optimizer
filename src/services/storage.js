// services/storage.js
// localStorage + sessionStorage wrappers per spec §6.1.
// All access wrapped in try/catch because storage can throw in private browsing,
// when quota is exceeded, or when third-party storage is blocked.

const LS_RESUME_KEY = 'ro.resume.structured';
const LS_UI_PREFS_KEY = 'ro.ui.prefs';
const SS_API_KEY = 'ro.apiKey';

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

// --- API key (sessionStorage) --------------------------------------------

export function saveApiKey(key) {
  if (!key) return false;
  return safeSet(sessionStorage, SS_API_KEY, String(key));
}

export function loadApiKey() {
  return safeGet(sessionStorage, SS_API_KEY);
}

export function clearApiKey() {
  return safeRemove(sessionStorage, SS_API_KEY);
}

// --- UI prefs (localStorage) ---------------------------------------------

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

// --- Boot-time aggregator ------------------------------------------------

export function initFromStorage() {
  return {
    resumeDraft: loadResumeDraft(),
    apiKey: loadApiKey(),
    uiPrefs: loadUiPrefs()
  };
}
