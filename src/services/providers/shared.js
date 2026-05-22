// services/providers/shared.js
// Shared infrastructure for all AI providers: typed errors, fetch wrapper
// with timeout/abort plumbing, and the defensive AnalysisJSON parser.
// These were previously inline in claudeClient.js; lifted here so multiple
// providers (Anthropic, OpenAI, DeepSeek) can reuse them.

// --- Typed errors --------------------------------------------------------

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

// --- fetch with timeout + abort -----------------------------------------

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
      externalSignal.addEventListener('abort', externalAbortHandler, { once: true });
    }
  }

  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch (err) {
    if (timedOut) throw new TimeoutError(`Request exceeded ${ms}ms`);
    if (externalSignal && externalSignal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (err && err.name === 'AbortError') throw err;
    throw new NetworkError(err && err.message ? err.message : 'Network error');
  } finally {
    clearTimeout(timer);
    if (externalSignal && externalAbortHandler) {
      externalSignal.removeEventListener('abort', externalAbortHandler);
    }
  }
}

// --- Generic HTTP error classifier --------------------------------------
// Each provider may override (e.g., to parse provider-specific error JSON
// shapes) but most can use this.

export async function classifyHttpError(response, opts = {}) {
  const { errorBodyMessageGetter } = opts;
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

  let apiMessage = bodyText || response.statusText;
  if (errorBodyMessageGetter && parsed) {
    const m = errorBodyMessageGetter(parsed);
    if (m) apiMessage = m;
  } else if (parsed && parsed.error && parsed.error.message) {
    apiMessage = parsed.error.message;
  }

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
  return new ServerError(apiMessage || `HTTP ${response.status}`, response.status);
}

// --- AnalysisJSON parser (spec §7.1) ------------------------------------

const VALID_STATUS = new Set(['missing', 'partial', 'matched']);
const VALID_IMPORTANCE = new Set(['high', 'medium', 'low']);

function isInt0to100(n) {
  return Number.isInteger(n) && n >= 0 && n <= 100;
}

export function parseAnalysisJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new MalformedResponseError('Empty response');
  }
  let stripped = text.trim();

  // Strip ```json fences if present
  const fenceMatch = stripped.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    stripped = fenceMatch[1].trim();
  } else {
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
  if (!isInt0to100(obj.score)) {
    throw new MalformedResponseError('score must be an integer 0-100');
  }
  const sb = obj.scoreBreakdown;
  if (!sb || typeof sb !== 'object') {
    throw new MalformedResponseError('scoreBreakdown missing');
  }
  for (const k of ['skills', 'experience', 'keywords', 'education']) {
    if (!isInt0to100(sb[k])) {
      throw new MalformedResponseError(`scoreBreakdown.${k} must be 0-100`);
    }
  }
  if (typeof obj.summary !== 'string' || !obj.summary.trim()) {
    throw new MalformedResponseError('summary must be a non-empty string');
  }
  if (!Array.isArray(obj.gaps)) {
    throw new MalformedResponseError('gaps must be an array');
  }
  obj.gaps.forEach((g, i) => {
    if (!g || typeof g !== 'object') throw new MalformedResponseError(`gaps[${i}] invalid`);
    if (typeof g.category !== 'string' || !g.category.trim())
      throw new MalformedResponseError(`gaps[${i}].category invalid`);
    if (typeof g.item !== 'string' || !g.item.trim())
      throw new MalformedResponseError(`gaps[${i}].item invalid`);
    if (!VALID_STATUS.has(g.status))
      throw new MalformedResponseError(`gaps[${i}].status must be missing|partial|matched`);
    if (!VALID_IMPORTANCE.has(g.importance))
      throw new MalformedResponseError(`gaps[${i}].importance must be high|medium|low`);
    if (typeof g.suggestion !== 'string')
      throw new MalformedResponseError(`gaps[${i}].suggestion must be a string`);
  });
  if (!Array.isArray(obj.strengths) || obj.strengths.some((s) => typeof s !== 'string'))
    throw new MalformedResponseError('strengths must be an array of strings');
  if (!Array.isArray(obj.improvements) || obj.improvements.some((s) => typeof s !== 'string'))
    throw new MalformedResponseError('improvements must be an array of strings');

  return obj;
}
