import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, FileText, Database, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatEventType, EVENT_TYPE_COLORS } from '../map/eventStyles';

const PdfViewer = lazy(() => import('../documents/PdfViewer'));

/** Side panel for one citation: the report page with the evidence highlighted,
 * or the event record when no report is linked (Section 10.7). */
export default function CitationViewer({ citation, onClose }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(citation?.page || 1);
  useEffect(() => {
    setPage(citation?.page || 1);
  }, [citation]);
  if (!citation) return null;
  const c = citation;
  const hasDoc = Boolean(c.doc_id);

  return (
    <aside
      className="bg-white rounded-xl border border-line shadow-sm flex flex-col min-h-[520px] h-full overflow-hidden"
      aria-label={t('kn.cite.aria', { n: c.n })}
    >
      <div className="px-3 py-2 border-b border-line bg-royal-50 flex items-start justify-between gap-2">
        <div className="text-xs">
          <p className="font-bold text-royal-900 flex items-center gap-1.5">
            <span className="px-1.5 rounded bg-royal-700 text-white text-[10px]">[{c.n}]</span>
            {c.kind === 'event' ? (
              <span className="flex items-center gap-1 capitalize">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: EVENT_TYPE_COLORS[c.type] }}
                  aria-hidden="true"
                />
                {formatEventType(c.type)} · {c.well_id}
              </span>
            ) : (
              <span className="break-all">{c.filename || t('kn.cite.report')}</span>
            )}
          </p>
          <p className="text-[11px] text-ink-600 mt-0.5 tabular-nums">
            {c.kind === 'event' &&
              `${c.depth_from_md ?? '?'}–${c.depth_to_md ?? '?'} m MD · ${c.formation || '—'} · ${t('kn.cite.severity', { v: c.severity })}`}
            {hasDoc && ` ${c.kind === 'event' ? '· ' : ''}${t('docs.split.page', { page: c.page })}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-royal-100"
          aria-label={t('kn.cite.close')}
        >
          <X className="w-4 h-4 text-ink-600" />
        </button>
      </div>

      {c.snippet && (
        <blockquote className="mx-3 mt-2 border-l-4 border-gold-500 bg-gold-100/60 px-3 py-1.5 rounded-r text-xs text-ink-900">
          “{c.snippet}”
        </blockquote>
      )}
      {c.kind === 'event' && (c.mitigation || c.outcome) && (
        <p className="mx-3 mt-1.5 text-xs">
          {c.mitigation && (
            <>
              <span className="text-ink-600">{t('docs.fields.mitigation')}:</span>{' '}
              <b className="text-royal-900">{c.mitigation}</b>
            </>
          )}
          {c.outcome && <span className="text-ink-600"> · {c.outcome}</span>}
        </p>
      )}

      {hasDoc ? (
        <>
          <div className="flex-1 min-h-[380px] mt-2 border-t border-line flex flex-col">
            <Suspense fallback={<p className="p-4 text-xs text-ink-600">{t('kn.cite.loading')}</p>}>
              <PdfViewer
                docId={c.doc_id}
                page={page}
                onPageChange={setPage}
                highlights={c.bbox ? [{ bbox: c.bbox, page: c.page, label: c.snippet }] : []}
              />
            </Suspense>
          </div>
          <Link
            to={`/documents/${c.doc_id}?page=${page}${c.bbox ? `&bbox=${c.bbox.join(',')}` : ''}`}
            className="px-3 py-2 border-t border-line text-[11px] text-royal-600 hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> {t('kn.cite.open_full')}
          </Link>
        </>
      ) : (
        <div className="m-3 p-3 rounded-lg border border-line bg-slate-50 text-xs text-ink-600 flex gap-2">
          <Database className="w-4 h-4 shrink-0 text-royal-700" aria-hidden="true" />
          <span>
            {t('kn.cite.no_report')}{' '}
            <Link to="/documents" className="text-royal-600 hover:underline">
              {t('kn.cite.documents_link')}
            </Link>
          </span>
        </div>
      )}
      {!hasDoc && c.kind === 'document' && (
        <p className="m-3 text-xs text-ink-600 flex gap-1 items-center">
          <FileText className="w-4 h-4" aria-hidden="true" /> {t('kn.cite.gone')}
        </p>
      )}
    </aside>
  );
}
