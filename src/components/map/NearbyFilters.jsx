import React from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, RotateCcw } from 'lucide-react';
import { formatEventType, formatStatusWord } from './eventStyles';

const selectCls =
  'w-full text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none capitalize';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold text-ink-600 block mb-0.5">{label}</span>
      {children}
    </label>
  );
}

export default function NearbyFilters({ filters, options, onChange, onReset }) {
  const { t } = useTranslation();
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <details className="border-b border-line group">
      <summary className="px-4 py-2.5 cursor-pointer select-none flex items-center justify-between list-none hover:bg-royal-50">
        <span className="text-[10px] uppercase font-bold tracking-wider text-royal-700 flex items-center gap-1">
          <Filter className="w-3 h-3" aria-hidden="true" /> {t('map.filters.title')}
          {activeCount > 0 && (
            <span className="ml-1 bg-gold-500 text-royal-900 rounded-full px-1.5 text-[9px] normal-case tracking-normal">
              {t('map.filters.active', { n: activeCount })}
            </span>
          )}
        </span>
        <span className="text-[10px] text-ink-600 group-open:hidden">{t('map.filters.show')}</span>
        <span className="text-[10px] text-ink-600 hidden group-open:inline">{t('map.filters.hide')}</span>
      </summary>

      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
        <Field label={t('map.filters.formation')}>
          <select
            className={selectCls}
            value={filters.formation}
            onChange={(e) => onChange('formation', e.target.value)}
          >
            <option value="">{t('map.filters.any')}</option>
            {options.formations?.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('map.filters.status')}>
          <select
            className={selectCls}
            value={filters.status}
            onChange={(e) => onChange('status', e.target.value)}
          >
            <option value="">{t('map.filters.any')}</option>
            {options.statuses?.map((s) => (
              <option key={s} value={s}>
                {formatStatusWord(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('map.filters.event_type')}>
          <select
            className={selectCls}
            value={filters.eventType}
            onChange={(e) => onChange('eventType', e.target.value)}
          >
            <option value="">{t('map.filters.any')}</option>
            {options.event_types?.map((et) => (
              <option key={et} value={et}>
                {formatEventType(et)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('map.filters.well_type')}>
          <select
            className={selectCls}
            value={filters.trajectoryType}
            onChange={(e) => onChange('trajectoryType', e.target.value)}
          >
            <option value="">{t('map.filters.any')}</option>
            {options.trajectory_types?.map((tt) => (
              <option key={tt} value={tt}>
                {formatStatusWord(tt)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('map.filters.spud_from')}>
          <input
            type="date"
            className={selectCls}
            value={filters.spudFrom}
            onChange={(e) => onChange('spudFrom', e.target.value)}
          />
        </Field>
        <Field label={t('map.filters.spud_to')}>
          <input
            type="date"
            className={selectCls}
            value={filters.spudTo}
            onChange={(e) => onChange('spudTo', e.target.value)}
          />
        </Field>
        <button
          type="button"
          onClick={onReset}
          disabled={activeCount === 0}
          className="col-span-2 mt-1 flex items-center justify-center gap-1 text-[11px] font-medium border border-royal-700 text-royal-700 rounded-md py-1 hover:bg-royal-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" /> {t('map.filters.reset')}
        </button>
      </div>
    </details>
  );
}
