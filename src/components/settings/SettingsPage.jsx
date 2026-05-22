// components/settings/SettingsPage.jsx
// /settings route. Tabbed layout; current tabs: API Keys. Designed to
// accept more tabs (Appearance, Models, etc.) without restructure — add
// an entry to the TABS array and a component.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useI18n from '../../hooks/useI18n.js';
import ApiKeysTab from './ApiKeysTab.jsx';

const TABS = [
  { id: 'apiKeys', labelKey: 'settings.tabs.apiKeys', component: ApiKeysTab }
];

export default function SettingsPage() {
  const t = useI18n();
  const navigate = useNavigate();
  const [active, setActive] = useState(TABS[0].id);
  const ActiveComponent = TABS.find((x) => x.id === active)?.component || ApiKeysTab;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('settings.heading')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('settings.subheading')}</p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(-1)}
          aria-label={t('nav.back')}
        >
          ← {t('nav.back')}
        </button>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6" aria-label="Settings tabs">
          {TABS.map((tab) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={
                  'pb-3 text-sm font-medium border-b-2 transition-colors ' +
                  (isActive
                    ? 'border-brand text-brand'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300')
                }
                aria-current={isActive ? 'page' : undefined}
              >
                {t(tab.labelKey)}
              </button>
            );
          })}
        </nav>
      </div>

      <ActiveComponent />
    </div>
  );
}
