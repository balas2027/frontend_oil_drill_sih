import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, FileText, Mail, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { AlertLevelChip, AlertLevelIcon } from './LevelChip';
import { ALERT_STATUS_LABELS, RULE_LABELS, alertLevel } from './riskUtils';

const btn =
  'inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-royal-600 disabled:opacity-40';

export function AlertCard({ alert, canAct, busy, onAction, onFeedback, fresh, onEmail }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const l = alertLevel(alert.level);
  const active = alert.status === 'open' || alert.status === 'ack';
  const rated = alert.feedback?.useful;
  const ev = alert.evidence || {};

  return (
    <li
      className={`bg-white border border-line rounded-lg shadow-sm ${fresh ? 'ring-2 ring-gold-500' : ''} ${
        active ? '' : 'opacity-70'
      }`}
    >
      <div className="p-2.5 space-y-1.5">
        <div className="flex items-start gap-2">
          <AlertLevelIcon level={alert.level} className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <AlertLevelChip level={alert.level} />
              <span className="text-[10px] text-ink-600 tabular-nums">
                {alert.well_id} ·{' '}
                {t('risk.feed.bit', { depth: Math.round(alert.depth_md).toLocaleString('en-IN') })} ·{' '}
                {new Date(alert.ts).toLocaleTimeString()}
              </span>
              <span className="text-[10px] px-1 rounded bg-royal-50 text-ink-600">
                {ALERT_STATUS_LABELS[alert.status] || alert.status}
                {alert.ack_by && alert.status === 'ack' ? ` · ${alert.ack_by}` : ''}
              </span>
            </div>
            <p className="text-xs font-semibold text-royal-900 mt-0.5">{alert.title}</p>
            {alert.email?.status === 'sent' && (
              <span className="text-[10px] text-emerald-700">
                ✉ {t('risk.feed.emailed', { n: alert.email.recipients?.length || 0 })}
              </span>
            )}
            {alert.email?.status === 'failed' && (
              <span className="text-[10px] text-red-700">✉ {t('risk.feed.email_failed')}</span>
            )}
          </div>
          {onEmail && (
            <button
              type="button"
              onClick={() => onEmail(alert)}
              className="p-1.5 rounded border border-line bg-white text-royal-700 hover:bg-royal-100 shrink-0"
              aria-label={t('risk.mail.alert_button', { title: alert.title })}
              title={t('risk.mail.alert_button', { title: alert.title })}
            >
              <Mail className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-ink-900 leading-snug">{alert.message}</p>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-royal-600 hover:underline"
          aria-expanded={open}
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          {t('risk.feed.evidence_toggle')}
        </button>
        {open && (
          <div className="text-[11px] space-y-1.5 bg-royal-50 border border-royal-100 rounded p-2">
            <p className="text-ink-600">
              {t('risk.feed.rule')}: <b className="text-royal-900">{RULE_LABELS[alert.rule] || alert.rule}</b>
              {alert.model_version && ` · ${alert.model_version}`}
            </p>
            {ev.wells_with_event?.length > 0 && (
              <p>
                <span className="text-ink-600">{t('risk.feed.offsets_with')}: </span>
                {ev.wells_with_event.join(', ')} (
                {t('risk.feed.n_of', { n: ev.wells_with_event.length, total: ev.wells_drilled })})
              </p>
            )}
            {ev.mitigations?.length > 0 && (
              <ul>
                {ev.mitigations.map((m) => (
                  <li key={m.text}>
                    <b className="text-royal-900">{m.text}</b>{' '}
                    <span className="text-ink-600">
                      · {t('risk.feed.used_resolved', { count: m.count, resolved: m.resolved })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {ev.events
              ?.filter((e) => e.source)
              .map((e) => (
                <Link
                  key={e._id}
                  to={`/documents/${e.source.doc_id}?page=${e.source.page || 1}`}
                  className="flex items-center gap-1 text-royal-600 hover:underline"
                >
                  <FileText className="w-3 h-3" aria-hidden="true" />{' '}
                  {t('risk.feed.report_page', { well: e.well_id, page: e.source.page || 1 })}
                </Link>
              ))}
            {alert.suggested_checks?.length > 0 && (
              <ul className="list-disc pl-4">
                {alert.suggested_checks.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {canAct && alert.status === 'open' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction(alert._id, 'ack')}
              className={`${btn} bg-royal-700 text-white border-royal-700 hover:bg-royal-900`}
            >
              <Check className="w-3 h-3" aria-hidden="true" /> {t('risk.feed.ack')}
            </button>
          )}
          {canAct && active && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction(alert._id, 'resolve')}
                className={`${btn} bg-white border-line text-royal-900 hover:bg-royal-100`}
              >
                {t('risk.feed.resolve')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction(alert._id, 'dismiss')}
                className={`${btn} bg-white border-line text-ink-600 hover:bg-royal-100`}
              >
                <X className="w-3 h-3" aria-hidden="true" /> {t('risk.feed.dismiss')}
              </button>
            </>
          )}
          {canAct && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-ink-600">
              {t('kn.answer.useful_q')}
              <button
                type="button"
                disabled={busy}
                onClick={() => onFeedback(alert._id, true)}
                aria-pressed={rated === true}
                aria-label={t('kn.answer.useful')}
                className={`p-1 rounded border ${rated === true ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-line hover:bg-royal-100'}`}
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onFeedback(alert._id, false)}
                aria-pressed={rated === false}
                aria-label={t('kn.answer.not_useful')}
                className={`p-1 rounded border ${rated === false ? 'bg-red-50 border-red-300 text-red-700' : 'border-line hover:bg-royal-100'}`}
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

const STATUS_FILTERS = ['active', ''];
const LEVEL_FILTERS = ['', 'critical', 'warning', 'watch', 'info'];

/** Alerts feed with filters and engineer actions (Section 10.6). */
export default function AlertFeed({
  alerts,
  filters,
  onFilters,
  canAct,
  busyId,
  onAction,
  onFeedback,
  freshIds,
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <div
          className="inline-flex rounded-md border border-line overflow-hidden"
          role="radiogroup"
          aria-label={t('explorer.cols.status')}
        >
          {STATUS_FILTERS.map((key) => (
            <button
              key={key || 'all'}
              type="button"
              role="radio"
              aria-checked={filters.status === key}
              onClick={() => onFilters({ ...filters, status: key })}
              className={`px-2 py-1 ${filters.status === key ? 'bg-royal-700 text-white' : 'bg-white text-royal-900 hover:bg-royal-100'}`}
            >
              {key ? t('risk.feed.active') : t('risk.feed.all')}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1">
          <span className="text-ink-600">{t('risk.feed.level')}</span>
          <select
            value={filters.level}
            onChange={(e) => onFilters({ ...filters, level: e.target.value })}
            className="text-[11px] border border-line rounded-md px-1.5 py-1 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none"
          >
            {LEVEL_FILTERS.map((lv) => (
              <option key={lv || 'any'} value={lv}>
                {lv ? alertLevel(lv).label : t('risk.feed.any')}
              </option>
            ))}
          </select>
        </label>
        <span className="text-ink-600 ml-auto tabular-nums">{t('risk.feed.shown', { n: alerts.length })}</span>
      </div>
      {alerts.length ? (
        <ul className="space-y-2" aria-live="polite">
          {alerts.map((a) => (
            <AlertCard
              key={a._id}
              alert={a}
              canAct={canAct}
              busy={busyId === a._id}
              onAction={onAction}
              onFeedback={onFeedback}
              fresh={freshIds?.has(a._id)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-600 bg-white border border-line rounded-lg p-4 text-center">
          {t('risk.feed.empty')}
        </p>
      )}
    </div>
  );
}
