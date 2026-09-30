import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, ShieldCheck, FileSearch, BookmarkPlus } from 'lucide-react';
import { eventsApi } from '../../api/wells';
import { apiErrorMessage } from '../../api/client';
import { useAuthStore, canReview } from '../../store/authStore';
import DataTable, { Pagination } from '../common/DataTable';
import { EVENT_TYPE_COLORS, formatEventType } from '../map/eventStyles';
import LessonEditor from '../knowledge/LessonEditor';

const LIMIT = 20;
const inputCls =
  'text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none capitalize';

const STATUS_CHIP = {
  verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  auto: 'bg-royal-50 text-royal-700 border-royal-100',
};

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

function EventDetail({ event, reviewer, onReviewed }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ctx = event.drilling_context || {};
  const impact = event.impact || {};

  const review = async (status) => {
    setBusy(true);
    setError(null);
    try {
      const res = await eventsApi.updateEvent(event._id, { extraction: { status } });
      onReviewed(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, t('explorer.events.review_failed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-4 text-xs">
      <div className="md:col-span-2 space-y-1.5">
        <p>
          <span className="text-ink-600">{t('explorer.events.description')}:</span>{' '}
          {event.description || '—'}
        </p>
        <p>
          <span className="text-ink-600">{t('explorer.events.cause')}:</span> {event.cause || '—'}
        </p>
        <p>
          <span className="text-ink-600">{t('map.drawer.mitigation')}:</span>{' '}
          <b className="text-royal-900">{event.mitigation || '—'}</b>
        </p>
        <p>
          <span className="text-ink-600">{t('explorer.events.outcome')}:</span>{' '}
          {event.outcome || '—'}
        </p>
        <p className="tabular-nums">
          <span className="text-ink-600">{t('explorer.events.impact')}:</span>{' '}
          {t('explorer.events.impact_line', {
            npt: impact.npt_hours ?? '—',
            cost: impact.cost_inr?.toLocaleString('en-IN') ?? '—',
          })}
          {impact.volume_lost_bbl != null &&
            ` · ${t('explorer.events.lost', { bbl: impact.volume_lost_bbl })}`}
        </p>
      </div>
      <div className="space-y-2">
        <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700">
          {t('explorer.events.context')}
        </h4>
        <p className="tabular-nums text-ink-900">
          MW {ctx.mud_weight ?? '—'} sg · ROP {ctx.rop ?? '—'} m/h · WOB {ctx.wob ?? '—'} t · RPM{' '}
          {ctx.rpm ?? '—'} · Torque {ctx.torque ?? '—'} · SPP {ctx.spp ?? '—'} psi · Flow{' '}
          {ctx.flow_in ?? '—'} gpm
        </p>
        <p className="text-ink-600">
          {t('explorer.events.extraction', {
            model: event.extraction?.model_version || '—',
            conf:
              event.extraction?.confidence != null
                ? Math.round(event.extraction.confidence * 100) + '%'
                : '—',
          })}
          {event.extraction?.verified_by &&
            ` · ${t('explorer.events.reviewed_by', { who: event.extraction.verified_by })}`}
        </p>
        <p>
          {event.source?.doc_id && !event.source.doc_deleted ? (
            <Link
              to={`/documents/${event.source.doc_id}?page=${event.source.page || 1}${
                event.source.bbox ? `&bbox=${event.source.bbox.join(',')}` : ''
              }`}
              className="inline-flex items-center gap-1 text-royal-600 hover:underline font-medium"
            >
              <FileSearch className="w-3.5 h-3.5" aria-hidden="true" />{' '}
              {t('explorer.events.view_source', { page: event.source.page })}
            </Link>
          ) : (
            <span className="text-ink-600">{t('explorer.events.no_source')}</span>
          )}
        </p>
        {reviewer && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || event.extraction?.status === 'verified'}
              onClick={() => review('verified')}
              className="flex items-center gap-1 bg-royal-700 hover:bg-royal-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-md disabled:opacity-40"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> {t('explorer.events.verify')}
            </button>
            <button
              type="button"
              disabled={busy || event.extraction?.status === 'rejected'}
              onClick={() => review('rejected')}
              className="flex items-center gap-1 border border-red-600 text-red-700 hover:bg-red-50 text-[11px] font-medium px-2.5 py-1.5 rounded-md disabled:opacity-40"
            >
              <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> {t('explorer.events.reject')}
            </button>
          </div>
        )}
        {error && <p className="text-red-700">{error}</p>}
      </div>
    </div>
  );
}

export default function EventsTab({ options, wellFilter, onWellFilterChange }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const reviewer = canReview(user);
  const [filters, setFilters] = useState({
    type: '',
    formation: '',
    depth_from: '',
    depth_to: '',
    min_severity: '',
    status: '',
  });
  const [sort, setSort] = useState('depth_from_md');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ events: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [selected, setSelected] = useState([]);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [savedLesson, setSavedLesson] = useState(null);
  const toggleSelected = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(0, 50)));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      eventsApi
        .listEvents({ ...filters, well_id: wellFilter, sort, page, limit: LIMIT })
        .then((res) => {
          if (cancelled) return;
          setData(res.data);
          setError(null);
        })
        .catch((err) => !cancelled && setError(apiErrorMessage(err, t('explorer.events.load_error'))))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters, wellFilter, sort, page]);

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const onReviewed = (updated) =>
    setData((d) => ({ ...d, events: d.events.map((e) => (e._id === updated._id ? updated : e)) }));

  const selectColumn = {
    key: 'select',
    label: '',
    render: (e) => (
      <input
        type="checkbox"
        checked={selected.includes(e._id)}
        onClick={(ev) => ev.stopPropagation()}
        onChange={() => toggleSelected(e._id)}
        aria-label={t('explorer.events.select', { well: e.well_id, depth: e.depth_from_md })}
        className="accent-royal-700"
      />
    ),
  };
  const columns = [
    ...(reviewer ? [selectColumn] : []),
    {
      key: 'well_id',
      label: t('explorer.cols.well'),
      sortKey: 'well_id',
      className: 'font-mono text-royal-900',
    },
    {
      key: 'type',
      label: t('explorer.cols.type'),
      sortKey: 'type',
      render: (e) => (
        <span className="inline-flex items-center gap-1.5 capitalize">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: EVENT_TYPE_COLORS[e.type] || '#94A3B8' }}
            aria-hidden="true"
          />
          {formatEventType(e.type)}
        </span>
      ),
    },
    { key: 'formation', label: t('map.filters.formation') },
    {
      key: 'depth',
      label: t('explorer.cols.depth'),
      sortKey: 'depth_from_md',
      className: 'tabular-nums whitespace-nowrap',
      render: (e) => `${e.depth_from_md}–${e.depth_to_md}`,
    },
    {
      key: 'severity',
      label: t('severity.label'),
      sortKey: 'severity',
      render: (e) => <SeverityChip value={e.severity} />,
    },
    {
      key: 'status',
      label: t('explorer.cols.review'),
      render: (e) => {
        const st = e.extraction?.status || 'auto';
        return (
          <span
            className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold capitalize ${STATUS_CHIP[st] || ''}`}
          >
            {t(`explorer.review_status.${st}`, { defaultValue: st })}
          </span>
        );
      },
    },
    {
      key: 'date',
      label: t('explorer.cols.date'),
      sortKey: 'date',
      className: 'tabular-nums',
      render: (e) => e.date?.slice(0, 10) ?? '—',
    },
    { key: 'mitigation', label: t('map.drawer.mitigation'), className: 'max-w-[220px] truncate' },
  ];

  return (
    <div>
      <div className="p-3 flex flex-wrap gap-2 border-b border-line items-center">
        <select
          aria-label={t('explorer.cols.well')}
          className={`${inputCls} normal-case`}
          value={wellFilter}
          onChange={(e) => {
            onWellFilterChange(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('explorer.all_wells')}</option>
          {options.wellIds?.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <select
          aria-label={t('map.filters.event_type')}
          className={inputCls}
          value={filters.type}
          onChange={(e) => setFilter('type', e.target.value)}
        >
          <option value="">{t('explorer.any_type')}</option>
          {options.event_types?.map((et) => (
            <option key={et} value={et}>
              {formatEventType(et)}
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
        <input
          aria-label={t('explorer.depth_from')}
          type="number"
          min={0}
          placeholder={t('explorer.from_m')}
          value={filters.depth_from}
          onChange={(e) => setFilter('depth_from', e.target.value)}
          className={`${inputCls} w-24`}
        />
        <input
          aria-label={t('explorer.depth_to')}
          type="number"
          min={0}
          placeholder={t('explorer.to_m')}
          value={filters.depth_to}
          onChange={(e) => setFilter('depth_to', e.target.value)}
          className={`${inputCls} w-24`}
        />
        <select
          aria-label={t('explorer.min_severity')}
          className={inputCls}
          value={filters.min_severity}
          onChange={(e) => setFilter('min_severity', e.target.value)}
        >
          <option value="">{t('explorer.any_severity')}</option>
          {[2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              ≥ {n}
            </option>
          ))}
        </select>
        <select
          aria-label={t('explorer.review_status_label')}
          className={inputCls}
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">{t('explorer.any_review')}</option>
          {['auto', 'verified', 'rejected'].map((s) => (
            <option key={s} value={s}>
              {t(`explorer.review_status.${s}`)}
            </option>
          ))}
        </select>
        {reviewer && (
          <span className="ml-auto text-[10px] text-emerald-800 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> {t('explorer.can_verify')}
          </span>
        )}
        {reviewer && (
          <button
            type="button"
            disabled={!selected.length}
            onClick={() => setLessonOpen(true)}
            className="flex items-center gap-1 text-[11px] font-medium border border-royal-700 text-royal-700 hover:bg-royal-100 px-2 py-1 rounded-md disabled:opacity-40"
          >
            <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />{' '}
            {t('explorer.create_lesson', { n: selected.length })}
          </button>
        )}
      </div>
      {savedLesson && (
        <p className="m-3 p-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded">
          {t('explorer.lesson_saved', { title: savedLesson.title })}{' '}
          <Link to="/lessons" className="underline">
            {t('explorer.open_lessons')}
          </Link>
        </p>
      )}
      {lessonOpen && (
        <LessonEditor
          eventIds={selected}
          onClose={() => setLessonOpen(false)}
          onSaved={(l) => {
            setLessonOpen(false);
            setSelected([]);
            setSavedLesson(l);
          }}
        />
      )}
      {error && (
        <p className="m-3 p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </p>
      )}
      <DataTable
        columns={columns}
        rows={data.events}
        rowKey={(e) => e._id}
        sort={sort}
        onSort={(s) => {
          setSort(s);
          setPage(1);
        }}
        expandedKey={expanded}
        onToggle={(k) => setExpanded(expanded === k ? null : k)}
        renderExpanded={(e) => (
          <EventDetail event={e} reviewer={reviewer} onReviewed={onReviewed} />
        )}
        loading={loading}
        emptyText={t('explorer.events.empty')}
      />
      <Pagination page={page} limit={LIMIT} total={data.total} onPage={setPage} />
    </div>
  );
}
