import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, Search, Archive, Trash2, FileText, Tag } from 'lucide-react';
import { lessonsApi } from '../api/knowledge';
import { wellsApi } from '../api/wells';
import { apiErrorMessage } from '../api/client';
import { useAuthStore, canReview, isAdmin } from '../store/authStore';
import { EVENT_TYPE_COLORS, formatEventType } from '../components/map/eventStyles';

const inputCls =
  'text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none';

function LessonCard({ lesson, curator, admin, onChanged }) {
  const [busy, setBusy] = useState(false);
  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="bg-white border border-line rounded-xl shadow-sm p-4 flex flex-col gap-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-royal-900 leading-snug">{lesson.title}</h3>
        {lesson.status !== 'published' && (
          <span className="px-1.5 py-0.5 rounded border border-line bg-slate-50 text-[10px] capitalize">
            {lesson.status}
          </span>
        )}
      </div>
      <dl className="space-y-1">
        {[
          ['What happened', lesson.what_happened],
          ['Cause', lesson.cause],
          ['What worked', lesson.mitigation],
          ['Outcome', lesson.outcome],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] uppercase tracking-wider text-ink-600 font-semibold">
                {k}
              </dt>
              <dd className={k === 'What worked' ? 'font-semibold text-royal-900' : 'text-ink-900'}>
                {v}
              </dd>
            </div>
          ))}
      </dl>
      {lesson.recommendation && (
        <p className="border-l-4 border-gold-500 bg-gold-100/60 px-2.5 py-1.5 rounded-r text-ink-900">
          {lesson.recommendation}
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-royal-700 font-semibold">
          {lesson.events?.length || 0} linked event(s) in {lesson.wells?.length || 0} well(s)
        </summary>
        <ul className="mt-1 max-h-40 overflow-y-auto space-y-0.5">
          {(lesson.events || []).map((e) => (
            <li key={e._id} className="flex items-center justify-between gap-2 tabular-nums">
              <span>
                {e.well_id} · {e.depth_from_md}–{e.depth_to_md} m · {e.outcome || '—'}
              </span>
              {e.doc_id && (
                <Link
                  to={`/documents/${e.doc_id}?page=${e.page || 1}${e.bbox ? `&bbox=${e.bbox.join(',')}` : ''}`}
                  className="text-royal-600 hover:underline inline-flex items-center gap-0.5 shrink-0"
                >
                  <FileText className="w-3 h-3" aria-hidden="true" /> p.{e.page}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </details>
      <div className="flex flex-wrap items-center gap-1 mt-auto pt-2 border-t border-line">
        {(lesson.tags || []).map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-royal-50 text-royal-700 border border-royal-100 text-[10px]"
          >
            <Tag className="w-2.5 h-2.5" aria-hidden="true" /> {t}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-ink-600">{lesson.created_by}</span>
        {curator && lesson.status !== 'archived' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => lessonsApi.update(lesson._id, { status: 'archived' }))}
            className="p-1 rounded hover:bg-royal-100 text-ink-600"
            aria-label="Archive lesson"
            title="Archive"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        )}
        {admin && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              window.confirm('Delete this lesson permanently?') &&
              act(() => lessonsApi.remove(lesson._id))
            }
            className="p-1 rounded hover:bg-red-50 text-red-700"
            aria-label="Delete lesson"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

export default function Lessons() {
  const user = useAuthStore((s) => s.user);
  const [filters, setFilters] = useState({
    q: '',
    risk_type: '',
    formation: '',
    status: 'published',
  });
  const [data, setData] = useState({ lessons: [], total: 0 });
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lessonsApi.list(filters);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load lessons.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    wellsApi
      .getFilterOptions()
      .then((r) => setOptions(r.data))
      .catch(() => {});
  }, []);

  const groups = useMemo(() => {
    const g = {};
    for (const l of data.lessons) (g[l.risk_type] ||= []).push(l);
    return Object.entries(g);
  }, [data]);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-xl border border-line shadow-sm space-y-3">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-royal-700 flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" /> Lessons library
          </span>
          <h2 className="text-xl font-bold text-royal-900 font-serif">
            What offset wells taught us
          </h2>
          <p className="text-xs text-ink-600 mt-1">
            Curated lessons by risk type and formation, each linked to its events and source
            reports. Reviewers create lessons from selected events (Data Explorer) or from an Ask
            NWIS answer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <span className="sr-only">Search lessons</span>
            <Search className="w-3.5 h-3.5 text-ink-600 absolute left-2 top-2" aria-hidden="true" />
            <input
              value={filters.q}
              onChange={set('q')}
              placeholder="Search lessons"
              className={`${inputCls} pl-7 w-56`}
            />
          </label>
          <select
            aria-label="Risk type"
            className={`${inputCls} capitalize`}
            value={filters.risk_type}
            onChange={set('risk_type')}
          >
            <option value="">All risk types</option>
            {options.event_types?.map((t) => (
              <option key={t} value={t}>
                {formatEventType(t)}
              </option>
            ))}
          </select>
          <select
            aria-label="Formation"
            className={inputCls}
            value={filters.formation}
            onChange={set('formation')}
          >
            <option value="">All formations</option>
            {options.formations?.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select
            aria-label="Status"
            className={inputCls}
            value={filters.status}
            onChange={set('status')}
          >
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <span className="text-[11px] text-ink-600 self-center tabular-nums">
            {data.total} lesson(s)
          </span>
        </div>
      </div>

      {error && (
        <p className="p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded">{error}</p>
      )}
      {loading && <p className="text-xs text-royal-700 animate-pulse">Loading lessons…</p>}
      {!loading && data.lessons.length === 0 && (
        <p className="p-8 text-center text-xs text-ink-600 bg-white rounded-xl border border-line">
          No lessons match these filters.
        </p>
      )}

      {groups.map(([risk, lessons]) => (
        <section key={risk} aria-label={formatEventType(risk)}>
          <h3 className="text-xs uppercase font-bold tracking-wider text-royal-900 mb-2 flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: EVENT_TYPE_COLORS[risk] }}
              aria-hidden="true"
            />
            {formatEventType(risk)} ({lessons.length})
          </h3>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {lessons.map((l) => (
              <LessonCard
                key={l._id}
                lesson={l}
                curator={canReview(user)}
                admin={isAdmin(user)}
                onChanged={load}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
