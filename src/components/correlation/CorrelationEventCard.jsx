import { Link } from 'react-router-dom';
import { X, FileText, Database } from 'lucide-react';
import { EVENT_TYPE_COLORS, formatEventType } from '../map/eventStyles';

/** Selected event with its evidence link (Section 9: every claim has "View source"). */
export default function CorrelationEventCard({ event, align, onClose }) {
  const e = event;
  const rows = [
    ['Well', `${e.well_id}${e.well_name ? ` · ${e.well_name}` : ''}`],
    ['Depth', `${e.depth_from_md}–${e.depth_to_md} m MD`],
    [
      'On chart axis',
      `${Math.round(e.from)}–${Math.round(e.to)} m${align === 'tvd' ? ' TVD' : ''}`,
    ],
    ['Formation', e.formation || '—'],
    ['Severity', `${e.severity}/5`],
    ['Mud weight', e.mud_weight != null ? `${e.mud_weight} sg` : '—'],
    ['Losses', e.volume_lost_bbl != null ? `${e.volume_lost_bbl} bbl` : null],
    ['NPT', e.npt_hours != null ? `${e.npt_hours} h` : null],
    ['Record status', e.status || '—'],
  ].filter(([, v]) => v != null);

  return (
    <section
      className="bg-white rounded-xl border border-line border-l-4 shadow-sm text-xs"
      style={{ borderLeftColor: EVENT_TYPE_COLORS[e.type] }}
      aria-label="Selected event"
    >
      <header className="px-3 py-2 border-b border-line flex items-start justify-between gap-2">
        <h3 className="font-bold text-royal-900 capitalize">{formatEventType(e.type)}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded hover:bg-royal-100"
          aria-label="Close event"
        >
          <X className="w-3.5 h-3.5 text-ink-600" />
        </button>
      </header>
      <div className="p-3 space-y-2">
        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 tabular-nums">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-600">{k}</dt>
              <dd className="text-royal-900 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {e.description && <p className="text-ink-900">{e.description}</p>}
        {e.mitigation && (
          <p>
            <span className="text-ink-600">Mitigation:</span>{' '}
            <b className="text-royal-900">{e.mitigation}</b>
            {e.outcome && <span className="text-ink-600"> · {e.outcome}</span>}
          </p>
        )}
        {e.source ? (
          <Link
            to={`/documents/${e.source.doc_id}?page=${e.source.page || 1}`}
            className="inline-flex items-center gap-1 text-royal-600 hover:underline font-medium"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" /> View source report (page{' '}
            {e.source.page || 1})
          </Link>
        ) : (
          <p className="flex gap-1.5 text-[11px] text-ink-600">
            <Database className="w-3.5 h-3.5 shrink-0 text-royal-700" aria-hidden="true" />
            Event record only - no source report linked yet.
          </p>
        )}
      </div>
    </section>
  );
}
