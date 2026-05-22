// components/ui/DiffView.jsx
// Word-level diff highlighter. Memoizes the diff computation since this
// re-runs on every stream chunk.

import { useMemo } from 'react';
import { wordDiff } from '../../services/diffService.js';

export default function DiffView({ original, modified }) {
  const parts = useMemo(
    () => wordDiff(original || '', modified || ''),
    [original, modified]
  );

  return (
    <div className="card">
      <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-800">
        {parts.map((p, i) => {
          if (p.added) {
            return (
              <ins
                key={i}
                className="bg-emerald-100 text-emerald-900 no-underline"
              >
                {p.value}
              </ins>
            );
          }
          if (p.removed) {
            return (
              <del
                key={i}
                className="bg-red-100 text-red-900 line-through"
              >
                {p.value}
              </del>
            );
          }
          return <span key={i}>{p.value}</span>;
        })}
      </div>
    </div>
  );
}
