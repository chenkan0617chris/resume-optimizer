// components/settings/ApiKeysTab.jsx
// Per-provider card: enter/save/clear API key, pick model, activate provider.
// Activation uses an explicit button so there is no hidden "disabled" state
// that blocks the user from switching providers.

import { useState } from 'react';
import useI18n from '../../hooks/useI18n.js';
import { useAppStore } from '../../store/appStore.js';
import { PROVIDERS, PROVIDER_IDS } from '../../services/providers/index.js';

function StatusDot({ on }) {
  return (
    <span
      aria-hidden="true"
      className={
        'inline-block w-2 h-2 rounded-full shrink-0 ' +
        (on ? 'bg-emerald-500' : 'bg-slate-300')
      }
    />
  );
}

function ProviderCard({ providerId }) {
  const t = useI18n();
  const provider = PROVIDERS[providerId];

  const storedKey    = useAppStore((s) => s.ui.apiKeys[providerId] || '');
  const storedModel  = useAppStore((s) => s.ui.providerModels[providerId] || provider.defaultModel);
  const activeProvider  = useAppStore((s) => s.ui.activeProvider);
  const setProviderKey  = useAppStore((s) => s.setProviderKey);
  const clearProviderKey = useAppStore((s) => s.clearProviderKey);
  const setActiveProvider = useAppStore((s) => s.setActiveProvider);
  const setProviderModel  = useAppStore((s) => s.setProviderModel);
  const pushToast = useAppStore((s) => s.pushToast);

  const [draft, setDraft]       = useState(storedKey);
  const [showKey, setShowKey]   = useState(false);
  const [validationError, setValidationError] = useState(null);

  const isActive     = activeProvider === providerId;
  const hasSavedKey  = !!storedKey;
  const isDirty      = draft !== storedKey;

  function onSave() {
    const err = provider.validate(draft);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setProviderKey(providerId, draft);
    pushToast({
      type: 'success',
      message: 'settings.providers.saved',
      vars: { name: provider.shortName },
    });
  }

  function onClear() {
    setDraft('');
    setValidationError(null);
    clearProviderKey(providerId);
  }

  function onMakeActive() {
    if (!hasSavedKey) {
      pushToast({
        type: 'warning',
        message: 'settings.providers.activateNeedsKey',
        vars: { name: provider.shortName },
      });
      return;
    }
    setActiveProvider(providerId);
    pushToast({
      type: 'success',
      message: 'settings.providers.activated',
      vars: { name: provider.shortName },
    });
  }

  return (
    <div
      className={
        'card transition-shadow ' +
        (isActive ? 'ring-2 ring-brand shadow-md' : '')
      }
    >
      {/* ── Header row ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot on={hasSavedKey} />
          <h3 className="text-lg font-semibold text-slate-900 truncate">
            {provider.name}
          </h3>
          {isActive && (
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-brand text-white shrink-0">
              {t('settings.providers.activeBadge')}
            </span>
          )}
        </div>

        {/* Activation button — only show when not already active */}
        {!isActive && (
          <button
            type="button"
            onClick={onMakeActive}
            disabled={!hasSavedKey}
            title={hasSavedKey ? undefined : t('settings.providers.activateNeedsKey', { name: provider.shortName })}
            className={
              'btn-secondary shrink-0 ' +
              (!hasSavedKey ? 'opacity-40 cursor-not-allowed' : '')
            }
          >
            {t('settings.providers.useThis')}
          </button>
        )}
      </div>

      {/* ── Description + console link ─────────────────────────────── */}
      <p className="text-sm text-slate-500 mb-4">
        {t(`settings.providers.${providerId}.description`)}{' '}
        <a
          href={provider.consoleUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand underline hover:text-brand-light"
        >
          {t('settings.providers.getKey')} →
        </a>
      </p>

      <div className="space-y-3">
        {/* ── API Key input ──────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('settings.providers.apiKey')}
          </label>
          <div className="flex gap-2 flex-wrap">
            <input
              type={showKey ? 'text' : 'password'}
              className="input flex-1 min-w-0 font-mono text-sm"
              placeholder={provider.keyPlaceholder}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setValidationError(null);
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? t('settings.providers.hideKey') : t('settings.providers.showKey')}
            >
              {showKey ? t('settings.providers.hideKey') : t('settings.providers.showKey')}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={onSave}
              disabled={!isDirty || !draft.trim()}
            >
              {t('nav.save')}
            </button>
            {hasSavedKey && (
              <button
                type="button"
                className="btn-secondary"
                onClick={onClear}
                aria-label={t('settings.providers.clearKey')}
              >
                {t('settings.providers.clearKey')}
              </button>
            )}
          </div>
          {validationError && (
            <p className="text-sm text-red-600 mt-1">{t(validationError)}</p>
          )}
          {!validationError && hasSavedKey && !isDirty && (
            <p className="text-xs text-emerald-600 mt-1">
              ✓ {t('settings.providers.keySaved')}
            </p>
          )}
        </div>

        {/* ── Model selector ─────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('settings.providers.model')}
          </label>
          <select
            className="input"
            value={storedModel}
            onChange={(e) => setProviderModel(providerId, e.target.value)}
          >
            {provider.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default function ApiKeysTab() {
  const t = useI18n();
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t('settings.apiKeys.intro')}</p>
      {PROVIDER_IDS.map((id) => (
        <ProviderCard key={id} providerId={id} />
      ))}
      <div className="card bg-slate-50 border-dashed">
        <h4 className="text-sm font-semibold text-slate-700 mb-1">
          {t('settings.apiKeys.privacyHeading')}
        </h4>
        <p className="text-sm text-slate-600">{t('settings.apiKeys.privacyBody')}</p>
      </div>
    </div>
  );
}
