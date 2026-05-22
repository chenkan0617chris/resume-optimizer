// components/ui/GapTable.jsx
// Sortable + filterable gap analysis table.
// Mobile collapses each row to a vertical card.

import { useMemo, useState } from 'react';
import { useI18n } from '../../hooks/useI18n.js';

const STATUS_OPTIONS = ['missing', 'partial', 'matched'];
const IMPORTANCE_OPTIONS = ['high', 'medium', 'low'];

const STATUS_PILL = {
  matched: 'bg-emerald-100 text-emerald-800',
  partial: 'bg-yellow-100 text-yellow-800',
  missing: 'bg-red-100 text-red-800'
};

const IMPORTANCE_PILL = {
  high: 'bg-red-50 text-red-700 border border-red-200',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  low: 'bg-slate-100 text-slate-700 border border-slate-200'
};

const IMPORTANCE_RANK = { high: 0, medium: 1, low: 2 };
const STATUS_RANK = { missing: 0, partial: 1, matched: 2 };

function MultiSelectChip({ label, options, selected, onChange, formatOption }) {
  const [open, setOpen] = useState(false);
  const toggle = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 text-sm rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label}
        {selected.length > 0 && (
          <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] text-xs rounded-full bg-brand text-white px-1">
            {selected.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute left-0 mt-2 z-20 w-56 max-h-72 overflow-auto bg-white border border-slate-200 rounded-md shadow-lg p-1"
            role="listbox"
          >
            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500">—</div>
            )}
            {options.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="rounded"
                />
                <span className="text-slate-700">
                  {formatOption ? formatOption(opt) : opt}
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SortHeader({ active, direction, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-brand"
    >
      {children}
      <span className="text-xs text-slate-400" aria-hidden="true">
        {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </button>
  );
}

export default function GapTable({ gaps }) {
  const { t } = useI18n();
  const rows = Array.isArray(gaps) ? gaps : [];

  const categoryOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((g) => g?.category && set.add(g.category));
    return Array.from(set).sort();
  }, [rows]);

  const [filterCategory, setFilterCategory] = useState([]);
  const [filterImportance, setFilterImportance] = useState([]);
  const [filterStatus, setFilterStatus] = useState([]);

  // Default sort: importance DESC (high first) → status (missing first)
  const [sortKey, setSortKey] = useState('importance');
  const [sortDir, setSortDir] = useState('desc');

  const filtered = useMemo(() => {
    return rows.filter((g) => {
      if (filterCategory.length && !filterCategory.includes(g.category)) return false;
      if (filterImportance.length && !filterImportance.includes(g.importance)) return false;
      if (filterStatus.length && !filterStatus.includes(g.status)) return false;
      return true;
    });
  }, [rows, filterCategory, filterImportance, filterStatus]);

  const sorted = useMemo(() => {
    // Ranks are defined so a lower number is "more important" / "more urgent".
    // We compute an ascending-order comparator, then invert when sortDir==='desc'.
    // Semantic intent: 'desc' importance = high first; 'asc' status = missing first.
    const cmpAsc = (a, b) => {
      if (sortKey === 'category') {
        return (a.category ?? '').localeCompare(b.category ?? '');
      }
      if (sortKey === 'importance') {
        return (IMPORTANCE_RANK[a.importance] ?? 99) - (IMPORTANCE_RANK[b.importance] ?? 99);
      }
      if (sortKey === 'status') {
        return (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99);
      }
      return 0;
    };
    // For importance, ascending-rank means high→low, which we present as "desc".
    // Flip so 'desc' click matches the user's mental model (high first).
    const directionFactor = sortDir === 'desc' ? -1 : 1;
    const importanceFlip = sortKey === 'importance' ? -1 : 1;

    const arr = [...filtered];
    arr.sort((a, b) => {
      const primary = cmpAsc(a, b) * directionFactor * importanceFlip;
      if (primary !== 0) return primary;
      // tie-breaker: missing first, then high importance first
      const statusTie = (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99);
      if (statusTie !== 0) return statusTie;
      return (IMPORTANCE_RANK[a.importance] ?? 99) - (IMPORTANCE_RANK[b.importance] ?? 99);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // For importance: desc = high first. For status: asc = missing first.
      setSortDir(key === 'importance' ? 'desc' : key === 'status' ? 'asc' : 'asc');
    }
  };

  const resetFilters = () => {
    setFilterCategory([]);
    setFilterImportance([]);
    setFilterStatus([]);
  };

  const hasFilters =
    filterCategory.length > 0 ||
    filterImportance.length > 0 ||
    filterStatus.length > 0;

  return (
    <div className="card">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <MultiSelectChip
          label={t('gap.category')}
          options={categoryOptions}
          selected={filterCategory}
          onChange={setFilterCategory}
        />
        <MultiSelectChip
          label={t('gap.importance')}
          options={IMPORTANCE_OPTIONS}
          selected={filterImportance}
          onChange={setFilterImportance}
          formatOption={(o) => t(`importance.${o}`)}
        />
        <MultiSelectChip
          label={t('gap.status')}
          options={STATUS_OPTIONS}
          selected={filterStatus}
          onChange={setFilterStatus}
          formatOption={(o) => t(`status.${o}`)}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm text-brand hover:underline ml-1"
          >
            {t('gap.reset')}
          </button>
        )}
        <div className="ml-auto text-sm text-slate-500">
          {sorted.length} / {rows.length}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr className="text-left">
              <th className="py-2 pr-3 w-1/5">
                <SortHeader
                  active={sortKey === 'category'}
                  direction={sortDir}
                  onClick={() => handleSort('category')}
                >
                  {t('gap.category')}
                </SortHeader>
              </th>
              <th className="py-2 pr-3 w-1/4 font-semibold text-slate-700">
                {t('gap.item')}
              </th>
              <th className="py-2 pr-3 w-[110px]">
                <SortHeader
                  active={sortKey === 'status'}
                  direction={sortDir}
                  onClick={() => handleSort('status')}
                >
                  {t('gap.status')}
                </SortHeader>
              </th>
              <th className="py-2 pr-3 w-[110px]">
                <SortHeader
                  active={sortKey === 'importance'}
                  direction={sortDir}
                  onClick={() => handleSort('importance')}
                >
                  {t('gap.importance')}
                </SortHeader>
              </th>
              <th className="py-2 font-semibold text-slate-700">
                {t('gap.suggestion')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((g, i) => (
              <tr
                key={`${g.category}-${g.item}-${i}`}
                className="border-b border-slate-100 align-top"
              >
                <td className="py-3 pr-3 text-xs text-slate-500">{g.category}</td>
                <td className="py-3 pr-3 font-semibold text-slate-800">{g.item}</td>
                <td className="py-3 pr-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_PILL[g.status] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {t(`status.${g.status}`)}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      IMPORTANCE_PILL[g.importance] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {t(`importance.${g.importance}`)}
                  </span>
                </td>
                <td className="py-3 text-slate-700">{g.suggestion}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  {t('gap.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {sorted.map((g, i) => (
          <div
            key={`${g.category}-${g.item}-${i}`}
            className="border border-slate-200 rounded-md p-3 bg-white"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-slate-500">{g.category}</div>
                <div className="font-semibold text-slate-800">{g.item}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_PILL[g.status] || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {t(`status.${g.status}`)}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    IMPORTANCE_PILL[g.importance] || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {t(`importance.${g.importance}`)}
                </span>
              </div>
            </div>
            {g.suggestion && (
              <div className="mt-2 text-sm text-slate-700">{g.suggestion}</div>
            )}
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="py-6 text-center text-slate-500 text-sm">
            {t('gap.empty')}
          </div>
        )}
      </div>
    </div>
  );
}
