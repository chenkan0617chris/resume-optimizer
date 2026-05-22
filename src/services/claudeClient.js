// services/claudeClient.js
// The single point of contact with the Anthropic Messages API.
// Per spec §5: two public functions (analyzeResume, rewriteResume), a mode
// flip between direct browser and proxy (§5.2), SSE streaming parser (§5.3),
// typed errors (§5.4), and a defensive JSON parser (§7.1).

import { buildAnalyzePrompt } from '../prompts/analyzePrompt.js';
import { buildRewritePrompt } from '../prompts/rewritePrompt.js';

// --- Constants ------------------------------------------------------------

export const MODEL = 'claude-sonnet-4-6';
export const API_BASE =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  'https://api.anthropic.com';
const ENDPOINT = `${API_BASE.replace(/\/$/, '')}/v1/messages`;

const TIMEOUT_ANALYZE_MS = 30_000;
const TIMEOUT_REWRITE_MS = 60_000;

const MAX_TOKENS_ANALYZE = 2048;
const MAX_TOKENS_REWRITE = 4096;

// --- Typed errors ---------------------------------------------------------

export class InvalidApiKeyError extends Error {
  static code = 'INVALID_API_KEY';
  constructor(message = 'Invalid API key') {
    super(message);
    this.name = 'InvalidApiKeyError';
    this.code = InvalidApiKeyError.code;
  }
}

export class RateLimitError extends Error {
  static code = 'RATE_LIMIT';
  constructor(message = 'Rate limited', retryAfterSeconds = null) {
    super(message);
    this.name = 'RateLimitError';
    this.code = RateLimitError.code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class TimeoutError extends Error {
  static code = 'TIMEOUT';
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
    this.code = TimeoutError.code;
  }
}

export class NetworkError extends Error {
  static code = 'NETWORK';
  constructor(message = 'Network error') {
    super(message);
    this.name = 'NetworkError';
    this.code = NetworkError.code;
  }
}

export class ServerError extends Error {
  static code = 'SERVER';
  constructor(message = 'Server error', status = 500) {
    super(message);
    this.name = 'ServerError';
    this.code = ServerError.code;
    this.status = status;
  }
}

export class MalformedResponseError extends Error {
  static code = 'MALFORMED_RESPONSE';
  constructor(message = 'Malformed model response') {
    super(message);
    this.name = 'MalformedResponseError';
    this.code = MalformedResponseError.code;
  }
}

// --- Helpers --------------------------------------------------------------

export function buildHeaders(apiKey) {
  const isDirect = API_BASE === 'https://api.anthropic.com';
  return {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    ...(isDirect && {
      'x-api-key': apiKey,
      'anthropic-dangerous-direct-browser-calls': 'true'
    })
  };
}

/**
 * Wrap fetch with a hard timeout. If the caller passes a `signal`, we honor
 * it too: aborting either the caller's signal or our timeout triggers abort.
 *
 * @param {string} url
 * @param {RequestInit} opts
 * @param {number} ms
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, opts = {}, ms = 30_000) {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);

  const externalSignal = opts.signal;
  let externalAbortHandler = null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      externalAbortHandler = () => controller.abort();
      externalSignal.addEventListener('abort', externalAbortHandler, {
        once: true
      });
    }
  }

  try {
    const response = await fetch(url, { ...opts, signal: controller.signal });
    return response;
  } catch (err) {
    if (timedOut) {
      throw new TimeoutError(`Request exceeded ${ms}ms`);
    }
    if (externalSignal && externalSignal.aborted) {
      // Caller-initiated cancellation — surface a clean abort.
      const abortErr = new DOMException('Aborted', 'AbortError');
      throw abortErr;
    }
    if (err && err.name === 'AbortError') {
      throw err;
    }
    throw new NetworkError(err && err.message ? err.message : 'Network error');
  } finally {
    clearTimeout(timer);
    if (externalSignal && externalAbortHandler) {
      externalSignal.removeEventListener('abort', externalAbortHandler);
    }
  }
}

/**
 * Map an HTTP error response to a typed error. Reads response body for
 * the message but tolerates non-JSON bodies. Honors `retry-after` for 429.
 *
 * @param {Response} response
 * @returns {Promise<Error>}
 */
export async function classifyError(response) {
  let bodyText = '';
  try {
    bodyText = await response.text();
  } catch {
    // ignore
  }
  let parsed = null;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    // non-JSON
  }
  const apiMessage =
    (parsed && parsed.error && parsed.error.message) || bodyText || response.statusText;

  if (response.status === 401 || response.status === 403) {
    return new InvalidApiKeyError(apiMessage || 'Invalid API key');
  }
  if (response.status === 429) {
    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfterSeconds = retryAfterHeader
      ? parseInt(retryAfterHeader, 10) || null
      : null;
    return new RateLimitError(apiMessage || 'Rate limited', retryAfterSeconds);
  }
  if (response.status >= 500) {
    return new ServerError(apiMessage || 'Server error', response.status);
  }
  // 4xx other than the above — treat as a server/contract problem so the
  // user sees a retryable banner rather than a swallowed failure.
  return new ServerError(apiMessage || `HTTP ${response.status}`, response.status);
}

// --- Response parsers ----------------------------------------------------

const VALID_STATUS = new Set(['missing', 'partial', 'matched']);
const VALID_IMPORTANCE = new Set(['high', 'medium', 'low']);

function isInt0to100(n) {
  return Number.isInteger(n) && n >= 0 && n <= 100;
}

/**
 * Defensively parse the analysis JSON. Strips ```json fences if present
 * even though we ask the model not to use them. Validates the full shape
 * from spec §7.1.
 *
 * @param {string} text
 * @returns {object} AnalysisJSON
 */
export function parseAnalysisJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new MalformedResponseError('Empty response');
  }
  let stripped = text.trim();

  // Strip leading/trailing fences (```json ... ``` or just ``` ... ```)
  const fenceMatch = stripped.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    stripped = fenceMatch[1].trim();
  } else {
    // Or simply remove a stray leading ```json line if present.
    stripped = stripped.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  }

  let obj;
  try {
    obj = JSON.parse(stripped);
  } catch (err) {
    throw new MalformedResponseError(
      `JSON parse failed: ${err && err.message ? err.message : 'unknown'}`
    );
  }

  if (!obj || typeof obj !== 'object') {
    throw new MalformedResponseError('Response is not an object');
  }

  // Top-level fields
  if (!isInt0to100(obj.score)) {
    throw new MalformedResponseError('score must be an integer 0-100');
  }
  const sb = obj.scoreBreakdown;
  if (!sb || typeof sb !== 'object') {
    throw new MalformedResponseError('scoreBreakdown missing');
  }
  for (const k of ['skills', 'experience', 'keywords', 'education']) {
    if (!isInt0to100(sb[k])) {
      throw new MalformedResponseError(
        `scoreBreakdown.${k} must be an integer 0-100`
      );
    }
  }
  if (typeof obj.summary !== 'string' || !obj.summary.trim()) {
    throw new MalformedResponseError('summary must be a non-empty string');
  }
  if (!Array.isArray(obj.gaps)) {
    throw new MalformedResponseError('gaps must be an array');
  }
  obj.gaps.forEach((g, i) => {
    if (!g || typeof g !== 'object') {
      throw new MalformedResponseError(`gaps[${i}] must be an object`);
    }
    if (typeof g.category !== 'string' || !g.category.trim()) {
      throw new MalformedResponseError(`gaps[${i}].category invalid`);
    }
    if (typeof g.item !== 'string' || !g.item.trim()) {
      throw new MalformedResponseError(`gaps[${i}].item invalid`);
    }
    if (!VALID_STATUS.has(g.status)) {
      throw new MalformedResponseError(
        `gaps[${i}].status must be missing|partial|matched`
      );
    }
    if (!VALID_IMPORTANCE.has(g.importance)) {
      throw new MalformedResponseError(
        `gaps[${i}].importance must be high|medium|low`
      );
    }
    if (typeof g.suggestion !== 'string') {
      throw new MalformedResponseError(`gaps[${i}].suggestion must be a string`);
    }
  });
  if (!Array.isArray(obj.strengths) || obj.strengths.some((s) => typeof s !== 'string')) {
    throw new MalformedResponseError('strengths must be an array of strings');
  }
  if (
    !Array.isArray(obj.improvements) ||
    obj.improvements.some((s) => typeof s !== 'string')
  ) {
    throw new MalformedResponseError('improvements must be an array of strings');
  }

  return obj;
}

/**
 * Extract the joined text from a non-streaming Messages API response.
 * @param {object} json
 * @returns {string}
 */
function extractMessageText(json) {
  if (!json || !Array.isArray(json.content)) return '';
  return json.content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
}

// --- Public: analyzeResume ------------------------------------------------

/**
 * One-shot gap analysis. Returns the parsed AnalysisJSON. Auto-retries once
 * on MalformedResponseError with a stricter hint appended to the prompt.
 *
 * @param {{
 *   resumeMarkdown: string,
 *   jdText: string,
 *   apiKey: string,
 *   signal?: AbortSignal
 * }} params
 * @returns {Promise<object>} AnalysisJSON
 */
export async function analyzeResume({ resumeMarkdown, jdText, apiKey, signal }) {
  const callOnce = async (retryHint) => {
    const userMessage = buildAnalyzePrompt(resumeMarkdown, jdText, retryHint);
    const body = {
      model: MODEL,
      max_tokens: MAX_TOKENS_ANALYZE,
      messages: [{ role: 'user', content: userMessage }]
    };

    const response = await fetchWithTimeout(
      ENDPOINT,
      {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify(body),
        signal
      },
      TIMEOUT_ANALYZE_MS
    );

    if (!response.ok) {
      throw await classifyError(response);
    }

    let json;
    try {
      json = await response.json();
    } catch (err) {
      throw new MalformedResponseError(
        `Response body not JSON: ${err && err.message ? err.message : 'unknown'}`
      );
    }

    const text = extractMessageText(json);
    return parseAnalysisJson(text);
  };

  try {
    return await callOnce(null);
  } catch (err) {
    if (err instanceof MalformedResponseError) {
      // One retry with a stricter instruction.
      return await callOnce(
        'Your previous response was not valid JSON. Respond with valid JSON only, no fences, no preamble.'
      );
    }
    throw err;
  }
}

// --- SSE streaming parser ------------------------------------------------

/**
 * Iterate the SSE response body, calling onChunk(accumulatedText) after each
 * content_block_delta. Returns the final accumulated string. Stops cleanly
 * at message_stop or when the stream ends.
 *
 * @param {Response} response
 * @param {(full: string) => void} onChunk
 * @returns {Promise<string>}
 */
async function readSseStream(response, onChunk) {
  if (!response.body || !response.body.getReader) {
    throw new NetworkError('Streaming not supported by this fetch response');
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

      // SSE events are separated by blank lines. Split on \n and process
      // each `data: ` line individually — we don't require event boundaries
      // because the JSON itself tells us the event type.
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const rawLine = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        const line = rawLine.replace(/\r$/, '').trim();
        if (!line || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let evt;
        try {
          evt = JSON.parse(payload);
        } catch {
          continue; // ignore malformed line, keep reading
        }
        if (!evt || typeof evt !== 'object') continue;

        if (evt.type === 'content_block_delta' && evt.delta) {
          const piece =
            typeof evt.delta.text === 'string' ? evt.delta.text : '';
          if (piece) {
            full += piece;
            try {
              onChunk && onChunk(full);
            } catch {
              // listener errors shouldn't kill the stream
            }
          }
        } else if (evt.type === 'message_stop') {
          stopped = true;
          break;
        } else if (evt.type === 'error') {
          const msg =
            (evt.error && evt.error.message) || 'Stream error from server';
          throw new ServerError(msg, 500);
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

// --- Public: rewriteResume ------------------------------------------------

/**
 * Streaming resume rewrite. Calls onChunk(full) with the accumulated text
 * as content_block_delta events arrive. Returns the final markdown string.
 *
 * @param {{
 *   resumeMarkdown: string,
 *   jdText: string,
 *   apiKey: string,
 *   onChunk?: (full: string) => void,
 *   signal?: AbortSignal
 * }} params
 * @returns {Promise<string>}
 */
export async function rewriteResume({
  resumeMarkdown,
  jdText,
  apiKey,
  onChunk,
  signal
}) {
  const userMessage = buildRewritePrompt(resumeMarkdown, jdText);
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS_REWRITE,
    stream: true,
    messages: [{ role: 'user', content: userMessage }]
  };

  const response = await fetchWithTimeout(
    ENDPOINT,
    {
      method: 'POST',
      headers: {
        ...buildHeaders(apiKey),
        Accept: 'text/event-stream'
      },
      body: JSON.stringify(body),
      signal
    },
    TIMEOUT_REWRITE_MS
  );

  if (!response.ok) {
    throw await classifyError(response);
  }

  return await readSseStream(response, onChunk);
}
