// services/providers/openai.js
// OpenAI Chat Completions provider. Uses response_format: json_object for
// analysis to get reliable JSON output.

import { makeOpenAICompatibleProvider } from './openaiCompatible.js';

const BASE = (typeof import.meta !== 'undefined' &&
  import.meta.env &&
  import.meta.env.VITE_OPENAI_API_BASE) ||
  'https://api.openai.com';

export const { analyze, rewrite } = makeOpenAICompatibleProvider({
  baseUrl: BASE,
  chatPath: '/v1/chat/completions',
  supportsJsonMode: true
});
