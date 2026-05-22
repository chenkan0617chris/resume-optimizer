// components/layout/Header.jsx
// Top app bar: brand title + language toggle + API key status badge.

import { useAppStore } from '../../store/appStore.js';
import { useI18n } from '../../hooks/useI18n.js';

export default function Header() {
  const t = useI18n();
  const locale = useAppStore((s) => s.ui.locale);
  const apiKey = useAppStore((s) => s.ui.apiKey);
  const setLocale = useAppStore((s) => s.setLocale);
  const setApiKeyModalOpen = useAppStore((s) => s.setApiKeyModalOpen);

  const hasKey = Boolean(apiKey);
  const nextLocale = locale === 'en' ? 'zh' : 'en';

  return (
    <header className="sticky top-0 z-30 bg-brand text-white shadow-md h-14 flex items-center">
      <div className="max-w-6xl mx-auto w-full px-4 flex items-center justify-between">
        <h1 className="text-base sm:text-lg font-semibold tracking-tight">
          {t('app.title')}
        </h1>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setLocale(nextLocale)}
            aria-label={t('language.toggle')}
            className="px-2.5 py-1 rounded border border-white/30 text-xs sm:text-sm font-medium hover:bg-white/10 transition-colors"
          >
            {t('language.toggle')}
          </button>

          <button
            type="button"
            onClick={() => setApiKeyModalOpen(true)}
            aria-label={hasKey ? t('apiKey.set') : t('apiKey.notSet')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/30 text-xs sm:text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <span
              aria-hidden="true"
              className={
                'inline-block w-2 h-2 rounded-full ' +
                (hasKey ? 'bg-green-400' : 'bg-slate-400')
              }
            />
            <span>{hasKey ? t('apiKey.set') : t('apiKey.notSet')}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
