// store/appStore.js
// Single Zustand store. State shape per spec §6, extended for the
// multi-provider settings layer (Claude / OpenAI / DeepSeek):
//
//   ui.apiKeys        { anthropic, openai, deepseek }
//   ui.activeProvider 'anthropic' | 'openai' | 'deepseek'
//   ui.providerModels { anthropic, openai, deepseek }
//
// Convenience: components should read the active key/model with the
// `selectActiveApiKey` and `selectActiveModel` helpers exported below.

import { create } from 'zustand';
import {
  setProviderKeyStored,
  clearProviderKeyStored,
  saveActiveProvider,
  saveProviderModels,
  saveUiPrefs as storageSaveUiPrefs
} from '../services/storage.js';
import {
  PROVIDER_IDS,
  emptyApiKeys,
  getDefaultModels,
  getProvider
} from '../services/providers/index.js';

// --- Default structured resume shape -------------------------------------

export function emptyStructuredResume() {
  return {
    basics: { name: '', email: '', phone: '', linkedin: '', location: '' },
    experience: [],
    education: [],
    skills: { technical: [], soft: [] },
    projects: [],
    certifications: []
  };
}

// --- Markdown serialization (form -> markdown) ---------------------------

function safeStr(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function joinDates(start, end) {
  const s = safeStr(start);
  const e = safeStr(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return `${s} – Present`;
  if (e) return e;
  return '';
}

function contactLine(basics = {}) {
  const parts = [
    safeStr(basics.email),
    safeStr(basics.phone),
    safeStr(basics.location),
    safeStr(basics.linkedin)
  ].filter(Boolean);
  return parts.join(' · ');
}

export function serializeResumeMarkdown(structured) {
  if (!structured || typeof structured !== 'object') return '';
  const out = [];
  const basics = structured.basics || {};

  const name = safeStr(basics.name);
  if (name) out.push(`# ${name}`);

  const contact = contactLine(basics);
  if (contact) {
    if (out.length) out.push('');
    out.push(contact);
  }

  const experience = Array.isArray(structured.experience) ? structured.experience : [];
  const expEntries = experience.filter(
    (e) => e && (safeStr(e.title) || safeStr(e.company) || (Array.isArray(e.bullets) && e.bullets.length))
  );
  if (expEntries.length) {
    out.push('', '## Experience');
    expEntries.forEach((e, i) => {
      const headerParts = [];
      const title = safeStr(e.title);
      const company = safeStr(e.company);
      const dates = joinDates(e.start, e.end);
      if (title) headerParts.push(`**${title}**`);
      if (company) headerParts.push(company);
      if (dates) headerParts.push(dates);
      if (i > 0) out.push('');
      if (headerParts.length) out.push(headerParts.join(' · '));
      const bullets = Array.isArray(e.bullets) ? e.bullets : [];
      bullets.map((b) => safeStr(b)).filter(Boolean).forEach((b) => out.push(`- ${b}`));
    });
  }

  const education = Array.isArray(structured.education) ? structured.education : [];
  const eduEntries = education.filter(
    (e) => e && (safeStr(e.school) || safeStr(e.degree) || safeStr(e.major))
  );
  if (eduEntries.length) {
    out.push('', '## Education');
    eduEntries.forEach((e, i) => {
      const degMajor = [safeStr(e.degree), safeStr(e.major)].filter(Boolean).join(', ');
      const headerParts = [];
      if (degMajor) headerParts.push(`**${degMajor}**`);
      const school = safeStr(e.school);
      if (school) headerParts.push(school);
      const dates = joinDates(e.start, e.end);
      if (dates) headerParts.push(dates);
      if (i > 0) out.push('');
      if (headerParts.length) out.push(headerParts.join(' · '));
      const gpa = safeStr(e.gpa);
      if (gpa) out.push(`- GPA: ${gpa}`);
    });
  }

  const skills = structured.skills || {};
  const tech = Array.isArray(skills.technical) ? skills.technical.map(safeStr).filter(Boolean) : [];
  const soft = Array.isArray(skills.soft) ? skills.soft.map(safeStr).filter(Boolean) : [];
  if (tech.length || soft.length) {
    out.push('', '## Skills');
    if (tech.length) out.push(`**Technical:** ${tech.join(', ')}`);
    if (soft.length) out.push(`**Soft:** ${soft.join(', ')}`);
  }

  const projects = Array.isArray(structured.projects) ? structured.projects : [];
  const projEntries = projects.filter((p) => p && (safeStr(p.name) || safeStr(p.description)));
  if (projEntries.length) {
    out.push('', '## Projects');
    projEntries.forEach((p, i) => {
      const name = safeStr(p.name);
      const link = safeStr(p.link);
      const desc = safeStr(p.description);
      const headerParts = [];
      if (name) headerParts.push(`**${name}**`);
      if (link) headerParts.push(link);
      if (i > 0) out.push('');
      if (headerParts.length) out.push(headerParts.join(' · '));
      if (desc) out.push(`- ${desc}`);
    });
  }

  const certs = Array.isArray(structured.certifications) ? structured.certifications : [];
  const certEntries = certs.filter((c) => c && (safeStr(c.name) || safeStr(c.issuer)));
  if (certEntries.length) {
    out.push('', '## Certifications');
    certEntries.forEach((c) => {
      const parts = [];
      const name = safeStr(c.name);
      const issuer = safeStr(c.issuer);
      const date = safeStr(c.date);
      if (name) parts.push(`**${name}**`);
      if (issuer) parts.push(issuer);
      if (date) parts.push(date);
      out.push(`- ${parts.join(' · ')}`);
    });
  }

  return out.join('\n').trim();
}

// --- Toast id helper -----------------------------------------------------

let toastCounter = 0;
function nextToastId() {
  toastCounter += 1;
  return `t_${Date.now()}_${toastCounter}`;
}

// --- Initial state -------------------------------------------------------

function initialState() {
  return {
    resume: {
      source: 'form',
      pdfText: null,
      structured: emptyStructuredResume(),
      markdown: ''
    },
    jd: { text: '', role: '', company: '' },
    analysis: { status: 'idle', data: null, error: null },
    rewrite: {
      status: 'idle',
      original: '',
      optimized: '',
      edited: null,
      error: null
    },
    ui: {
      apiKeys: emptyApiKeys(),
      activeProvider: PROVIDER_IDS[0],
      providerModels: getDefaultModels(),
      template: 'classic',
      locale: 'en',
      toasts: [],
      apiKeyModalOpen: false
    }
  };
}

// --- Selector helpers (for components that need derived values) ---------

export function selectActiveApiKey(state) {
  const id = state.ui.activeProvider;
  const k = state.ui.apiKeys?.[id];
  return typeof k === 'string' && k ? k : null;
}

export function selectActiveModel(state) {
  const id = state.ui.activeProvider;
  return state.ui.providerModels?.[id] || getProvider(id)?.defaultModel || '';
}

export function selectActiveProviderId(state) {
  return state.ui.activeProvider;
}

// --- Store ---------------------------------------------------------------

export const useAppStore = create((set, get) => ({
  ...initialState(),

  // -- Hydration from storage at boot -----------------------------------

  hydrate(initial = {}) {
    set((state) => {
      const next = { ...state };

      const draft = initial.resumeDraft;
      if (draft && typeof draft === 'object') {
        const merged = {
          ...emptyStructuredResume(),
          ...draft,
          basics: { ...emptyStructuredResume().basics, ...(draft.basics || {}) },
          skills: { ...emptyStructuredResume().skills, ...(draft.skills || {}) }
        };
        next.resume = {
          ...state.resume,
          source: 'form',
          structured: merged,
          markdown: serializeResumeMarkdown(merged)
        };
      }

      const uiPrefs = initial.uiPrefs || {};
      const apiKeys = { ...emptyApiKeys(), ...(initial.apiKeys || {}) };
      const providerModels = { ...getDefaultModels(), ...(initial.providerModels || {}) };
      const activeProvider = PROVIDER_IDS.includes(initial.activeProvider)
        ? initial.activeProvider
        : state.ui.activeProvider;

      next.ui = {
        ...state.ui,
        apiKeys,
        activeProvider,
        providerModels,
        locale: uiPrefs.locale || state.ui.locale,
        template: uiPrefs.template || state.ui.template
      };
      return next;
    });
  },

  // -- Resume actions ---------------------------------------------------

  setResume({ source, pdfText = null, structured = null, markdown = '' } = {}) {
    set((state) => ({
      resume: {
        source: source || state.resume.source,
        pdfText,
        structured: structured || emptyStructuredResume(),
        markdown: markdown || ''
      }
    }));
  },

  updateResumeForm(structured) {
    if (!structured || typeof structured !== 'object') return;
    const markdown = serializeResumeMarkdown(structured);
    set((state) => ({
      resume: { ...state.resume, source: 'form', structured, markdown }
    }));
  },

  // -- JD ---------------------------------------------------------------

  setJd({ text = '', role = '', company = '' } = {}) {
    set(() => ({ jd: { text, role, company } }));
  },

  // -- Analysis ---------------------------------------------------------

  setAnalysis(status, dataOrError = null) {
    set(() => {
      if (status === 'success') {
        return { analysis: { status: 'success', data: dataOrError, error: null } };
      }
      if (status === 'error') {
        const msg =
          dataOrError instanceof Error
            ? dataOrError.message
            : typeof dataOrError === 'string'
            ? dataOrError
            : 'Unknown error';
        return { analysis: { status: 'error', data: null, error: msg } };
      }
      if (status === 'loading') {
        return { analysis: { status: 'loading', data: null, error: null } };
      }
      return { analysis: { status: 'idle', data: null, error: null } };
    });
  },

  // -- Rewrite ----------------------------------------------------------

  startRewrite(originalMarkdown) {
    set(() => ({
      rewrite: {
        status: 'streaming',
        original: typeof originalMarkdown === 'string' ? originalMarkdown : '',
        optimized: '',
        edited: null,
        error: null
      }
    }));
  },

  setRewriteStatus(status, errorOrNull = null) {
    set((state) => {
      const msg =
        errorOrNull == null
          ? null
          : errorOrNull instanceof Error
          ? errorOrNull.message
          : typeof errorOrNull === 'string'
          ? errorOrNull
          : 'Unknown error';
      return { rewrite: { ...state.rewrite, status, error: msg } };
    });
  },

  appendRewriteChunk(chunk) {
    set((state) => ({
      rewrite: {
        ...state.rewrite,
        optimized: typeof chunk === 'string' ? chunk : state.rewrite.optimized
      }
    }));
  },

  setRewriteOptimized(text) {
    set((state) => ({
      rewrite: { ...state.rewrite, optimized: typeof text === 'string' ? text : '' }
    }));
  },

  setRewriteEdited(text) {
    set((state) => ({
      rewrite: { ...state.rewrite, edited: typeof text === 'string' ? text : null }
    }));
  },

  // -- Multi-provider API keys ------------------------------------------

  setProviderKey(providerId, key) {
    if (!PROVIDER_IDS.includes(providerId)) return;
    const trimmed = typeof key === 'string' ? key.trim() : '';
    setProviderKeyStored(providerId, trimmed);
    set((state) => ({
      ui: {
        ...state.ui,
        apiKeys: { ...state.ui.apiKeys, [providerId]: trimmed }
      }
    }));
  },

  clearProviderKey(providerId) {
    if (!PROVIDER_IDS.includes(providerId)) return;
    clearProviderKeyStored(providerId);
    set((state) => ({
      ui: { ...state.ui, apiKeys: { ...state.ui.apiKeys, [providerId]: '' } }
    }));
  },

  setActiveProvider(providerId) {
    if (!PROVIDER_IDS.includes(providerId)) return;
    saveActiveProvider(providerId);
    set((state) => ({ ui: { ...state.ui, activeProvider: providerId } }));
  },

  setProviderModel(providerId, modelId) {
    if (!PROVIDER_IDS.includes(providerId)) return;
    const trimmed = typeof modelId === 'string' ? modelId.trim() : '';
    if (!trimmed) return;
    set((state) => {
      const nextModels = { ...state.ui.providerModels, [providerId]: trimmed };
      saveProviderModels(nextModels);
      return { ui: { ...state.ui, providerModels: nextModels } };
    });
  },

  setApiKeyModalOpen(open) {
    set((state) => ({ ui: { ...state.ui, apiKeyModalOpen: !!open } }));
  },

  // -- UI prefs ---------------------------------------------------------

  setLocale(loc) {
    if (loc !== 'en' && loc !== 'zh') return;
    storageSaveUiPrefs({ locale: loc });
    set((state) => ({ ui: { ...state.ui, locale: loc } }));
  },

  setTemplate(t) {
    if (t !== 'classic' && t !== 'modern') return;
    storageSaveUiPrefs({ template: t });
    set((state) => ({ ui: { ...state.ui, template: t } }));
  },

  // -- Toasts -----------------------------------------------------------

  pushToast({ type = 'info', message = '', vars = undefined, id } = {}) {
    const validTypes = ['success', 'error', 'info', 'warning'];
    const finalType = validTypes.includes(type) ? type : 'info';
    const finalId = id || nextToastId();
    set((state) => ({
      ui: {
        ...state.ui,
        toasts: [...state.ui.toasts, { id: finalId, type: finalType, message, vars }]
      }
    }));
    return finalId;
  },

  dismissToast(id) {
    set((state) => ({
      ui: { ...state.ui, toasts: state.ui.toasts.filter((t) => t.id !== id) }
    }));
  }
}));
