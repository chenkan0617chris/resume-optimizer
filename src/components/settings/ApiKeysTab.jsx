// components/settings/ApiKeysTab.jsx
// Lists each provider (Claude, OpenAI, DeepSeek) in a card. Per card:
//   - Active radio (only one provider can be active app-wide)
//   - Provider description + console link
//   - Masked key input with show/hide toggle + Save button + clear button
//   - Model dropdown (saves on change)
//   - Status indicator: green dot when a key is saved, gray otherwise

import { useState } from 'react';
import useI18n from '../../hooks/useI18n.js';
import { useAppStore } from '../../store/appStore.js';
import { PROVIDERS, PROVIDER_IDS } from '../../services/providers/index.js';

function StatusDot({ on }) {
  return (
    <span
      aria-hidden="true"
      className={
        'inline-block w-2 h-2 rounded-full ' + (on ? 'bg-emerald-500' : 'bg-slate-300')
      }
    />
  );
}

function ProviderCard({ providerId }) {
  const t = useI18n();
  const provider = PROVIDERS[providerId];

  const storedKey = useAppStore((s) => s.ui.apiKeys[providerId] || '');
  const storedModel = useAppStore(
    (s) => s.ui.providerModels[providerId] || provider.defaultModel
  );
  const activeProvider = useAppStore((s) => s.ui.activeProvider);
  const setProviderKey = useAppStore((s) => s.setProviderKey);
  const clearProviderKey = useAppStore((s) => s.clearProviderKey);
  const setActiveProvider = useAppStore((s) => s.setActiveProvider);
  const setProviderModel = useAppStore((s) => s.setProviderModel);
  const pushToast = useAppStore((s) => s.pushToast);

  const [draft, setDraft] = useState(storedKey);
  const [showKey, setShowKey] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const isActive = activeProvider === providerId;
  const hasSavedKey = !!storedKey;
  const isDirty = draft !== storedKey;

  function onSave() {
    const err = provider.validate(draft);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setProviderKey(providerId, draft);
    pushToast({ type: 'success', message: 'settings.providers.saved', vars: { name: provider.shortName } });
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
        vars: { name: provider.shortName }
      });
      return;
    }
    setActiveProvider(providerId);
    pushToast({
      type: 'success',
      message: 'settings.providers.activated',
      vars: { name: provider.shortName }
    });
  }

  return (
    <div className={'card ' + (isActive ? 'ring-2 ring-brand' : '')}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <StatusDot on={hasSavedKey} />
            <h3 className="text-lg font-semibold text-slate-900">{provider.name}</h3>
            {isActive && (
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-brand text-white">
                {t('settings.providers.activeBadge')}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
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
        </div>

        <label className="flex items-center gap-2 text-sm shrink-0 cursor-pointer">
          <input
            type="radio"
            name="activeProvider"
            checked={isActive}
            onChange={onMakeActive}
            disabled={!hasSavedKey}
            className="accent-brand"
            aria-label={t('settings.providers.useThis')}
          />
          <span className={hasSavedKey ? 'text-slate-700' : 'text-slate-400'}>
            {t('settings.providers.useThis')}
          </span>
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('settings.providers.apiKey')}
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              className="input flex-1 font-mono text-sm"
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
