// services/providers/index.js
// Registry of supported AI providers. Add a new provider in three steps:
//   1. Write src/services/providers/<id>.js exporting { analyze, rewrite }
//   2. Import it here
//   3. Add an entry to PROVIDERS

import * as anthropic from './anthropic.js';
import * as openai from './openai.js';
import * as deepseek from './deepseek.js';

/**
 * Provider metadata + implementations.
 *
 * Each entry exposes:
 *   - id:            stable string identifier (used in storage keys and the store)
 *   - name:          display name
 *   - shortName:     compact label for the header badge
 *   - keyPrefix:     expected key prefix (used by the validator)
 *   - keyPlaceholder: example key shown in the input
 *   - consoleUrl:    where the user gets a key
 *   - models:        [{ id, label }] - first entry is the default
 *   - defaultModel:  shorthand for models[0].id
 *   - validate(key): returns null if ok, or an i18n key for the error
 *   - analyze, rewrite: provider implementations
 */
export const PROVIDERS = {
  anthropic: {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    shortName: 'Claude',
    keyPrefix: 'sk-ant-',
    keyPlaceholder: 'sk-ant-...',
    consoleUrl: 'https://console.anthropic.com/',
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (balanced)' },
      { id: 'claude-opus-4-7', label: 'Claude Opus 4.7 (highest quality)' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fastest)' }
    ],
    defaultModel: 'claude-sonnet-4-6',
    validate(key) {
      const k = (key ?? '').trim();
      if (!k) return 'providers.validate.empty';
      if (!k.startsWith('sk-ant-')) return 'providers.validate.anthropicPrefix';
      return null;
    },
    analyze: anthropic.analyze,
    rewrite: anthropic.rewrite
  },

  openai: {
    id: 'openai',
    name: 'OpenAI',
    shortName: 'OpenAI',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-...',
    consoleUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o (balanced)' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini (fastest)' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
    ],
    defaultModel: 'gpt-4o',
    validate(key) {
      const k = (key ?? '').trim();
      if (!k) return 'providers.validate.empty';
      if (!k.startsWith('sk-')) return 'providers.validate.openaiPrefix';
      if (k.length < 20) return 'providers.validate.tooShort';
      return null;
    },
    analyze: openai.analyze,
    rewrite: openai.rewrite
  },

  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-...',
    consoleUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat (general)' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (reasoning)' },
      { id: 'deepseek-v3-0324', label: 'DeepSeek V3 0324' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' }
    ],
    defaultModel: 'deepseek-chat',
    validate(key) {
      const k = (key ?? '').trim();
      if (!k) return 'providers.validate.empty';
      if (!k.startsWith('sk-')) return 'providers.validate.openaiPrefix';
      if (k.length < 20) return 'providers.validate.tooShort';
      return null;
    },
    analyze: deepseek.analyze,
    rewrite: deepseek.rewrite
  }
};

export const PROVIDER_IDS = ['anthropic', 'openai', 'deepseek'];

export function getProvider(id) {
  return PROVIDERS[id] || null;
}

export function getDefaultModels() {
  const out = {};
  for (const id of PROVIDER_IDS) {
    out[id] = PROVIDERS[id].defaultModel;
  }
  return out;
}

export function emptyApiKeys() {
  const out = {};
  for (const id of PROVIDER_IDS) {
    out[id] = '';
  }
  return out;
}
