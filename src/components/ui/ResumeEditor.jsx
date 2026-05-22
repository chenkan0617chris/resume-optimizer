// components/ui/ResumeEditor.jsx
// Markdown textarea + live rendered preview.
// Renderer is intentionally minimal — handles #/##, - bullets, **bold**,
// and blank-line paragraph breaks. No markdown library.

import { useMemo } from 'react';
import { useI18n } from '../../hooks/useI18n.js';

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderInline(text) {
  // Bold first, then escape the segments around it.
  const parts = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={`b-${key++}`} className="font-semibold text-slate-900">
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/**
 * Minimal markdown renderer. Returns an array of React elements.
 */
function renderMarkdown(md) {
  const lines = (md || '').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={`p-${key++}`} className="mb-2 text-slate-700 leading-relaxed">
        {renderInline(paragraph.join(' '))}
      </p>
    );
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${key++}`} className="list-disc ml-5 mb-3 space-y-1 text-slate-700">
        {list.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === '') {
      flushList();
      flushParagraph();
    } else if (line.startsWith('## ')) {
      flushList();
      flushParagraph();
      blocks.push(
        <h2
          key={`h2-${key++}`}
          className="text-lg font-semibold text-brand mt-4 mb-2 border-b border-slate-200 pb-1"
        >
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      flushList();
      flushParagraph();
      blocks.push(
        <h1 key={`h1-${key++}`} className="text-2xl font-bold text-slate-900 mb-2">
          {renderInline(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      flushParagraph();
      list.push(line.slice(2));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushList();
  flushParagraph();
  return blocks;
}

export default function ResumeEditor({ value, onChange, readOnly = false }) {
  const { t } = useI18n();
  const rendered = useMemo(() => renderMarkdown(value || ''), [value]);

  return (
    <div className="card flex flex-col h-full">
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        {/* Editor */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">
            {t('editor.markdown')}
          </label>
          <textarea
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={readOnly}
            rows={16}
            spellCheck={false}
            className="input font-mono text-sm resize-y w-full disabled:bg-slate-50 disabled:text-slate-500"
            placeholder={t('editor.placeholder')}
          />
        </div>

        {/* Preview */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">
            {t('editor.preview')}
          </label>
          <div className="border border-slate-200 rounded-md p-4 bg-slate-50 overflow-auto">
            {rendered.length > 0 ? (
              rendered
            ) : (
              <p className="text-sm text-slate-400 italic">
                {t('editor.empty')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
