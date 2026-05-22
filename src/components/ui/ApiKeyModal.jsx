// components/ui/ApiKeyModal.jsx
// Modal for capturing the Anthropic API key.
// Opens when `ui.apiKeyModalOpen` is true, OR on mount when no key is present
// and no VITE_ANTHROPIC_API_KEY env var is set (first-use enforcement).

import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore.js';
import { useI18n } from '../../hooks/useI18n.js';

function isValidKey(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.startsWith('sk-ant-');
}

export default function ApiKeyModal() {
  const t = useI18n();
  const apiKey = useAppStore((s) => s.ui.apiKey);
  const apiKeyModalOpen = useAppStore((s) => s.ui.apiKeyModalOpen);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const setApiKeyModalOpen = useAppStore((s) => s.setApiKeyModalOpen);

  const envKey = useMemo(() => {
    try {
      return import.meta.env?.VITE_ANTHROPIC_API_KEY || '';
    } catch {
      return '';
    }
  }, []);

  // First-use force-open: no key in store AND no env key.
  useEffect(() => {
    if (!apiKey && !envKey && !apiKeyModalOpen) {
      setApiKeyModalOpen(true);
    }
    // We only want this to run at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [value, setValue] = useState('');
  const [error, setError] = useState(null);

  // Reset input + error each time the modal opens.
  useEffect(() => {
    if (apiKeyModalOpen) {
      setValue('');
      setError(null);
    }
  }, [apiKeyModalOpen]);

  const isFirstUse = !apiKey;

  // ESC closes when not first-use.
  useEffect(() => {
    if (!apiKeyModalOpen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape' && !isFirstUse) {
        setApiKeyModalOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [apiKeyModalOpen, isFirstUse, setApiKeyModalOpen]);

  if (!apiKeyModalOpen) return null;

  function handleSave(e) {
    e?.preventDefault?.();
    const trimmed = value.trim();
    if (!trimmed) {
      setError(t('apiKey.modal.empty'));
      return;
    }
    if (!isValidKey(trimmed)) {
      setError(t('apiKey.modal.invalidFormat'));
      return;
    }
    setApiKey(trimmed);
    setApiKeyModalOpen(false);
  }

  function handleBackdropClick() {
    if (!isFirstUse) setApiKeyModalOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apikey-modal-title"
    >
      <div
        className="absolute inset-0 bg-slate-900/60"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      <form
        onSubmit={handleSave}
        className="relative bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-6 z-10"
      >
        <h2
          id="apikey-modal-title"
          className="text-lg font-semibold text-slate-900"
        >
          {t('apiKey.modal.title')}
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          {t('apiKey.modal.description')}{' '}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline hover:text-brand-light"
          >
            {t('apiKey.modal.linkText')}
          </a>
          .
        </p>

        {isFirstUse && (
          <p className="mt-2 text-xs text-slate-500">
            {t('apiKey.modal.firstUseNotice')}
          </p>
        )}

        <label className="block mt-4">
          <span className="sr-only">{t('apiKey.modal.title')}</span>
          <input
            type="password"
            className="input"
            placeholder={t('apiKey.modal.placeholder')}
            value={value}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'apikey-modal-error' : undefined}
          />
        </label>

        {error && (
          <p
            id="apikey-modal-error"
            className="mt-2 text-sm text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          {!isFirstUse && (
            <button
              type="button"
              onClick={() => setApiKeyModalOpen(false)}
              className="btn-secondary"
            >
              {t('apiKey.modal.cancel')}
            </button>
          )}
          <button type="submit" className="btn-primary">
            {t('apiKey.modal.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
