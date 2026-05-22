// services/providers/anthropic.js
// Anthropic Messages API provider. SSE format: content_block_delta events
// carry { delta: { text } } pieces; message_stop ends the stream.

import { buildAnalyzePrompt } from '../../prompts/analyzePrompt.js';
import { buildRewritePrompt } from '../../prompts/rewritePrompt.js';
import {
  fetchWithTimeout,
  classifyHttpError,
  parseAnalysisJson,
  MalformedResponseError,
  NetworkError,
  ServerError
} from './shared.js';

const DEFAULT_BASE = 'https://api.anthropic.com';
const API_BASE =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_ANTHROPIC_API_BASE) ||
  DEFAULT_BASE;
const ENDPOINT = `${API_BASE.replace(/\/$/, '')}/v1/messages`;

const TIMEOUT_ANALYZE_MS = 30_000;
const TIMEOUT_REWRITE_MS = 60_000;
const MAX_TOKENS_ANALYZE = 2048;
const MAX_TOKENS_REWRITE = 4096;

function buildHeaders(apiKey) {
  const isDirect = API_BASE === DEFAULT_BASE;
  return {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    ...(isDirect && {
      'x-api-key': apiKey,
      'anthropic-dangerous-direct-browser-calls': 'true'
    })
  };
}

function extractMessageText(json) {
  if (!json || !Array.isArray(json.content)) return '';
  return json.content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
}

export async function analyze({ resumeMarkdown, jdText, apiKey, model, signal }) {
  const callOnce = async (retryHint) => {
    const body = {
      model,
      max_tokens: MAX_TOKENS_ANALYZE,
      messages: [
        { role: 'user', content: buildAnalyzePrompt(resumeMarkdown, jdText, retryHint) }
      ]
    };
    const res = await fetchWithTimeout(
      ENDPOINT,
      { method: 'POST', headers: buildHeaders(apiKey), body: JSON.stringify(body), signal },
      TIMEOUT_ANALYZE_MS
    );
    if (!res.ok) throw await classifyHttpError(res);
    let json;
    try {
      json = await res.json();
    } catch (err) {
      throw new MalformedResponseError(`Response body not JSON: ${err?.message ?? 'unknown'}`);
    }
    return parseAnalysisJson(extractMessageText(json));
  };

  try {
    return await callOnce(null);
  } catch (err) {
    if (err instanceof MalformedResponseError) {
      return await callOnce(
        'Your previous response was not valid JSON. Respond with valid JSON only, no fences, no preamble.'
      );
    }
    throw err;
  }
}

async function readSseStream(response, onChunk) {
  if (!response.body || !response.body.getReader) {
    throw new NetworkError('Streaming not supported');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';
  let stopped = false;

  try {
    while (!stopped) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nlIdx;
      while ((nlIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nlIdx).replace(/\r$/, '').trim();
        buffer = buffer.slice(nlIdx + 1);
        if (!line || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let evt;
        try {
          evt = JSON.parse(payload);
        } catch {
          continue;
        }
        if (!evt) continue;

        if (evt.type === 'content_block_delta' && evt.delta) {
          const piece = typeof evt.delta.text === 'string' ? evt.delta.text : '';
          if (piece) {
            full += piece;
            try {
              onChunk?.(full);
            } catch {
              // listener errors must not kill the stream
            }
          }
        } else if (evt.type === 'message_stop') {
          stopped = true;
          break;
        } else if (evt.type === 'error') {
          throw new ServerError(evt.error?.message ?? 'Stream error', 500);
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
  return full;
}

export async function rewrite({ resumeMarkdown, jdText, apiKey, model, onChunk, signal }) {
  const body = {
    model,
    max_tokens: MAX_TOKENS_REWRITE,
    stream: true,
    messages: [{ role: 'user', content: buildRewritePrompt(resumeMarkdown, jdText) }]
  };
  const res = await fetchWithTimeout(
    ENDPOINT,
    {
      method: 'POST',
      headers: { ...buildHeaders(apiKey), Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal
    },
    TIMEOUT_REWRITE_MS
  );
  if (!res.ok) throw await classifyHttpError(res);
  return readSseStream(res, onChunk);
}
