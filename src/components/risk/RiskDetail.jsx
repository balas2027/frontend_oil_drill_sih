import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Brain, Database, FileText, ListChecks, Radio, ShieldAlert } from 'lucide-react';
import { RiskLevelChip } from './LevelChip';
import { driverBars, fmtPct } from './riskUtils';
import { EVENT_TYPE_COLORS, formatEventType } from '../map/eventStyles';

const CONF_STYLES = {
  high: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  medium: 'bg-gold-100 text-[#6B5310] border-gold-500/40',
  low: 'bg-red-50 text-red-700 border-red-200',
};

function Section({ icon: Icon, title, children }) {
  return (
    <section>
      <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1 flex items-center gap-1">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {title}
      </h4>
      {children}
    </section>
  );
}

/** Selected risk: probability, why (SHAP drivers + offset evidence), what worked before. */
export default function RiskDetail({ risk, assessment }) {
  const { t } = useTranslation();
  if (!risk) return null;
  const pr = risk.prior;
  const conf = assessment.confidence || {};
  const bars = driverBars(risk.drivers);

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-royal-900">
            {t(`risk_types.${risk.type}`, { defaultValue: risk.label })}
          </h3>
          <p className="text-ink-600">{t('risk.detail.probability', { m: risk.horizon_m })}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-royal-900 tabular-nums leading-none">
            {fmtPct(risk.probability)}
          </p>
          <div className="mt-1">
            <RiskLevelChip p={risk.probability} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <span
          className={`px-1.5 py-0.5 rounded border font-semibold ${CONF_STYLES[conf.level] || ''}`}
        >
          {conf.level
            ? t('confidence.label', { level: t(`confidence.${conf.level}`) })
            : t('risk.detail.conf_na')}
        </span>
        <span className="px-1.5 py-0.5 rounded border border-line bg-white text-ink-600">
          {risk.method === 'model'
            ? t('risk.detail.method_model')
            : t('risk.detail.method_rules')}
        </span>
        {conf.reason && <span className="text-ink-600 self-center">{conf.reason}</span>}
      </div>

      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 tabular-nums bg-royal-50 border border-royal-100 rounded-lg p-2">
        <dt className="text-ink-600">{t('risk.detail.offset_wells')}</dt>
        <dd className="text-royal-900 font-medium">
          {t('risk.detail.had_it', {
            n: pr.wells_with_event.length,
            total: pr.wells_drilled,
            m: risk.horizon_m,
          })}
          {pr.wells_with_event.length > 0 && (
            <span className="text-ink-600 font-normal"> ({pr.wells_with_event.join(', ')})</span>
          )}
        </dd>
        <dt className="text-ink-600">{t('risk.detail.peak')}</dt>
        <dd className="text-royal-900 font-medium">
          {risk.zone.from.toLocaleString('en-IN')}–{risk.zone.to.toLocaleString('en-IN')} m MD
          {risk.zone.formation && ` · ${risk.zone.formation}`} ·{' '}
          {t('risk.detail.offset_p', { p: fmtPct(risk.zone.peak_p) })}
        </dd>
        <dt className="text-ink-600">{t('risk.detail.in_formation')}</dt>
        <dd className="text-royal-900 font-medium">
          {t('risk.detail.of_offsets', { p: fmtPct(pr.formation) })}
        </dd>
        {pr.nearest_ahead_m != null && (
          <>
            <dt className="text-ink-600">{t('risk.detail.nearest')}</dt>
            <dd className="text-royal-900 font-medium">
              {t('risk.detail.ahead', { m: Math.round(pr.nearest_ahead_m) })}
            </dd>
          </>
        )}
      </dl>

      {risk.anomaly && (
        <Section icon={Radio} title={t('risk.detail.anomaly', { p: fmtPct(risk.anomaly.score) })}>
          {risk.anomaly.signals?.length ? (
            <ul className="space-y-0.5">
              {risk.anomaly.signals.map((s) => (
                <li key={s.name} className="tabular-nums">
                  <b className="text-royal-900">{t(`params.${s.name}`, { defaultValue: s.label })}</b>{' '}
                  {s.z != null
                    ? t(s.z > 0 ? 'risk.detail.above' : 'risk.detail.below', {
                        z: Math.abs(s.z).toFixed(1),
                      })
                    : t('risk.detail.variability', { r: s.ratio.toFixed(1) })}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-600">{t('risk.detail.no_deviation')}</p>
          )}
        </Section>
      )}

      <Section icon={Brain} title={t('risk.detail.why')}>
        <ul className="space-y-1">
          {bars.map((d) => (
            <li key={d.feature}>
              <div className="flex justify-between gap-2">
                <span className="text-ink-900">{d.label}</span>
                <span className="tabular-nums text-ink-600">
                  {d.raises ? '+' : '−'}
                  {Math.abs(d.contribution).toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 bg-royal-50 rounded" aria-hidden="true">
                <div
                  className="h-1.5 rounded"
                  style={{ width: `${d.width}%`, background: d.raises ? '#E8871E' : '#3B6FD8' }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-ink-600 mt-1">
          {t('risk.detail.legend')}
          {risk.method === 'model' ? ` (${t('risk.detail.shap')})` : ''}
        </p>
      </Section>

      <Section icon={Database} title={t('risk.detail.evidence', { n: risk.evidence_count })}>
        {risk.evidence.length ? (
          <ul className="space-y-1.5">
            {risk.evidence.map((e) => (
              <li
                key={e._id || `${e.well_id}${e.depth_from_md}`}
                className="border border-line rounded px-2 py-1.5"
              >
                <p className="font-semibold text-royal-900">
                  {e.well_id} · <span className="capitalize">{formatEventType(e.type)}</span> ·{' '}
                  {e.depth_from_md}–{e.depth_to_md} m MD
                  {e.formation && ` · ${e.formation}`}
                </p>
                {e.mitigation && (
                  <p className="text-ink-600">
                    {e.mitigation}
                    {e.outcome && ` → ${e.outcome}`}
                  </p>
                )}
                {e.source ? (
                  <Link
                    to={`/documents/${e.source.doc_id}?page=${e.source.page || 1}`}
                    className="inline-flex items-center gap-1 text-royal-600 hover:underline"
                  >
                    <FileText className="w-3 h-3" aria-hidden="true" />{' '}
                    {t('explorer.events.view_source', { page: e.source.page || 1 })}
                  </Link>
                ) : (
                  <span className="text-[10px] text-ink-600">{t('risk.detail.no_report')}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-600">
            {t('risk.detail.no_evidence')}
          </p>
        )}
      </Section>

      {risk.mitigations.length > 0 && (
        <Section icon={ShieldAlert} title={t('risk.detail.did')}>
          <ul className="space-y-0.5">
            {risk.mitigations.map((m) => (
              <li key={m.text}>
                <b className="text-royal-900">{m.text}</b>{' '}
                <span className="text-ink-600">
                  · {t('risk.feed.used_resolved', { count: m.count, resolved: m.resolved })}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section icon={ListChecks} title={t('risk.detail.checks')}>
        <ul className="list-disc pl-4 space-y-0.5 text-ink-900">
          {risk.suggested_checks.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
