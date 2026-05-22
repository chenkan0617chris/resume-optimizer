// components/ui/Toast.jsx
// Fixed top-right stack of toasts. Each auto-dismisses after 4s.

import { useEffect } from 'react';
import { useAppStore } from '../../store/appStore.js';
import { useI18n } from '../../hooks/useI18n.js';

const AUTO_DISMISS_MS = 4000;

const BORDER_BY_TYPE = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  info: 'border-l-blue-500',
  warning: 'border-l-yellow-500'
};

const ICON_COLOR_BY_TYPE = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  warning: 'text-yellow-500'
};

function ToastItem({ toast }) {
  const t = useI18n();
  const dismissToast = useAppStore((s) => s.dismissToast);

  useEffect(() => {
    const handle = setTimeout(() => {
      dismissToast(toast.id);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(handle);
  }, [toast.id, dismissToast]);

  const type = toast.type || 'info';
  const borderClass = BORDER_BY_TYPE[type] || BORDER_BY_TYPE.info;
  const iconColor = ICON_COLOR_BY_TYPE[type] || ICON_COLOR_BY_TYPE.info;
  const message = t(toast.message, toast.vars);

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={
        'flex items-start gap-3 bg-white shadow-lg rounded-md border border-slate-200 border-l-4 ' +
        borderClass +
        ' px-4 py-3 min-w-[16rem] max-w-sm animate-slide-in pointer-events-auto'
      }
    >
      <span className={'mt-0.5 ' + iconColor} aria-hidden="true">
        {type === 'success' && (
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.58 7.7 9.3a1 1 0 10-1.4 1.4l2 2a1 1 0 001.4 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {type === 'error' && (
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.7 7.3a1 1 0 011.4 0L10 7.59l-.1-.1zm-1.4 1.4a1 1 0 011.4-1.4L10 8.58l1.3-1.3a1 1 0 011.4 1.4L11.42 10l1.3 1.3a1 1 0 01-1.42 1.4L10 11.42l-1.3 1.3a1 1 0 01-1.4-1.42L8.58 10l-1.3-1.3z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {type === 'warning' && (
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a1 1 0 011 1v3a1 1 0 11-2 0V7a1 1 0 011-1zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {type === 'info' && (
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </span>

      <p className="flex-1 text-sm text-slate-800 leading-snug">{message}</p>

      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label={t('nav.close')}
        className="text-slate-400 hover:text-slate-600 transition-colors -mr-1 -mt-1 p-1"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useAppStore((s) => s.ui.toasts);

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
