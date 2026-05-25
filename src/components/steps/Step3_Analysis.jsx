// components/steps/Step3_Analysis.jsx
// Step 3: Analysis & Rewrite (spec §9).
// Phase A (one-shot gap analysis) renders ScoreCard + RadarChart + GapTable +
// summary + strengths/improvements lists. Phase B (streamed rewrite) shows a
// two-pane original/optimized editor with cancel + regenerate + diff toggle.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppStore, selectActiveApiKey } from '../../store/appStore.js';
import useI18n from '../../hooks/useI18n.js';
import useClaudeApi from '../../hooks/useClaudeApi.js';

import ScoreCard from '../ui/ScoreCard.jsx';
import RadarChart from '../ui/RadarChart.jsx';
import GapTable from '../ui/GapTable.jsx';
import ResumeEditor from '../ui/ResumeEditor.jsx';
import DiffView from '../ui/DiffView.jsx';

const MIN_JD_CHARS = 100;

export default function Step3Analysis() {
  const t = useI18n();
  const navigate = useNavigate();
  const { analyze, rewrite, cancelCurrent } = useClaudeApi();

  // --- Store reads (scalar selectors) ----------------------------------
  const resumeMarkdown = useAppStore((s) => s.resume.markdown);
  const jdText = useAppStore((s) => s.jd.text);
  const apiKey = useAppStore(selectActiveApiKey);

  const analysisStatus = useAppStore((s) => s.analysis.status);
  const analysisData = useAppStore((s) => s.analysis.data);
  const analysisError = useAppStore((s) => s.analysis.error);

  const rewriteStatus = useAppStore((s) => s.rewrite.status);
  const rewriteOriginal = useAppStore((s) => s.rewrite.original);
  const rewriteOptimized = useAppStore((s) => s.rewrite.optimized);
  const rewriteEdited = useAppStore((s) => s.rewrite.edited);
  const rewriteError = useAppStore((s) => s.rewrite.error);

  const setAnalysis = useAppStore((s) => s.setAnalysis);
  const setRewriteEdited = useAppStore((s) => s.setRewriteEdited);

  // --- Local UI state --------------------------------------------------
  const [diffOpen, setDiffOpen] = useState(false);
  const autoAnalyzeFired = useRef(false);

  // --- Mount guards ----------------------------------------------------
  useEffect(() => {
    if (!resumeMarkdown) {
      navigate('/step/1', { replace: true });
      return;
    }
    if (!jdText || jdText.length < MIN_JD_CHARS) {
      navigate('/step/2', { replace: true });
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Auto-fire analyze on mount --------------------------------------
  useEffect(() => {
    if (autoAnalyzeFired.current) return;
    if (analysisStatus !== 'idle') return;
    if (!resumeMarkdown) return;
    if (!jdText || jdText.length < MIN_JD_CHARS) return;
    if (!apiKey) return;
    autoAnalyzeFired.current = true;
    analyze();
  }, [analysisStatus, resumeMarkdown, jdText, apiKey, analyze]);

  // --- Handlers --------------------------------------------------------
  const handleRetryAnalyze = () => {
    setAnalysis('idle');
    // Allow the auto-fire effect to re-trigger by resetting the flag.
    autoAnalyzeFired.current = false;
    analyze();
  };

  const handleStartRewrite = () => {
    setDiffOpen(false);
    rewrite();
  };

  const handleRegenerateRewrite = () => {
    setDiffOpen(false);
    rewrite();
  };

  const handleRetryRewrite = () => {
    rewrite();
  };

  const handleDiscardEdits = () => {
    setRewriteEdited(null);
  };

  const handleOptimizedChange = (value) => {
    setRewriteEdited(value);
  };

  const handleBack = () => navigate('/step/2');
  const handleNext = () => {
    if (rewriteStatus !== 'success') return;
    navigate('/step/4');
  };

  const optimizedValue = rewriteEdited ?? rewriteOptimized ?? '';
  const isEdited =
    rewriteEdited !== null && rewriteEdited !== rewriteOptimized;
  const canProceed = rewriteStatus === 'success';

  // --- Sub-renderers ---------------------------------------------------

  function PhaseA() {
    if (analysisStatus === 'loading' || analysisStatus === 'idle') {
      // Treat idle similarly while we wait for the auto-fire effect.
      return (
        <section className="space-y-4" aria-busy="true">
          <div className="card space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              {t('step3.analyzing')}
            </h2>
            <p className="text-sm text-slate-600">
              {t('step3.analyzing.detail')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card">
                <div className="skeleton h-32 w-full rounded-md" />
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (analysisStatus === 'error') {
      return (
        <section className="card border border-red-200 bg-red-50 space-y-3">
          <h2 className="text-lg font-semibold text-red-800">
            {t('errors.unknown')}
          </h2>
          {analysisError ? (
            <p className="text-sm text-red-700 break-words">{analysisError}</p>
          ) : null}
          <div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleRetryAnalyze}
            >
              {t('nav.retry')}
            </button>
          </div>
        </section>
      );
    }

    // success
    const data = analysisData || {};
    const breakdown = data.scoreBreakdown || {};
    const strengths = Array.isArray(data.strengths) ? data.strengths : [];
    const improvements = Array.isArray(data.improvements)
      ? data.improvements
      : [];
    const gaps = Array.isArray(data.gaps) ? data.gaps : [];

    return (
      <section className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ScoreCard score={data.score} breakdown={breakdown} />
          <div className="card">
            <RadarChart breakdown={breakdown} />
          </div>
        </div>

        <div className="card space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('step3.summary.heading')}
          </h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {data.summary || ''}
          </p>
        </div>

        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('step3.gaps.heading')}
          </h2>
          <GapTable gaps={gaps} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {t('step3.strengths.heading')}
            </h2>
            {strengths.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t('step3.strengths.empty')}
              </p>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                {strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {t('step3.improvements.heading')}
            </h2>
            {improvements.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t('step3.improvements.empty')}
              </p>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                {improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {rewriteStatus === 'idle' ? (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              className="btn-primary text-base px-6 py-3"
              onClick={handleStartRewrite}
            >
              {t('step3.rewrite.button')}
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  function StatusLine() {
    if (rewriteStatus === 'streaming') {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-brand animate-pulse"
            aria-hidden="true"
          />
          <span className="text-sm text-slate-700">
            {t('step3.rewrite.streaming')}
          </span>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={cancelCurrent}
          >
            {t('step3.rewrite.cancel')}
          </button>
        </div>
      );
    }
    if (rewriteStatus === 'success') {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold"
            aria-hidden="true"
          >
            {'✓'}
          </span>
          <span className="text-sm text-emerald-700">
            {t('step3.rewrite.done')}
          </span>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={handleRegenerateRewrite}
          >
            {t('step3.rewrite.regenerate')}
          </button>
          {isEdited ? (
            <>
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {t('step3.rewrite.edited')}
              </span>
              <button
                type="button"
                className="text-xs text-slate-600 underline hover:text-slate-800"
                onClick={handleDiscardEdits}
              >
                {t('step3.rewrite.resetEdits')}
              </button>
            </>
          ) : null}
        </div>
      );
    }
    if (rewriteStatus === 'error') {
      return (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-2">
          <p className="text-sm text-red-800">{t('errors.unknown')}</p>
          {rewriteError ? (
            <p className="text-xs text-red-700 break-words">{rewriteError}</p>
          ) : null}
          <div>
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={handleRetryRewrite}
            >
              {t('nav.retry')}
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  function PhaseB() {
    if (rewriteStatus === 'idle') return null;
    const editorReadOnly = rewriteStatus === 'streaming';

    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          {t('step3.rewrite.heading')}
        </h2>

        <StatusLine />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">
              {t('step3.rewrite.original')}
            </h3>
            <ResumeEditor
              value={rewriteOriginal || ''}
              onChange={() => {}}
              readOnly
            />
          </div>
          <div className="card space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">
              {t('step3.rewrite.optimized')}
            </h3>
            <ResumeEditor
              value={optimizedValue}
              onChange={handleOptimizedChange}
              readOnly={editorReadOnly}
            />
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            aria-expanded={diffOpen}
            onClick={() => setDiffOpen((v) => !v)}
          >
            {diffOpen ? '▼ ' : '▶ '}
            {t('step3.rewrite.diff.label')}
          </button>
          {diffOpen ? (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">
                {t('step3.rewrite.diff.label')}
              </h3>
              <DiffView
                original={rewriteOriginal || ''}
                modified={optimizedValue}
              />
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          {t('step3.heading')}
        </h1>
      </header>

      <PhaseA />
      <PhaseB />

      <div className="flex items-center justify-between pt-2">
        <button type="button" className="btn-secondary" onClick={handleBack}>
          {t('nav.back')}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleNext}
          disabled={!canProceed}
        >
          {t('step3.next')}
        </button>
      </div>
    </div>
  );
}
