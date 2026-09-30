import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertTriangle, Info, Link2, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { reviewApi } from '../../api/documents';
import { apiErrorMessage } from '../../api/client';
import { useAuthStore, canReview } from '../../store/authStore';
import { ConfidenceBadge, ItemStatusChip } from './DocBadges';
import { formatEventType } from '../map/eventStyles';
import { formEdits, initialForm } from './reviewForm';

const PdfViewer = lazy(() => import('./PdfViewer'));

const EVENT_TYPES = [
  'mud_loss',
  'kick',
  'stuck_pipe',
  'torque_spike',
  'overpressure',
  'cementing_issue',
  'fishing',
  'wellbore_instability',
  'npt',
  'other',
];

const inputCls =
  'w-full text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none disabled:bg-slate-50';

const SEVERITY_ICON = {
  error: { icon: XCircle, cls: 'text-red-700 bg-red-50 border-red-200' },
  warning: { icon: AlertTriangle, cls: 'text-[#6B5310] bg-gold-100 border-gold-500/40' },
  info: { icon: Info, cls: 'text-royal-700 bg-royal-50 border-royal-100' },
};

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold text-ink-600 block mb-0.5">
        {label} {hint && <span className="font-normal">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

export default function ReviewSplitView({ itemId, wellIds = [], onResolved }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const reviewer = canReview(user);
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState(null);
  const [wellId, setWellId] = useState('');
  const [page, setPage] = useState(1);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setItem(null);
    setError(null);
    reviewApi
      .get(itemId)
      .then((res) => {
        if (cancelled) return;
        const it = res.data;
        const f = initialForm(it);
        setItem(it);
        setForm(f);
        setInitial(f);
        setWellId(it.well_id || '');
        setPage(it.evidence?.page || 1);
        setReason('');
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err, t('docs.split.load_error'))));
    return () => {
      cancelled = true;
    };
  }, [itemId, t]);

  const edits = useMemo(() => (form && initial ? formEdits(initial, form) : {}), [form, initial]);
  const highlights = useMemo(() => {
    if (!item) return [];
    const others = (item.mentions || [])
      .filter((m) => m.bbox && JSON.stringify(m.bbox) !== JSON.stringify(item.evidence?.bbox))
      .map((m) => ({ bbox: m.bbox, page: m.page, tone: 'muted', label: m.snippet }));
    return [
      ...others,
      { bbox: item.evidence?.bbox, page: item.evidence?.page, label: item.evidence?.snippet },
    ];
  }, [item]);

  if (error) return <p className="p-4 text-xs text-red-700">{error}</p>;
  if (!item || !form)
    return <p className="p-4 text-xs text-ink-600 animate-pulse">{t('docs.split.loading')}</p>;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const resolved = item.status === 'approved' || item.status === 'rejected';
  const locked = !reviewer || busy;
  const issues = item.validation?.issues || [];

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {};
      if (Object.keys(edits).length) body.edits = edits;
      if (wellId && wellId !== item.well_id) body.well_id = wellId;
      const res = await reviewApi.approve(item._id, body);
      onResolved?.(item._id, 'approved', res.data);
    } catch (err) {
      setError(apiErrorMessage(err, t('docs.split.approve_failed')));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    setError(null);
    try {
      await reviewApi.reject(item._id, reason || undefined);
      onResolved?.(item._id, 'rejected');
    } catch (err) {
      setError(apiErrorMessage(err, t('docs.split.reject_failed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-0 h-full min-h-[560px]">
      <div className="border-r border-line min-h-[420px] flex flex-col">
        <Suspense fallback={<p className="p-4 text-xs text-ink-600">{t('docs.split.loading_viewer')}</p>}>
          <PdfViewer
            docId={item.doc_id}
            page={page}
            onPageChange={setPage}
            highlights={highlights}
          />
        </Suspense>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-royal-900 capitalize">
            {item.kind === 'event'
              ? formatEventType(item.values.type)
              : `${t('docs.split.formation_top')} · ${item.values.formation}`}
          </span>
          <ItemStatusChip status={item.status} />
          <ConfidenceBadge value={item.confidence} />
          <span className="text-[10px] text-ink-600">{item.model_version}</span>
        </div>
        <p className="flex items-center gap-1 text-[11px] text-ink-600">
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          <Link
            to={`/documents/${item.doc_id}?page=${item.evidence?.page}`}
            className="text-royal-600 hover:underline"
          >
            {item.document?.filename}
          </Link>
          · {t('docs.split.page', { page: item.evidence?.page })} ·{' '}
          {item.page_source === 'ocr' ? 'OCR' : t('docs.split.text_layer')} ·{' '}
          {item.source_kind}
        </p>

        <blockquote className="border border-line bg-royal-50 px-3 py-2 rounded text-ink-900">
          “{item.evidence?.snippet}”
          {item.evidence?.mitigation_snippet &&
            item.evidence.mitigation_snippet !== item.evidence.snippet && (
              <span className="block mt-1 text-ink-600">“{item.evidence.mitigation_snippet}”</span>
            )}
        </blockquote>

        {item.duplicate && (
          <div className="flex gap-2 p-2.5 rounded-lg border border-royal-100 bg-royal-50">
            <Link2 className="w-4 h-4 text-royal-700 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              {t('docs.split.duplicate', {
                well: item.duplicate.well_id,
                type: formatEventType(item.duplicate.type),
                from: item.duplicate.depth_from_md,
                to: item.duplicate.depth_to_md,
                formation: item.duplicate.formation,
              })}
            </p>
          </div>
        )}

        {issues.length > 0 && (
          <ul className="space-y-1" aria-label={t('docs.split.validation')}>
            {issues.map((iss) => {
              const s = SEVERITY_ICON[iss.severity] || SEVERITY_ICON.info;
              const Icon = s.icon;
              return (
                <li
                  key={iss.code}
                  className={`flex gap-1.5 items-start border rounded px-2 py-1 ${s.cls}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                  <span>{iss.message}</span>
                </li>
              );
            })}
          </ul>
        )}

        <fieldset disabled={locked || resolved} className="grid grid-cols-2 gap-2">
          <legend className="sr-only">{t('docs.split.fields')}</legend>
          {(!item.well_id || issues.some((i) => i.code === 'well_unmatched')) && (
            <div className="col-span-2">
              <Field label={t('explorer.cols.well')}>
                <select
                  className={inputCls}
                  value={wellId}
                  onChange={(e) => setWellId(e.target.value)}
                >
                  <option value="">{t('docs.split.select_well')}</option>
                  {wellIds.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          {item.kind === 'event' ? (
            <>
              <Field label={t('explorer.cols.type')}>
                <select
                  className={`${inputCls} capitalize`}
                  value={form.type}
                  onChange={set('type')}
                >
                  {EVENT_TYPES.map((et) => (
                    <option key={et} value={et}>
                      {formatEventType(et)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('docs.fields.severity')} hint="1-5">
                <input
                  type="number"
                  min={1}
                  max={5}
                  className={inputCls}
                  value={form.severity}
                  onChange={set('severity')}
                />
              </Field>
              <Field label={t('docs.fields.depth_from')} hint="m MD">
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className={inputCls}
                  value={form.depth_from_md}
                  onChange={set('depth_from_md')}
                />
              </Field>
              <Field label={t('docs.fields.depth_to')} hint="m MD">
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className={inputCls}
                  value={form.depth_to_md}
                  onChange={set('depth_to_md')}
                />
              </Field>
              <Field label={t('docs.fields.formation')}>
                <input className={inputCls} value={form.formation} onChange={set('formation')} />
              </Field>
              <Field label={t('docs.fields.mud_weight')} hint="sg">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputCls}
                  value={form.mud_weight}
                  onChange={set('mud_weight')}
                />
              </Field>
              <Field label={t('docs.fields.volume_lost')} hint="bbl">
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className={inputCls}
                  value={form.volume_lost_bbl}
                  onChange={set('volume_lost_bbl')}
                />
              </Field>
              <Field label="NPT" hint={t('docs.fields.hours')}>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className={inputCls}
                  value={form.npt_hours}
                  onChange={set('npt_hours')}
                />
              </Field>
              <div className="col-span-2">
                <Field label={t('docs.fields.mitigation')}>
                  <input
                    className={inputCls}
                    value={form.mitigation}
                    onChange={set('mitigation')}
                  />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label={t('explorer.events.outcome')}>
                  <input className={inputCls} value={form.outcome} onChange={set('outcome')} />
                </Field>
              </div>
              <p className="col-span-2 text-[10px] text-ink-600 tabular-nums">
                TVD {item.values.depth_from_tvd ?? '—'}–{item.values.depth_to_tvd ?? '—'} m
                {item.values.tvd_estimated
                  ? ` (${t('docs.split.tvd_estimated')})`
                  : ` (${t('docs.split.tvd_surveys')})`}
                {item.values.formation_source === 'inferred_from_tops' &&
                  ` · ${t('docs.split.formation_inferred')}`}
              </p>
            </>
          ) : (
            <>
              <Field label={t('docs.fields.formation')}>
                <input className={inputCls} value={form.formation} onChange={set('formation')} />
              </Field>
              <Field label={t('docs.fields.lithology')}>
                <input className={inputCls} value={form.lithology} onChange={set('lithology')} />
              </Field>
              <Field label={t('docs.fields.top')} hint="m MD">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={form.top_md}
                  onChange={set('top_md')}
                />
              </Field>
              <Field label={t('docs.fields.base')} hint="m MD">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={form.base_md}
                  onChange={set('base_md')}
                />
              </Field>
            </>
          )}
        </fieldset>

        {error && (
          <p className="p-2 bg-red-50 border border-red-200 text-red-700 rounded">{error}</p>
        )}

        {resolved ? (
          <p className="text-ink-600">
            {t(item.status === 'approved' ? 'docs.split.approved_by' : 'docs.split.rejected_by', {
              who: item.reviewed_by,
            })}
            {item.reviewed_at && ` · ${item.reviewed_at.slice(0, 10)}`}
          </p>
        ) : reviewer ? (
          <div className="space-y-2 pt-1 border-t border-line">
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={approve}
                disabled={busy}
                className="flex items-center gap-1 bg-royal-700 hover:bg-royal-900 text-white text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                {Object.keys(edits).length
                  ? t('docs.split.approve_edits', { n: Object.keys(edits).length })
                  : t('docs.split.approve')}
              </button>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('docs.split.reason')}
                aria-label={t('docs.split.reason_aria')}
                className="flex-1 min-w-[120px] text-xs border border-line rounded-md px-2 py-1.5"
              />
              <button
                type="button"
                onClick={reject}
                disabled={busy}
                className="flex items-center gap-1 border border-red-600 text-red-700 hover:bg-red-50 text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" aria-hidden="true" /> {t('explorer.events.reject')}
              </button>
            </div>
            <p className="text-[10px] text-ink-600">
              {t('docs.split.gold_note')}
            </p>
          </div>
        ) : (
          <p className="text-ink-600 border-t border-line pt-2">
            {t('docs.split.reviewers_only')}
          </p>
        )}
      </div>
    </div>
  );
}
