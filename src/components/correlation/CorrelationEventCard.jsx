import { Link } from 'react-router-dom';
import { X, FileText, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EVENT_TYPE_COLORS, formatEventType } from '../map/eventStyles';

/** Selected event with its evidence link (Section 9: every claim has "View source"). */
export default function CorrelationEventCard({ event, align, onClose }) {
  const { t } = useTranslation();
  const e = event;
  const rows = [
    [t('explorer.cols.well'), `${e.well_id}${e.well_name ? ` · ${e.well_name}` : ''}`],
    [t('explorer.drilling.depth'), `${e.depth_from_md}–${e.depth_to_md} m MD`],
    [
      t('corr.card.axis'),
      `${Math.round(e.from)}–${Math.round(e.to)} m${align === 'tvd' ? ' TVD' : ''}`,
    ],
    [t('docs.fields.formation'), e.formation || '—'],
    [t('docs.fields.severity'), `${e.severity}/5`],
    [t('docs.fields.mud_weight'), e.mud_weight != null ? `${e.mud_weight} sg` : '—'],
    [t('corr.card.losses'), e.volume_lost_bbl != null ? `${e.volume_lost_bbl} bbl` : null],
    ['NPT', e.npt_hours != null ? `${e.npt_hours} h` : null],
    [
      t('corr.card.record_status'),
      e.status ? t(`explorer.review_status.${e.status}`, { defaultValue: e.status }) : '—',
    ],
  ].filter(([, v]) => v != null);

  return (
    <section
      className="bg-white rounded-xl border border-line shadow-sm text-xs"
      aria-label={t('corr.card.aria')}
    >
      <header className="px-3 py-2 border-b border-line flex items-start justify-between gap-2">
        <h3 className="font-bold text-royal-900 capitalize">{formatEventType(e.type)}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded hover:bg-royal-100"
          aria-label={t('corr.card.close')}
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
            <span className="text-ink-600">{t('docs.fields.mitigation')}:</span>{' '}
            <b className="text-royal-900">{e.mitigation}</b>
            {e.outcome && <span className="text-ink-600"> · {e.outcome}</span>}
          </p>
        )}
        {e.source ? (
          <Link
            to={`/documents/${e.source.doc_id}?page=${e.source.page || 1}`}
            className="inline-flex items-center gap-1 text-royal-600 hover:underline font-medium"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />{' '}
            {t('explorer.events.view_source', { page: e.source.page || 1 })}
          </Link>
        ) : (
          <p className="flex gap-1.5 text-[11px] text-ink-600">
            <Database className="w-3.5 h-3.5 shrink-0 text-royal-700" aria-hidden="true" />
            {t('corr.card.no_source')}
          </p>
        )}
      </div>
    </section>
  );
}
