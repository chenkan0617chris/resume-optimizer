// services/providers/openaiCompatible.js
// Shared implementation for OpenAI Chat Completions API and any compatible
// provider (e.g., DeepSeek). The only differences between OpenAI and DeepSeek
// are the base URL and the supported model names.
//
// SSE format:
//   data: {"choices":[{"delta":{"content":"hi"}}]}
//   data: [DONE]

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

const TIMEOUT_ANALYZE_MS = 60_000;
const TIMEOUT_REWRITE_MS = 120_000;
const MAX_TOKENS_ANALYZE = 8192;
const MAX_TOKENS_REWRITE = 8192;

/**
 * Build a provider implementation against an OpenAI-compatible Chat
 * Completions endpoint. Returns { analyze, rewrite }.
 *
 * @param {{
 *   baseUrl: string,            // e.g. 'https://api.openai.com'
 *   chatPath?: string,          // default '/v1/chat/completions'
 *   supportsJsonMode?: boolean  // OpenAI gpt-4o supports response_format
 * }} cfg
 */
export function makeOpenAICompatibleProvider(cfg) {
  const base = cfg.baseUrl.replace(/\/$/, '');
  const endpoint = `${base}${cfg.chatPath || '/v1/chat/completions'}`;
  const supportsJsonMode = cfg.supportsJsonMode ?? false;

  function buildHeaders(apiKey) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    };
  }

  function extractMessageText(json) {
    return json?.choices?.[0]?.message?.content ?? '';
  }

  async function analyze({ resumeMarkdown, jdText, apiKey, model, signal }) {
    const callOnce = async (retryHint) => {
      const body = {
        model,
        messages: [
          { role: 'user', content: buildAnalyzePrompt(resumeMarkdown, jdText, retryHint) }
        ],
        max_tokens: MAX_TOKENS_ANALYZE
      };
      if (supportsJsonMode) {
        body.response_format = { type: 'json_object' };
      }
      const res = await fetchWithTimeout(
        endpoint,
        { method: 'POST', headers: buildHeaders(apiKey), body: JSON.stringify(body), signal },
        TIMEOUT_ANALYZE_MS
      );
      if (!res.ok) throw await classifyHttpError(res);
      let json;
      try {
        json = await res.json();
      } catch (err) {
        throw new MalformedResponseError(
          `Response body not JSON: ${err?.message ?? 'unknown'}`
        );
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
          if (!payload) continue;
          if (payload === '[DONE]') {
            stopped = true;
            break;
          }
          let evt;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          const piece = evt?.choices?.[0]?.delta?.content;
          if (typeof piece === 'string' && piece) {
            full += piece;
            try {
              onChunk?.(full);
            } catch {
              // listener errors must not kill the stream
            }
          }
          const finish = evt?.choices?.[0]?.finish_reason;
          if (finish && finish !== 'null') {
            // OpenAI signals completion via finish_reason in the last delta;
            // we still wait for [DONE] but this lets us bail early if needed.
          }
          if (evt?.error) {
            throw new ServerError(evt.error.message ?? 'Stream error', 500);
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

  async function rewrite({ resumeMarkdown, jdText, apiKey, model, onChunk, signal }) {
    const body = {
      model,
      messages: [{ role: 'user', content: buildRewritePrompt(resumeMarkdown, jdText) }],
      max_tokens: MAX_TOKENS_REWRITE,
      stream: true
    };
    const res = await fetchWithTimeout(
      endpoint,
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

  return { analyze, rewrite };
}
