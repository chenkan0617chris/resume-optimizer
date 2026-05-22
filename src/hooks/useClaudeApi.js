// hooks/useClaudeApi.js
// React hook over the multi-provider aiClient. Reads activeProvider /
// activeKey / activeModel from the store and dispatches accordingly.
// External interface preserved (`{ analyze, rewrite, cancelCurrent, status, error }`)
// so existing Step 3 wiring keeps working.

import { useCallback, useRef, useState } from 'react';
import {
  useAppStore,
  selectActiveApiKey,
  selectActiveModel,
  selectActiveProviderId
} from '../store/appStore.js';
import {
  analyze as dispatchAnalyze,
  rewrite as dispatchRewrite,
  InvalidApiKeyError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  ServerError,
  MalformedResponseError
} from '../services/aiClient.js';

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
  if (err && err.name === 'AbortError') return null;
  return { type: 'error', message: 'errors.unknown' };
}

export default function useClaudeApi() {
  const controllerRef = useRef(null);
  const [status, setStatus] = useState('idle');
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

  const handleMissingKey = useCallback(() => {
    const store = useAppStore.getState();
    store.setApiKeyModalOpen(true);
  }, []);

  const handleApiKeyError = useCallback(() => {
    const store = useAppStore.getState();
    const id = selectActiveProviderId(store);
    store.clearProviderKey(id);
    store.setApiKeyModalOpen(true);
  }, []);

  const analyze = useCallback(async () => {
    const store = useAppStore.getState();
    const resumeMarkdown = store.resume.markdown;
    const jdText = store.jd.text;
    const apiKey = selectActiveApiKey(store);
    const providerId = selectActiveProviderId(store);
    const model = selectActiveModel(store);

    if (!apiKey) {
      handleMissingKey();
      const e = new InvalidApiKeyError('No API key for active provider');
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

    setStatus('loading');
    setError(null);
    store.setAnalysis('loading');

    try {
      const data = await dispatchAnalyze({
        providerId,
        model,
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
  }, [cancelCurrent, handleApiKeyError, handleMissingKey]);

  const rewrite = useCallback(async () => {
    const store = useAppStore.getState();
    const resumeMarkdown = store.resume.markdown;
    const jdText = store.jd.text;
    const apiKey = selectActiveApiKey(store);
    const providerId = selectActiveProviderId(store);
    const model = selectActiveModel(store);

    if (!apiKey) {
      handleMissingKey();
      const e = new InvalidApiKeyError('No API key for active provider');
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
      const finalText = await dispatchRewrite({
        providerId,
        model,
        resumeMarkdown,
        jdText,
        apiKey,
        signal: controller.signal,
        onChunk: (full) => {
          useAppStore.getState().appendRewriteChunk(full);
        }
      });
      store.setRewriteOptimized(finalText);
      store.setRewriteStatus('success', null);
      setStatus('success');
      return finalText;
    } catch (err) {
      if (err && err.name === 'AbortError') {
        store.setRewriteStatus('idle', null);
        setStatus('idle');
        return null;
      }
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
  }, [cancelCurrent, handleApiKeyError, handleMissingKey]);

  return { analyze, rewrite, cancelCurrent, status, error };
}
