import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, ListFilter, Search, ExternalLink } from 'lucide-react';
import { wellsApi } from '../../api/wells';
import { apiErrorMessage } from '../../api/client';
import { useMapStore } from '../../store/mapStore';
import DataTable, { Pagination } from '../common/DataTable';
import { formatEventType, formatStatusWord } from '../map/eventStyles';

const LIMIT = 15;
const inputCls =
  'text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none capitalize';

const STATUS_CHIP = {
  drilling: 'bg-gold-100 text-[#6B5310] border-gold-500/40',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  planned: 'bg-royal-50 text-royal-700 border-royal-100',
  abandoned: 'bg-slate-100 text-ink-600 border-line',
};

function WellDetail({ well, onShowEvents }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState(null);
  const [tops, setTops] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const setActiveWell = useMapStore((s) => s.setActiveWell);

  useEffect(() => {
    let cancelled = false;
    Promise.all([wellsApi.getWell(well.well_id), wellsApi.getWellTops(well.well_id)])
      .then(([d, t]) => {
        if (cancelled) return;
        setDetail(d.data);
        setTops(t.data.tops);
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [well.well_id]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!detail) return <p className="text-ink-600 animate-pulse">{t('explorer.wells.loading_detail')}</p>;
  const s = detail.summary;

  return (
    <div className="grid md:grid-cols-3 gap-4 text-xs">
      <div className="space-y-2">
        <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700">
          {t('explorer.wells.summary')}
        </h4>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
          {[
            [t('explorer.wells.basin_block'), `${detail.basin || '—'} / ${detail.block || '—'}`],
            [t('map.drawer.trajectory'), formatStatusWord(detail.trajectory_type)],
            [t('map.drawer.mud_system'), detail.mud_system],
            [t('explorer.wells.target'), detail.formation_target],
            [
              t('explorer.wells.spud_td'),
              `${detail.spud_date?.slice(0, 10) || '—'} → ${detail.td_date?.slice(0, 10) || '—'}`,
            ],
            [
              t('explorer.wells.td_md_tvd'),
              `${detail.total_depth_md ?? '—'} / ${detail.total_depth_tvd ?? '—'} m`,
            ],
            [t('explorer.wells.tops_surveys'), `${s.formation_tops} / ${s.survey_stations}`],
            [t('explorer.wells.drilling_records'), s.drilling_ts_records],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-600">{k}</dt>
              <dd className="font-medium text-royal-900 capitalize tabular-nums">{v ?? '—'}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setActiveWell(detail);
              navigate('/map');
            }}
            className="flex items-center gap-1 bg-royal-700 hover:bg-royal-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-md"
          >
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> {t('explorer.wells.show_on_map')}
          </button>
          <Link
            to={`/wells/${well.well_id}`}
            className="flex items-center gap-1 border border-royal-700 text-royal-700 hover:bg-royal-100 text-[11px] font-medium px-2.5 py-1.5 rounded-md"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> {t('map.drawer.open_well')}
          </Link>
          <button
            type="button"
            onClick={() => onShowEvents(well.well_id)}
            className="flex items-center gap-1 border border-royal-700 text-royal-700 hover:bg-royal-100 text-[11px] font-medium px-2.5 py-1.5 rounded-md"
          >
            <ListFilter className="w-3.5 h-3.5" aria-hidden="true" />{' '}
            {t('explorer.wells.view_events', { n: s.events })}
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
          {t('explorer.wells.tops_title')}
        </h4>
        <table className="w-full">
          <tbody>
            {tops.map((t) => (
              <tr key={t._id} className="border-b border-line/60">
                <td className="py-1 font-medium text-royal-900">{t.formation}</td>
                <td className="py-1 tabular-nums text-right">
                  {t.top_md}–{t.base_md}
                </td>
                <td className="py-1 pl-2 text-ink-600">{t.lithology}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
            {t('explorer.wells.casing_title')}
          </h4>
          <table className="w-full">
            <tbody>
              {(detail.casing_program || []).map((c) => (
                <tr key={`${c.size_in}-${c.shoe_md}`} className="border-b border-line/60">
                  <td className="py-1 font-medium text-royal-900 tabular-nums">
                    {c.size_in}&quot;
                  </td>
                  <td className="py-1 tabular-nums">{t('explorer.wells.shoe', { md: c.shoe_md })}</td>
                  <td className="py-1 text-ink-600">{c.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {s.events > 0 && (
          <div>
            <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
              {t('explorer.wells.events_by_type')}
            </h4>
            <div className="flex flex-wrap gap-1">
              {Object.entries(s.event_counts).map(([type, n]) => (
                <span
                  key={type}
                  className="px-1.5 py-0.5 rounded bg-white border border-line capitalize"
                >
                  {formatEventType(type)} <b className="tabular-nums">{n}</b>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WellsTab({ options, onShowEvents }) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ q: '', status: '', formation: '', trajectory_type: '' });
  const [sort, setSort] = useState('well_id');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ wells: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      wellsApi
        .listWells({ ...filters, sort, page, limit: LIMIT })
        .then((res) => {
          if (cancelled) return;
          setData(res.data);
          setError(null);
        })
        .catch((err) => !cancelled && setError(apiErrorMessage(err, t('explorer.wells.load_error'))))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters, sort, page]);

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const columns = [
    {
      key: 'well_id',
      label: t('explorer.cols.well_id'),
      sortKey: 'well_id',
      className: 'font-mono text-royal-900',
    },
    {
      key: 'name',
      label: t('explorer.cols.name'),
      sortKey: 'name',
      className: 'font-medium text-royal-900',
    },
    {
      key: 'status',
      label: t('explorer.cols.status'),
      sortKey: 'status',
      render: (w) => (
        <span
          className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold capitalize ${STATUS_CHIP[w.status] || ''}`}
        >
          {formatStatusWord(w.status)}
        </span>
      ),
    },
    {
      key: 'trajectory_type',
      label: t('explorer.cols.type'),
      className: 'capitalize',
      render: (w) => formatStatusWord(w.trajectory_type),
    },
    { key: 'mud_system', label: t('explorer.cols.mud') },
    { key: 'formation_target', label: t('explorer.cols.target') },
    {
      key: 'total_depth_md',
      label: t('explorer.cols.td'),
      sortKey: 'total_depth_md',
      className: 'tabular-nums text-right',
      render: (w) => w.total_depth_md?.toLocaleString() ?? '—',
    },
    {
      key: 'spud_date',
      label: t('explorer.cols.spud'),
      sortKey: 'spud_date',
      className: 'tabular-nums',
      render: (w) => w.spud_date?.slice(0, 10) ?? '—',
    },
  ];

  return (
    <div>
      <div className="p-3 flex flex-wrap gap-2 border-b border-line">
        <label className="relative">
          <span className="sr-only">{t('explorer.wells.search')}</span>
          <Search className="w-3.5 h-3.5 text-ink-600 absolute left-2 top-2" aria-hidden="true" />
          <input
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
            placeholder={t('explorer.wells.search_placeholder')}
            className={`${inputCls} pl-7 normal-case w-48`}
          />
        </label>
        <select
          aria-label={t('explorer.cols.status')}
          className={inputCls}
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">{t('explorer.any_status')}</option>
          {options.statuses?.map((s) => (
            <option key={s} value={s}>
              {formatStatusWord(s)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('map.filters.formation')}
          className={inputCls}
          value={filters.formation}
          onChange={(e) => setFilter('formation', e.target.value)}
        >
          <option value="">{t('explorer.any_formation')}</option>
          {options.formations?.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          aria-label={t('map.filters.well_type')}
          className={inputCls}
          value={filters.trajectory_type}
          onChange={(e) => setFilter('trajectory_type', e.target.value)}
        >
          <option value="">{t('explorer.any_well_type')}</option>
          {options.trajectory_types?.map((tt) => (
            <option key={tt} value={tt}>
              {formatStatusWord(tt)}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="m-3 p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </p>
      )}
      <DataTable
        columns={columns}
        rows={data.wells}
        rowKey={(w) => w.well_id}
        sort={sort}
        onSort={(s) => {
          setSort(s);
          setPage(1);
        }}
        expandedKey={expanded}
        onToggle={(k) => setExpanded(expanded === k ? null : k)}
        renderExpanded={(w) => <WellDetail well={w} onShowEvents={onShowEvents} />}
        loading={loading}
        emptyText={t('explorer.wells.empty')}
      />
      <Pagination page={page} limit={LIMIT} total={data.total} onPage={setPage} />
    </div>
  );
}
