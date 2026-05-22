// services/providers/deepseek.js
// DeepSeek provider. API is OpenAI-compatible at the wire level; only the
// base URL and model names differ.

import { makeOpenAICompatibleProvider } from './openaiCompatible.js';

const BASE = (typeof import.meta !== 'undefined' &&
  import.meta.env &&
  import.meta.env.VITE_DEEPSEEK_API_BASE) ||
  'https://api.deepseek.com';

export const { analyze, rewrite } = makeOpenAICompatibleProvider({
  baseUrl: BASE,
  chatPath: '/v1/chat/completions',
  // DeepSeek supports response_format: {type: 'json_object'} on deepseek-chat
  supportsJsonMode: true
});
