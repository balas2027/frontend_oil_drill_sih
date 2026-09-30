import { useCallback, useEffect, useState } from 'react';
import { ListChecks, CheckCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { reviewApi } from '../../api/documents';
import { apiErrorMessage } from '../../api/client';
import { useAuthStore, canReview } from '../../store/authStore';
import ReviewSplitView from './ReviewSplitView';
import { ConfidenceBadge } from './DocBadges';
import { EVENT_TYPE_COLORS, formatEventType } from '../map/eventStyles';

const STATUSES = ['pending', 'auto_accepted', 'approved', 'rejected'];

export default function ReviewTab({ wellIds }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const reviewer = canReview(user);
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [batchMsg, setBatchMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reviewApi.queue({ status, limit: 100 });
      setItems(res.data.items);
      setTotal(res.data.total);
      setError(null);
      setSelected((cur) =>
        res.data.items.some((i) => i._id === cur) ? cur : res.data.items[0]?._id || null
      );
    } catch (err) {
      setError(apiErrorMessage(err, t('docs.review.load_error')));
    } finally {
      setLoading(false);
    }
  }, [status, t]);

  useEffect(() => {
    load();
  }, [load]);

  const onResolved = (id) => {
    // Move to the next item in the list
    const idx = items.findIndex((i) => i._id === id);
    const rest = items.filter((i) => i._id !== id);
    setItems(rest);
    setTotal((n) => Math.max(0, n - 1));
    setSelected(rest[Math.min(idx, rest.length - 1)]?._id || null);
  };

  const batchApprove = async () => {
    setBatchMsg(null);
    try {
      const res = await reviewApi.batchApprove({ min_confidence: 0.85 });
      setBatchMsg(
        t('docs.review.batch_result', { approved: res.data.approved, skipped: res.data.skipped })
      );
      load();
    } catch (err) {
      setBatchMsg(apiErrorMessage(err, t('docs.review.batch_failed')));
    }
  };

  const highConfidence = items.filter((i) => i.confidence >= 0.85).length;

  return (
    <div className="flex flex-col lg:flex-row min-h-[600px]">
      <aside className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-line flex flex-col">
        <div className="p-3 border-b border-line space-y-2">
          <div role="tablist" aria-label={t('docs.review.item_status')} className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={status === s}
                onClick={() => setStatus(s)}
                className={`px-2 py-1 rounded text-[10px] font-semibold capitalize ${
                  status === s
                    ? 'bg-royal-700 text-white'
                    : 'bg-royal-50 text-ink-600 hover:bg-royal-100'
                }`}
              >
                {t(`item_status.${s}`)}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-600 tabular-nums">
            {t('docs.review.n_items', { n: total })}
            {status === 'pending' && ` ${t('docs.review.awaiting')}`}
          </p>
          {reviewer && status === 'pending' && highConfidence > 0 && (
            <button
              type="button"
              onClick={batchApprove}
              className="w-full flex items-center justify-center gap-1 border border-royal-700 text-royal-700 hover:bg-royal-100 text-[11px] font-medium py-1 rounded-md"
            >
              <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />{' '}
              {t('docs.review.batch', { n: highConfidence })}
            </button>
          )}
          {batchMsg && <p className="text-[11px] text-royal-900">{batchMsg}</p>}
        </div>
        {error && (
          <p className="m-3 p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </p>
        )}
        <ul className="flex-1 overflow-y-auto max-h-[70vh]" aria-busy={loading}>
          {items.map((it) => {
            const v = it.values || {};
            const errors = (it.validation?.issues || []).filter(
              (i) => i.severity === 'error'
            ).length;
            return (
              <li key={it._id}>
                <button
                  type="button"
                  onClick={() => setSelected(it._id)}
                  aria-pressed={selected === it._id}
                  className={`w-full text-left px-3 py-2 border-b border-line/60 text-xs ${
                    selected === it._id
                      ? 'bg-royal-100'
                      : 'hover:bg-royal-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-semibold text-royal-900 capitalize truncate">
                      {it.kind === 'event' ? (
                        <>
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: EVENT_TYPE_COLORS[v.type] }}
                            aria-hidden="true"
                          />
                          {formatEventType(v.type)}
                        </>
                      ) : (
                        `${t('docs.review.top')} · ${v.formation}`
                      )}
                    </span>
                    <ConfidenceBadge value={it.confidence} />
                  </div>
                  <p className="text-[10px] text-ink-600 mt-0.5 tabular-nums truncate">
                    {it.well_id || t('docs.review.no_well')} ·{' '}
                    {it.kind === 'event'
                      ? v.depth_from_md != null
                        ? `${v.depth_from_md}–${v.depth_to_md} m`
                        : t('docs.review.no_depth')
                      : `${v.top_md} m`}{' '}
                    · {t('docs.review.page_short', { page: it.evidence?.page })}
                    {errors > 0 && <span className="text-red-700"> · {t('docs.review.n_issues', { n: errors })}</span>}
                  </p>
                  <p className="text-[10px] text-ink-600 truncate">{it.filename}</p>
                </button>
              </li>
            );
          })}
          {!loading && items.length === 0 && (
            <li className="p-6 text-center text-xs text-ink-600">
              <ListChecks className="w-8 h-8 mx-auto text-ink-600/30 mb-2" aria-hidden="true" />
              {t('docs.review.nothing', { status: t(`item_status.${status}`) })}
            </li>
          )}
        </ul>
      </aside>
      <section className="flex-1 min-w-0" aria-label={t('docs.review.item')}>
        {selected ? (
          <ReviewSplitView
            key={selected}
            itemId={selected}
            wellIds={wellIds}
            onResolved={onResolved}
          />
        ) : (
          <p className="p-8 text-center text-xs text-ink-600">{t('docs.review.select')}</p>
        )}
      </section>
    </div>
  );
}
