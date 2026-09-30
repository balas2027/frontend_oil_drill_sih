import i18n from '../../i18n';
import { Fragment } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Minimal sortable table with expandable rows (Section 9: sticky header,
 * hover royal-100, no zebra).
 * @param {{
 *   columns: {key: string, label: string, sortKey?: string, className?: string, render?: (row: any) => any}[],
 *   rows: any[], rowKey: (row: any) => string, sort?: string, onSort?: (sort: string) => void,
 *   expandedKey?: string|null, onToggle?: (key: string) => void, renderExpanded?: (row: any) => any,
 *   loading?: boolean, emptyText?: string
 * }} props
 */
export default function DataTable({
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  expandedKey,
  onToggle,
  renderExpanded,
  loading,
  emptyText = i18n.t('table.no_records'),
}) {
  const sortField = sort?.replace(/^-/, '');
  const desc = sort?.startsWith('-');

  const header = (col) => {
    if (!col.sortKey || !onSort) return col.label;
    const active = sortField === col.sortKey;
    const Icon = active ? (desc ? ChevronDown : ChevronUp) : ChevronsUpDown;
    return (
      <button
        type="button"
        onClick={() => onSort(active && !desc ? `-${col.sortKey}` : col.sortKey)}
        className="inline-flex items-center gap-1 uppercase hover:text-royal-900"
        aria-label={i18n.t('table.sort_by', { label: col.label })}
      >
        {col.label}
        <Icon
          className={`w-3 h-3 ${active ? 'text-royal-900' : 'text-ink-600/50'}`}
          aria-hidden="true"
        />
      </button>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" aria-busy={loading}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-royal-50 text-royal-700 text-[10px] tracking-wider uppercase">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                aria-sort={
                  sortField === col.sortKey ? (desc ? 'descending' : 'ascending') : undefined
                }
                className={`text-left px-3 py-2.5 font-bold whitespace-nowrap ${col.className || ''}`}
              >
                {header(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={loading ? 'opacity-50' : ''}>
          {rows.map((row) => {
            const key = rowKey(row);
            const expanded = expandedKey === key;
            return (
              <Fragment key={key}>
                <tr
                  onClick={onToggle ? () => onToggle(key) : undefined}
                  className={`border-b border-line/60 ${onToggle ? 'cursor-pointer' : ''} ${
                    expanded ? 'bg-royal-100' : 'hover:bg-royal-100/60'
                  }`}
                  aria-expanded={onToggle ? expanded : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-3 py-2 ${col.className || ''}`}>
                      {col.render ? col.render(row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
                {expanded && renderExpanded && (
                  <tr className="bg-royal-50/60 border-b border-line">
                    <td colSpan={columns.length} className="px-4 py-3">
                      {renderExpanded(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-ink-600">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-line text-[11px] text-ink-600">
      <span className="tabular-nums">
        {i18n.t('table.of', { from, to, total })}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="p-1 rounded border border-line disabled:opacity-40 hover:bg-royal-100"
          aria-label={i18n.t('table.prev')}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="tabular-nums px-1">
          {i18n.t('table.page', { page, pages })}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="p-1 rounded border border-line disabled:opacity-40 hover:bg-royal-100"
          aria-label={i18n.t('table.next')}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
