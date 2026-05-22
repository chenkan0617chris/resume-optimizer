// components/steps/Step2_JDInput.jsx
// Step 2: Job Description input (spec §9).
// - JD textarea (required, >= 100 chars to advance)
// - Optional role + company
// - Character counter with amber styling under the minimum
// - Guards against direct navigation: bounces back to /step/1 if Step 1 incomplete

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';
import useI18n from '../../hooks/useI18n.js';

const MIN_JD_CHARS = 100;

export default function Step2JDInput() {
  const t = useI18n();
  const navigate = useNavigate();

  const text = useAppStore((s) => s.jd.text);
  const role = useAppStore((s) => s.jd.role);
  const company = useAppStore((s) => s.jd.company);
  const setJd = useAppStore((s) => s.setJd);
  const resumeMarkdown = useAppStore((s) => s.resume.markdown);
  const pushToast = useAppStore((s) => s.pushToast);

  // Guard: if Step 1 wasn't completed, toast + redirect back.
  useEffect(() => {
    if (!resumeMarkdown) {
      pushToast({ type: 'warning', message: 'errors.missingInputs' });
      navigate('/step/1', { replace: true });
    }
    // We only want this on mount; intentionally not re-running on text edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTextChange = (e) => {
    setJd({ text: e.target.value, role, company });
  };

  const handleRoleChange = (e) => {
    setJd({ text, role: e.target.value, company });
  };

  const handleCompanyChange = (e) => {
    setJd({ text, role, company: e.target.value });
  };

  const charCount = text ? text.length : 0;
  const belowMin = charCount < MIN_JD_CHARS;
  const counterText = belowMin
    ? t('step2.charCounter.min', { count: charCount, min: MIN_JD_CHARS })
    : t('step2.charCounter', { count: charCount });
  const counterClass = belowMin
    ? 'text-amber-600'
    : 'text-slate-500';

  const handleBack = () => {
    navigate('/step/1');
  };

  const handleNext = () => {
    if (!resumeMarkdown) {
      pushToast({ type: 'warning', message: 'errors.missingInputs' });
      return;
    }
    navigate('/step/3');
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          {t('step2.heading')}
        </h1>
        <p className="text-sm text-slate-600">{t('step2.subheading')}</p>
      </header>

      <section className="card space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="jd-text"
            className="block text-sm font-medium text-slate-700"
          >
            {t('step2.jd.label')}
          </label>
          <textarea
            id="jd-text"
            className="input resize-y"
            rows={16}
            placeholder={t('step2.jd.placeholder')}
            value={text || ''}
            onChange={handleTextChange}
            aria-describedby="jd-counter"
          />
          <p
            id="jd-counter"
            className={`text-xs ${counterClass}`}
            aria-live="polite"
          >
            {counterText}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="jd-role"
              className="block text-sm font-medium text-slate-700"
            >
              {t('step2.role.label')}
            </label>
            <input
              id="jd-role"
              type="text"
              className="input"
              placeholder={t('step2.role.placeholder')}
              value={role || ''}
              onChange={handleRoleChange}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="jd-company"
              className="block text-sm font-medium text-slate-700"
            >
              {t('step2.company.label')}
            </label>
            <input
              id="jd-company"
              type="text"
              className="input"
              placeholder={t('step2.company.placeholder')}
              value={company || ''}
              onChange={handleCompanyChange}
            />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn-secondary"
          onClick={handleBack}
        >
          {t('nav.back')}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleNext}
          disabled={belowMin}
        >
          {t('nav.next')}
        </button>
      </div>
    </div>
  );
}
