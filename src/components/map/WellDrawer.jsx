import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  X,
  Info,
  ChevronRight,
  AlertTriangle,
  Star,
  GitCompareArrows,
  Check,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { EVENT_TYPE_COLORS, formatEventType, formatStatusWord } from './eventStyles';


function Stat({ label, value }) {
  return (
    <div className="bg-royal-50 p-2.5 rounded-lg border border-royal-100">
      <span className="text-[10px] text-ink-600 block">{label}</span>
      <span className="text-sm font-bold text-royal-900 tabular-nums">{value}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-2 flex items-center gap-1">
      <Icon className="w-3 h-3" aria-hidden="true" /> {children}
    </h4>
  );
}

function SeverityChip({ value }) {
  const { t } = useTranslation();
  const cls =
    value >= 4
      ? 'bg-red-50 text-red-700 border-red-200'
      : value >= 3
        ? 'bg-orange-50 text-orange-700 border-orange-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold tabular-nums ${cls}`}>
      {t('severity.short', { value })}
    </span>
  );
}

export default function WellDrawer({
  result,
  weights,
  onClose,
  onMakeActive,
  inCorrelation,
  correlationFull,
  onToggleCorrelation,
}) {
  const { t } = useTranslation();
  const { well } = result;
  const fmt = (v, unit = '') => (v == null ? '—' : `${v}${unit}`);

  return (
    <aside
      className="w-80 bg-white rounded-xl border border-line shadow-sm overflow-y-auto shrink-0"
      aria-label={t('map.drawer.details_for', { name: well.name })}
    >
      <div className="p-4 border-b border-line flex items-start justify-between bg-royal-50 sticky top-0 z-10">
        <div>
          <h3 className="text-sm font-bold text-royal-900">{well.name}</h3>
          <p className="text-[10px] text-ink-600 mt-0.5">
            {well.well_id} • {well.field}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-royal-100 rounded"
          aria-label={t('map.drawer.close')}
        >
          <X className="w-4 h-4 text-ink-600" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Stat label={t('map.drawer.distance')} value={`${result.distance_km} ${t('units.km')}`} />
          <Stat label={t('map.drawer.similarity')} value={`${Math.round(result.similarity * 100)}%`} />
          <Stat
            label={t('map.drawer.status')}
            value={<span className="capitalize">{formatStatusWord(well.status)}</span>}
          />
          <Stat label={t('map.drawer.total_depth')} value={`${fmt(well.total_depth_md)} ${t('units.m_md')}`} />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onMakeActive}
            className="flex-1 flex items-center justify-center gap-1 bg-royal-700 hover:bg-royal-900 text-white text-[11px] font-medium py-1.5 rounded-md"
          >
            <Star className="w-3.5 h-3.5" aria-hidden="true" /> {t('map.drawer.set_active')}
          </button>
          <button
            onClick={onToggleCorrelation}
            disabled={!inCorrelation && correlationFull}
            title={
              !inCorrelation && correlationFull ? t('map.drawer.correlation_full') : undefined
            }
            className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 rounded-md border disabled:opacity-40 ${
              inCorrelation
                ? 'bg-gold-100 border-gold-500 text-royal-900'
                : 'border-royal-700 text-royal-700 hover:bg-royal-100'
            }`}
          >
            {inCorrelation ? (
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {inCorrelation ? t('map.drawer.in_correlation') : t('map.drawer.add_correlation')}
          </button>
        </div>
        <Link
          to={`/wells/${well.well_id}`}
          className="flex items-center justify-center gap-1 text-[11px] font-medium text-royal-600 hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> {t('map.drawer.open_well')}
        </Link>

        {result.why_similar.length > 0 && (
          <section>
            <SectionTitle icon={Info}>{t('map.drawer.why_similar')}</SectionTitle>
            <ul className="space-y-1">
              {result.why_similar.map((reason) => (
                <li
                  key={reason}
                  className="flex items-start gap-2 text-xs bg-royal-50 p-2 rounded-lg border border-royal-100"
                >
                  <ChevronRight
                    className="w-3 h-3 text-royal-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-royal-900">{reason}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <SectionTitle icon={Layers}>{t('map.drawer.score_breakdown')}</SectionTitle>
          <ul className="space-y-1.5">
            {Object.entries(result.components).map(([key, value]) => {
              const weight = weights?.[key] ?? 0;
              return (
                <li key={key} className="text-[11px]">
                  <div className="flex justify-between text-ink-600">
                    <span>
                      {t(`map.drawer.components.${key}`, { defaultValue: key })}{' '}
                      <span className="text-[10px]">(w {weight})</span>
                    </span>
                    <span className="tabular-nums font-medium text-royal-900">
                      {Math.round(value * 100)}% → +{(value * weight * 100).toFixed(1)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-royal-100 rounded-full mt-0.5 overflow-hidden">
                    <div
                      className="h-full bg-royal-500 rounded-full"
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="text-xs">
          <dl className="divide-y divide-line/60">
            {[
              [t('map.drawer.trajectory'), formatStatusWord(well.trajectory_type)],
              [t('map.drawer.mud_system'), well.mud_system],
              [t('map.drawer.target'), well.formation_target],
              [t('map.drawer.reservoir'), well.reservoir],
              [t('map.drawer.spud'), well.spud_date?.slice(0, 10)],
              [t('map.drawer.td_date'), well.td_date?.slice(0, 10)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5">
                <dt className="text-ink-600">{k}</dt>
                <dd className="font-medium text-royal-900 capitalize tabular-nums">{v || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>

        {result.total_events > 0 && (
          <section>
            <SectionTitle icon={AlertTriangle}>
              {t('map.drawer.events', { n: result.total_events })}
            </SectionTitle>
            <ul className="space-y-1 mb-3">
              {Object.entries(result.event_counts)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <li
                    key={type}
                    className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-slate-50"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: EVENT_TYPE_COLORS[type] || '#94A3B8' }}
                        aria-hidden="true"
                      />
                      <span className="capitalize text-ink-900">{formatEventType(type)}</span>
                    </span>
                    <span className="font-bold text-royal-900 tabular-nums">{count}</span>
                  </li>
                ))}
            </ul>

            <h5 className="text-[10px] font-semibold text-ink-600 mb-1">{t('map.drawer.most_severe')}</h5>
            <ul className="space-y-2">
              {result.top_events.map((ev) => (
                <li
                  key={ev._id}
                  className="text-[11px] border border-line rounded-lg p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-royal-900 capitalize">
                      {formatEventType(ev.type)}
                    </span>
                    <SeverityChip value={ev.severity} />
                  </div>
                  <p className="text-ink-600 mt-0.5 tabular-nums">
                    {ev.depth_from_md}–{ev.depth_to_md} {t('units.m_md')} • {ev.formation || '—'}
                  </p>
                  {ev.mitigation && (
                    <p className="mt-1 text-ink-900">
                      <span className="text-ink-600">{t('map.drawer.mitigation')}:</span> {ev.mitigation}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
