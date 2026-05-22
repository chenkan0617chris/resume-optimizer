// components/layout/StepIndicator.jsx
// Horizontal 4-step progress bar. Completed steps are clickable.

import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../hooks/useI18n.js';

const STEPS = [1, 2, 3, 4];

function parseCurrentStep(pathname) {
  const match = pathname.match(/\/step\/(\d)/);
  if (!match) return 1;
  const n = parseInt(match[1], 10);
  if (Number.isNaN(n) || n < 1 || n > STEPS.length) return 1;
  return n;
}

export default function StepIndicator() {
  const t = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide the step indicator on non-step routes (e.g. /settings).
  if (!/^\/step\/\d/.test(location.pathname)) {
    return null;
  }

  const current = parseCurrentStep(location.pathname);

  return (
    <nav
      aria-label="Progress"
      className="bg-white border-b border-slate-200"
    >
      <ol className="max-w-6xl mx-auto w-full px-4 py-4 flex items-start">
        {STEPS.map((step, idx) => {
          const isCompleted = step < current;
          const isActive = step === current;
          const isClickable = isCompleted;
          const label = t(`step.${step}.title`);

          const circleBase =
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors';
          let circleClasses;
          if (isActive) {
            circleClasses =
              circleBase + ' bg-brand text-white border-brand';
          } else if (isCompleted) {
            circleClasses =
              circleBase +
              ' bg-green-500 text-white border-green-500 hover:bg-green-600';
          } else {
            circleClasses =
              circleBase + ' bg-white text-slate-400 border-slate-300';
          }

          const labelClasses =
            'mt-2 text-xs sm:text-sm text-center max-w-[8rem] ' +
            (isActive
              ? 'font-semibold text-brand'
              : isCompleted
              ? 'text-green-700'
              : 'text-slate-500');

          const connectorClasses =
            'flex-1 h-0.5 mt-4 mx-2 ' +
            (step < current ? 'bg-green-500' : 'bg-slate-200');

          const stepContent = (
            <div className="flex flex-col items-center">
              <div className={circleClasses} aria-hidden="true">
                {isCompleted ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <span className={labelClasses}>{label}</span>
            </div>
          );

          return (
            <li
              key={step}
              className={
                'flex items-start ' +
                (idx === STEPS.length - 1 ? '' : 'flex-1')
              }
            >
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => navigate(`/step/${step}`)}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={label}
                  className="focus:outline-none focus:ring-2 focus:ring-brand rounded"
                >
                  {stepContent}
                </button>
              ) : (
                <div aria-current={isActive ? 'step' : undefined}>
                  {stepContent}
                </div>
              )}
              {idx !== STEPS.length - 1 && (
                <div className={connectorClasses} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
