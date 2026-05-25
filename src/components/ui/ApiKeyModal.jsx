// components/ui/ApiKeyModal.jsx
// Lightweight prompt that appears when an API key is needed but none is set
// for the active provider. Sends the user to /settings to add one — no form
// here; key entry lives in the Settings page.

import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore, selectActiveApiKey } from '../../store/appStore.js';
import { useI18n } from '../../hooks/useI18n.js';
import { PROVIDERS } from '../../services/providers/index.js';

export default function ApiKeyModal() {
  const t = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const apiKeyModalOpen = useAppStore((s) => s.ui.apiKeyModalOpen);
  const activeKey = useAppStore(selectActiveApiKey);
  const activeProvider = useAppStore((s) => s.ui.activeProvider);
  const apiKeys = useAppStore((s) => s.ui.apiKeys);
  const setApiKeyModalOpen = useAppStore((s) => s.setApiKeyModalOpen);

  const provider = PROVIDERS[activeProvider];

  // Any provider configured? env vars in .env.local also count.
  const envKey = useMemo(() => {
    try {
      const e = import.meta.env;
      return (
        e?.VITE_ANTHROPIC_API_KEY ||
        e?.VITE_OPENAI_API_KEY    ||
        e?.VITE_DEEPSEEK_API_KEY  ||
        ''
      );
    } catch {
      return '';
    }
  }, []);
  const anyKeyConfigured = Object.values(apiKeys).some((v) => v && v.trim());

  // First-use force-open: no key for the active provider AND no env key
  // AND no other provider key configured AND not already on /settings.
  useEffect(() => {
    if (
      !activeKey &&
      !envKey &&
      !anyKeyConfigured &&
      !apiKeyModalOpen &&
      location.pathname !== '/settings'
    ) {
      setApiKeyModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC closes (only when the user already has at least one configured key
  // — otherwise the app is unusable and they must add one).
  useEffect(() => {
    if (!apiKeyModalOpen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape' && anyKeyConfigured) {
        setApiKeyModalOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [apiKeyModalOpen, anyKeyConfigured, setApiKeyModalOpen]);

  if (!apiKeyModalOpen) return null;

  function goToSettings() {
    setApiKeyModalOpen(false);
    navigate('/settings');
  }

  function close() {
    if (anyKeyConfigured) setApiKeyModalOpen(false);
  }

  const isFirstUse = !anyKeyConfigured;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apikey-modal-title"
    >
      <div
        className="absolute inset-0 bg-slate-900/60"
        onClick={close}
        aria-hidden="true"
      />

      <div className="relative bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-6 z-10">
        <h2 id="apikey-modal-title" className="text-lg font-semibold text-slate-900">
          {isFirstUse
            ? t('apiKey.modal.firstUseTitle')
            : t('apiKey.modal.missingTitle', { name: provider?.shortName ?? '' })}
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          {isFirstUse
            ? t('apiKey.modal.firstUseBody')
            : t('apiKey.modal.missingBody', { name: provider?.shortName ?? '' })}
        </p>

        <ul className="mt-3 text-sm text-slate-600 list-disc list-inside space-y-1">
          <li>{t('apiKey.modal.bullet.claude')}</li>
          <li>{t('apiKey.modal.bullet.openai')}</li>
          <li>{t('apiKey.modal.bullet.deepseek')}</li>
        </ul>

        <div className="mt-6 flex items-center justify-end gap-2">
          {!isFirstUse && (
            <button type="button" onClick={close} className="btn-secondary">
              {t('nav.close')}
            </button>
          )}
          <button type="button" onClick={goToSettings} className="btn-primary">
            {t('apiKey.modal.goToSettings')}
          </button>
        </div>
      </div>
    </div>
  );
}
