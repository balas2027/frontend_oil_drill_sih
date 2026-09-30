import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, AlertTriangle, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { documentsApi } from '../api/documents';
import { wellsApi } from '../api/wells';
import { apiErrorMessage } from '../api/client';
import { useAuthStore, canReview } from '../store/authStore';
import {
  ConfidenceBadge,
  DocStatusChip,
  ItemStatusChip,
  PipelineStepper,
} from '../components/documents/DocBadges';
import { formatEventType, EVENT_TYPE_COLORS } from '../components/map/eventStyles';

const PdfViewer = lazy(() => import('../components/documents/PdfViewer'));

export default function DocumentDetail() {
  const { t } = useTranslation();
  const { docId } = useParams();
  const [params, setParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const reviewer = canReview(user);
  const [doc, setDoc] = useState(null);
  const [items, setItems] = useState([]);
  const [wellIds, setWellIds] = useState([]);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  const page = Number(params.get('page')) || 1;
  // ?bbox=x0,y0,x1,y1 deep-links from an event's "View source"
  const linkedBbox = params.get('bbox')?.split(',').map(Number);
  const selectedItem = params.get('item');

  const load = useCallback(async () => {
    try {
      const [d, it] = await Promise.all([documentsApi.get(docId), documentsApi.items(docId)]);
      setDoc(d.data);
      setItems(it.data.items);
      setError(null);
      return ['queued', 'processing'].includes(d.data.status);
    } catch (err) {
      setError(apiErrorMessage(err, t('docs.detail.load_error')));
      return false;
    }
  }, [docId, t]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const tick = async () => {
      if ((await load()) && !cancelled) timer = setTimeout(tick, 2000);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    wellsApi
      .listWells({ limit: 100, sort: 'well_id' })
      .then((res) => setWellIds(res.data.wells.map((w) => w.well_id)))
      .catch(() => {});
  }, []);

  const highlights = useMemo(() => {
    const hs = items
      .filter((i) => i.evidence?.bbox)
      .map((i) => ({
        bbox: i.evidence.bbox,
        page: i.evidence.page,
        tone: i._id === selectedItem ? 'primary' : 'muted',
        label: i.evidence.snippet,
      }));
    if (linkedBbox?.length === 4 && linkedBbox.every((n) => !Number.isNaN(n))) {
      hs.push({ bbox: linkedBbox, page, tone: 'primary', label: t('docs.detail.linked') });
    }
    return hs;
  }, [items, selectedItem, linkedBbox, page, t]);

  const go = (next) => {
    const merged = Object.fromEntries(params.entries());
    Object.assign(merged, next);
    Object.keys(merged).forEach((k) => (merged[k] == null || merged[k] === '') && delete merged[k]);
    setParams(merged);
  };

  const reprocess = async () => {
    setActionMsg(null);
    try {
      await documentsApi.reprocess(docId);
      setActionMsg(t('docs.detail.reprocess_queued'));
      load();
    } catch (err) {
      setActionMsg(apiErrorMessage(err, t('docs.detail.reprocess_failed')));
    }
  };

  const assignWell = async (wellId) => {
    setActionMsg(null);
    try {
      const res = await documentsApi.update(docId, { well_id: wellId });
      setActionMsg(
        res.data.reprocess_job_id
          ? t('docs.detail.linked_rerun', { well: wellId })
          : t('docs.detail.linked_to', { well: wellId })
      );
      load();
    } catch (err) {
      setActionMsg(apiErrorMessage(err, t('docs.detail.well_failed')));
    }
  };

  if (error)
    return (
      <p className="p-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</p>
    );
  if (!doc) return <p className="p-6 text-sm text-royal-700 animate-pulse">{t('docs.detail.loading')}</p>;

  const job = doc.job;
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-line shadow-sm space-y-2">
        <Link
          to="/documents"
          className="text-[11px] text-royal-600 hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden="true" /> {t('docs.detail.all')}
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-royal-900 break-all flex items-center gap-2">
              <FileText className="w-5 h-5 text-royal-700 shrink-0" aria-hidden="true" />{' '}
              {doc.filename}
            </h2>
            <p className="text-xs text-ink-600 mt-0.5 tabular-nums">
              {doc.doc_type} · {t('docs.upload.pages', { n: doc.pages })} · {doc.pdf_kind}
              {doc.ocr_mean_conf != null &&
                ` · ${t('docs.detail.ocr_conf', { v: Math.round(doc.ocr_mean_conf * 100) })}`}
              {doc.fields?.report_date &&
                ` · ${t('docs.detail.report_date', { date: doc.fields.report_date })}`}{' '}
              · {t('docs.detail.uploaded_by', { who: doc.uploaded_by })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <DocStatusChip status={doc.status} />
            {job && <PipelineStepper steps={job.steps} />}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-ink-600">{t('explorer.cols.well')}</span>
            <select
              value={doc.well_id || ''}
              disabled={!reviewer}
              onChange={(e) => e.target.value && assignWell(e.target.value)}
              className="text-xs border border-line rounded-md px-2 py-1 bg-white disabled:bg-slate-50"
            >
              <option value="">{t('docs.detail.unmatched')}</option>
              {wellIds.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            {doc.well_match?.method && (
              <span className="text-[10px] text-ink-600">
                ({t('docs.detail.matched_by', { method: doc.well_match.method.replace('_', ' ') })}
                {doc.well_match.score != null && `, ${Math.round(doc.well_match.score * 100)}%`})
              </span>
            )}
          </label>
          {reviewer && !['queued', 'processing'].includes(doc.status) && (
            <button
              type="button"
              onClick={reprocess}
              className="inline-flex items-center gap-1 border border-royal-700 text-royal-700 hover:bg-royal-100 px-2 py-1 rounded-md"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> {t('docs.detail.reprocess')}
            </button>
          )}
          {(doc.flags || []).includes('low_ocr_confidence') && (
            <span className="inline-flex items-center gap-1 text-[#6B5310] bg-gold-100 border border-gold-500/40 px-2 py-0.5 rounded">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />{' '}
              {t('docs.detail.low_ocr')}
            </span>
          )}
          {doc.status === 'failed' && (
            <span className="text-red-700">{t('docs.detail.failed', { error: doc.error })}</span>
          )}
          {actionMsg && <span className="text-royal-900">{actionMsg}</span>}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl border border-line shadow-sm overflow-hidden h-[75vh] flex flex-col">
          <Suspense fallback={<p className="p-4 text-xs text-ink-600">{t('docs.split.loading_viewer')}</p>}>
            <PdfViewer
              docId={docId}
              page={page}
              onPageChange={(p) => go({ page: p })}
              highlights={highlights}
            />
          </Suspense>
        </div>
        <aside className="lg:col-span-2 bg-white rounded-xl border border-line shadow-sm overflow-hidden flex flex-col h-[75vh]">
          <div className="px-3 py-2 border-b border-line flex items-center justify-between">
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700">
              {t('docs.detail.items', { n: items.length })}
            </h3>
            {items.some((i) => i.status === 'pending') && (
              <Link
                to="/documents?tab=review"
                className="text-[11px] text-royal-600 hover:underline"
              >
                {t('docs.detail.open_queue')}
              </Link>
            )}
          </div>
          <ul className="flex-1 overflow-y-auto">
            {items.map((it) => {
              const v = it.values || {};
              const active = it._id === selectedItem;
              return (
                <li key={it._id}>
                  <button
                    type="button"
                    onClick={() => go({ page: it.evidence?.page, item: it._id, bbox: null })}
                    className={`w-full text-left px-3 py-2 border-b border-line/60 text-xs ${
                      active ? 'bg-royal-100' : 'hover:bg-royal-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-semibold text-royal-900 capitalize">
                        {it.kind === 'event' && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: EVENT_TYPE_COLORS[v.type] }}
                            aria-hidden="true"
                          />
                        )}
                        {it.kind === 'event' ? formatEventType(v.type) : `${t('docs.review.top')} · ${v.formation}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <ConfidenceBadge value={it.confidence} />
                        <ItemStatusChip status={it.status} />
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-600 tabular-nums mt-0.5">
                      {t('docs.review.page_short', { page: it.evidence?.page })} ·{' '}
                      {it.kind === 'event'
                        ? `${v.depth_from_md ?? '?'}–${v.depth_to_md ?? '?'} m MD${v.formation ? ` · ${v.formation}` : ''}`
                        : `${v.top_md}–${v.base_md ?? '?'} m MD`}
                      {it.duplicate_of && ` · ${t('docs.detail.matches_existing')}`}
                    </p>
                    {it.kind === 'event' && (
                      <p className="text-[11px] text-ink-900 mt-0.5 line-clamp-2">
                        {it.evidence?.snippet}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
            {items.length === 0 && (
              <li className="p-6 text-center text-xs text-ink-600">
                {['queued', 'processing'].includes(doc.status)
                  ? t('docs.detail.processing')
                  : t('docs.detail.no_items')}
              </li>
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
