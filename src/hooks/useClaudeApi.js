// hooks/useClaudeApi.js
// React hook wrapping claudeClient. Owns the AbortController per call,
// dispatches loading/success/error to the store, surfaces user-facing
// toasts (using i18n KEYS — translation happens in the Toast component),
// and handles the 401 path by clearing the key and reopening the modal.

import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore.js';
import {
  analyzeResume,
  rewriteResume,
  InvalidApiKeyError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  ServerError,
  MalformedResponseError
} from '../services/claudeClient.js';

function errorToastPayload(err) {
  if (err instanceof InvalidApiKeyError) {
    return { type: 'error', message: 'errors.invalidApiKey' };
  }
  if (err instanceof RateLimitError) {
    return {
      type: 'warning',
      message: 'errors.rateLimit',
      vars: { seconds: err.retryAfterSeconds ?? 30 }
    };
  }
  if (err instanceof TimeoutError) {
    return { type: 'error', message: 'errors.timeout' };
  }
  if (err instanceof NetworkError) {
    return { type: 'error', message: 'errors.network' };
  }
  if (err instanceof ServerError) {
    return { type: 'error', message: 'errors.serverError' };
  }
  if (err instanceof MalformedResponseError) {
    return { type: 'error', message: 'errors.malformedResponse' };
  }
  // AbortError from user cancellation — silent.
  if (err && err.name === 'AbortError') return null;
  return { type: 'error', message: 'errors.unknown' };
}

export default function useClaudeApi() {
  const controllerRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | streaming | success | error
  const [error, setError] = useState(null);

  const cancelCurrent = useCallback(() => {
    if (controllerRef.current) {
      try {
        controllerRef.current.abort();
      } catch {
        // ignore
      }
      controllerRef.current = null;
    }
  }, []);

  const handleApiKeyError = useCallback(() => {
    const store = useAppStore.getState();
    store.clearApiKey();
    store.setApiKeyModalOpen(true);
  }, []);

  const analyze = useCallback(async () => {
    const store = useAppStore.getState();
    const resumeMarkdown = store.resume.markdown;
    const jdText = store.jd.text;
    const apiKey = store.ui.apiKey;

    if (!apiKey) {
      store.setApiKeyModalOpen(true);
      const e = new InvalidApiKeyError('No API key');
      setStatus('error');
      setError(e);
      store.pushToast({ type: 'error', message: 'errors.missingApiKey' });
      return null;
    }
    if (!resumeMarkdown || !jdText) {
      const e = new Error('Missing inputs');
      setStatus('error');
      setError(e);
      store.pushToast({ type: 'warning', message: 'errors.missingInputs' });
      return null;
    }

    // Cancel any in-flight call first.
    cancelCurrent();
    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus('loading');
    setError(null);
    store.setAnalysis('loading');

    try {
      const data = await analyzeResume({
        resumeMarkdown,
        jdText,
        apiKey,
        signal: controller.signal
      });
      store.setAnalysis('success', data);
      setStatus('success');
      return data;
    } catch (err) {
      if (err && err.name === 'AbortError') {
        // User cancellation — leave status as is, no toast.
        setStatus('idle');
        store.setAnalysis('idle');
        return null;
      }
      setStatus('error');
      setError(err);
      store.setAnalysis('error', err);

      const toast = errorToastPayload(err);
      if (toast) store.pushToast(toast);
      if (err instanceof InvalidApiKeyError) handleApiKeyError();
      return null;
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, [cancelCurrent, handleApiKeyError]);

  const rewrite = useCallback(async () => {
    const store = useAppStore.getState();
    const resumeMarkdown = store.resume.markdown;
    const jdText = store.jd.text;
    const apiKey = store.ui.apiKey;

    if (!apiKey) {
      store.setApiKeyModalOpen(true);
      const e = new InvalidApiKeyError('No API key');
      setStatus('error');
      setError(e);
      store.pushToast({ type: 'error', message: 'errors.missingApiKey' });
      return null;
    }
    if (!resumeMarkdown || !jdText) {
      const e = new Error('Missing inputs');
      setStatus('error');
      setError(e);
      store.pushToast({ type: 'warning', message: 'errors.missingInputs' });
      return null;
    }

    cancelCurrent();
    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus('streaming');
    setError(null);
    store.startRewrite(resumeMarkdown);

    try {
      const finalText = await rewriteResume({
        resumeMarkdown,
        jdText,
        apiKey,
        signal: controller.signal,
        onChunk: (full) => {
          // appendRewriteChunk semantics: replace optimized with the
          // accumulated buffer the SSE parser hands us.
          useAppStore.getState().appendRewriteChunk(full);
        }
      });
      store.setRewriteOptimized(finalText);
      store.setRewriteStatus('success', null);
      setStatus('success');
      return finalText;
    } catch (err) {
      if (err && err.name === 'AbortError') {
        // User-initiated cancel mid-stream — preserve partial buffer,
        // mark as idle (no error toast).
        store.setRewriteStatus('idle', null);
        setStatus('idle');
        return null;
      }
      // Preserve whatever has been written so far in rewrite.optimized.
      setStatus('error');
      setError(err);
      store.setRewriteStatus('error', err);

      const toast = errorToastPayload(err);
      if (toast) store.pushToast(toast);
      if (err instanceof InvalidApiKeyError) handleApiKeyError();
      return null;
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, [cancelCurrent, handleApiKeyError]);

  return { analyze, rewrite, cancelCurrent, status, error };
}
