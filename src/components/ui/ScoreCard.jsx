// components/ui/ScoreCard.jsx
// Reusable score display: large animated circular SVG ring, plus four
// horizontal mini bars for the per-axis breakdown.

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../hooks/useI18n.js';

const RING_SIZE = 140;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const ANIMATION_MS = 600;

function clamp(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animate a numeric value from 0 → `target` over ANIMATION_MS using rAF.
 */
function useAnimatedNumber(target) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const safe = clamp(target);
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / ANIMATION_MS);
      setValue(safe * easeOutCubic(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return value;
}

function MiniBar({ label, value }) {
  const pct = clamp(value);
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-slate-600">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full bg-brand transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-medium text-slate-700">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export default function ScoreCard({ score, breakdown }) {
  const { t } = useI18n();
  const animated = useAnimatedNumber(score);
  const safeScore = clamp(animated);
  const dashOffset =
    RING_CIRCUMFERENCE - (safeScore / 100) * RING_CIRCUMFERENCE;

  const skills = breakdown?.skills ?? 0;
  const experience = breakdown?.experience ?? 0;
  const keywords = breakdown?.keywords ?? 0;
  const education = breakdown?.education ?? 0;

  return (
    <div className="card">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* Ring */}
        <div className="flex justify-center md:justify-start">
          <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              className="-rotate-90"
              aria-hidden="true"
            >
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={RING_STROKE}
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="#1e3a5f"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-brand tabular-nums">
                {Math.round(safeScore)}
              </span>
              <span className="text-xs text-slate-500 mt-0.5">/ 100</span>
            </div>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="flex-1 space-y-3">
          <MiniBar label={t('score.skills')} value={skills} />
          <MiniBar label={t('score.experience')} value={experience} />
          <MiniBar label={t('score.keywords')} value={keywords} />
          <MiniBar label={t('score.education')} value={education} />
        </div>
      </div>
    </div>
  );
}
