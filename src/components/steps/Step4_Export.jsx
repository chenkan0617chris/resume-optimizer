// components/steps/Step4_Export.jsx
// Step 4: Export (spec §8.3, §9 Step 4).
// - Template picker (Classic / Modern), persisted via setTemplate
// - Inline <PDFViewer> preview
// - <PDFDownloadLink> for download, copy-to-clipboard for raw markdown
// - Falls back to PlainTextTemplate if parseResumeMarkdown returns null
// - Guard: if rewrite.optimized is empty, toast + bounce back to /step/3

import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';

import { useAppStore } from '../../store/appStore.js';
import useI18n from '../../hooks/useI18n.js';

import ClassicTemplate from '../../services/pdfTemplates/ClassicTemplate.jsx';
import ModernTemplate from '../../services/pdfTemplates/ModernTemplate.jsx';
import PlainTextTemplate from '../../services/pdfTemplates/PlainTextTemplate.jsx';
import { parseResumeMarkdown } from '../../services/pdfTemplates/shared.jsx';

function CheckBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white text-xs"
    >
      {'✓'}
    </span>
  );
}

function TemplateThumb({ variant }) {
  // Tiny visual proxy for each template style. Pure CSS — no images required.
  if (variant === 'modern') {
    return (
      <div
        aria-hidden="true"
        className="flex h-20 w-full overflow-hidden rounded border border-slate-200"
      >
        <div className="h-full w-1/3 bg-brand" />
        <div className="flex h-full w-2/3 flex-col justify-center gap-1 bg-white px-2">
          <div className="h-1.5 w-3/4 rounded bg-slate-300" />
          <div className="h-1.5 w-full rounded bg-slate-200" />
          <div className="h-1.5 w-5/6 rounded bg-slate-200" />
        </div>
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded border border-slate-200 bg-white px-3"
    >
      <div className="h-2 w-1/2 rounded bg-slate-400" />
      <div className="h-px w-2/3 bg-slate-300" />
      <div className="mt-1 h-1.5 w-full rounded bg-slate-200" />
      <div className="h-1.5 w-11/12 rounded bg-slate-200" />
      <div className="h-1.5 w-5/6 rounded bg-slate-200" />
    </div>
  );
}

function TemplateCard({ id, selected, onSelect, title, description }) {
  const base =
    'relative w-full text-left rounded-lg p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-brand';
  const border = selected
    ? 'border-2 border-brand'
    : 'border border-slate-200 hover:border-slate-300';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(id)}
      className={`${base} ${border} bg-white`}
    >
      {selected ? <CheckBadge /> : null}
      <TemplateThumb variant={id} />
      <div className="mt-3 space-y-1">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <p className="text-xs leading-snug text-slate-600">{description}</p>
      </div>
    </button>
  );
}

export default function Step4Export() {
  const t = useI18n();
  const navigate = useNavigate();

  // Scalar selectors — avoid returning new object references per render.
  const optimized = useAppStore((s) => s.rewrite.optimized);
  const edited = useAppStore((s) => s.rewrite.edited);
  const template = useAppStore((s) => s.ui.template);
  const setTemplate = useAppStore((s) => s.setTemplate);
  const pushToast = useAppStore((s) => s.pushToast);

  // -- Mount guard: must have an optimized rewrite to be here --------------
  useEffect(() => {
    if (!optimized) {
      pushToast({ type: 'warning', message: 'errors.missingInputs' });
      navigate('/step/3', { replace: true });
    }
    // Mount-only guard; we don't want to bounce mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve markdown source: user edits take precedence over the stream.
  const markdown = edited ?? optimized ?? '';

  // Parse once per markdown change.
  const parsed = useMemo(() => parseResumeMarkdown(markdown), [markdown]);

  // Warn-on-fallback exactly once per distinct markdown value.
  const warnedForRef = useRef(null);
  useEffect(() => {
    if (!markdown) return;
    if (parsed === null && warnedForRef.current !== markdown) {
      warnedForRef.current = markdown;
      pushToast({ type: 'warning', message: 'step4.parseFallback' });
    }
  }, [parsed, markdown, pushToast]);

  // Memoize the actual react-pdf Document JSX so the heavy PDFViewer/Link
  // only re-renders when the inputs that actually matter change.
  const doc = useMemo(() => {
    if (parsed === null) {
      return <PlainTextTemplate markdown={markdown} />;
    }
    return template === 'modern' ? (
      <ModernTemplate resume={parsed} />
    ) : (
      <ClassicTemplate resume={parsed} />
    );
    // `markdown` is intentionally included so the PlainText fallback updates
    // when the user edits; for the structured templates the dependency is
    // effectively `parsed`.
  }, [parsed, template, markdown]);

  const handleSelectTemplate = (id) => {
    if (id !== template) setTemplate(id);
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      pushToast({ type: 'success', message: 'success.copied' });
    } catch {
      pushToast({ type: 'error', message: 'errors.unknown' });
    }
  };

  const handleBack = () => navigate('/step/3');

  // Render nothing until the guard has had a chance to bounce.
  if (!optimized) return null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          {t('step4.heading')}
        </h1>
        <p className="text-sm text-slate-600">{t('step4.subheading')}</p>
      </header>

      <section className="card space-y-4" aria-labelledby="step4-template-heading">
        <h2
          id="step4-template-heading"
          className="text-base font-semibold text-slate-900"
        >
          {t('step4.template.heading')}
        </h2>
        <div role="radiogroup" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TemplateCard
            id="classic"
            selected={template === 'classic'}
            onSelect={handleSelectTemplate}
            title={t('step4.template.classic')}
            description={t('step4.template.classic.description')}
          />
          <TemplateCard
            id="modern"
            selected={template === 'modern'}
            onSelect={handleSelectTemplate}
            title={t('step4.template.modern')}
            description={t('step4.template.modern.description')}
          />
        </div>
      </section>

      <section className="card space-y-4" aria-labelledby="step4-preview-heading">
        <h2
          id="step4-preview-heading"
          className="text-base font-semibold text-slate-900"
        >
          {t('step4.preview.heading')}
        </h2>
        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          <PDFViewer
            width="100%"
            height="600"
            showToolbar={false}
            style={{ border: 'none', display: 'block' }}
          >
            {doc}
          </PDFViewer>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PDFDownloadLink
            document={doc}
            fileName={t('step4.fileName')}
            className="btn-primary"
          >
            {({ loading }) =>
              loading ? t('step4.download.preparing') : t('step4.download.pdf')
            }
          </PDFDownloadLink>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCopyMarkdown}
          >
            {t('step4.copy.markdown')}
          </button>
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
      </div>
    </div>
  );
}
