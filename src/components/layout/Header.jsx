// components/layout/Header.jsx
// Top app bar: brand title + language toggle + active-provider chip + settings link.

import { useNavigate } from 'react-router-dom';
import { useAppStore, selectActiveApiKey } from '../../store/appStore.js';
import { useI18n } from '../../hooks/useI18n.js';
import { PROVIDERS } from '../../services/providers/index.js';

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function Header() {
  const t = useI18n();
  const navigate = useNavigate();
  const locale = useAppStore((s) => s.ui.locale);
  const activeProvider = useAppStore((s) => s.ui.activeProvider);
  const activeKey = useAppStore(selectActiveApiKey);
  const setLocale = useAppStore((s) => s.setLocale);

  const provider = PROVIDERS[activeProvider];
  const hasKey = Boolean(activeKey);
  const nextLocale = locale === 'en' ? 'zh' : 'en';

  return (
    <header className="sticky top-0 z-30 bg-brand text-white shadow-md h-14 flex items-center">
      <div className="max-w-6xl mx-auto w-full px-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-base sm:text-lg font-semibold tracking-tight hover:text-brand-50 transition-colors"
        >
          {t('app.title')}
        </button>

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
            onClick={() => navigate('/settings')}
            aria-label={t('settings.heading')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/30 text-xs sm:text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <span
              aria-hidden="true"
              className={
                'inline-block w-2 h-2 rounded-full ' +
                (hasKey ? 'bg-green-400' : 'bg-slate-400')
              }
            />
            <span className="hidden sm:inline">{provider?.shortName ?? '—'}</span>
            <GearIcon />
          </button>
        </div>
      </div>
    </header>
  );
}
