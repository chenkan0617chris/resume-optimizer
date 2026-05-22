// services/aiClient.js
// Thin dispatcher over the provider registry. Components / hooks call these
// functions; they look up the provider by id and delegate. Re-exports the
// typed error classes for callers that want to do `err instanceof XError`.

import { getProvider } from './providers/index.js';

export {
  InvalidApiKeyError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  ServerError,
  MalformedResponseError
} from './providers/shared.js';

function ensureProvider(providerId) {
  const p = getProvider(providerId);
  if (!p) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return p;
}

export async function analyze({ providerId, model, resumeMarkdown, jdText, apiKey, signal }) {
  const p = ensureProvider(providerId);
  return p.analyze({
    resumeMarkdown,
    jdText,
    apiKey,
    model: model || p.defaultModel,
    signal
  });
}

export async function rewrite({
  providerId,
  model,
  resumeMarkdown,
  jdText,
  apiKey,
  onChunk,
  signal
}) {
  const p = ensureProvider(providerId);
  return p.rewrite({
    resumeMarkdown,
    jdText,
    apiKey,
    model: model || p.defaultModel,
    onChunk,
    signal
  });
}
