import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, MessageSquare, Search, Mic, MicOff, Send, Sparkles, Gauge } from 'lucide-react';
import { knowledgeApi } from '../api/knowledge';
import { wellsApi } from '../api/wells';
import { apiErrorMessage } from '../api/client';
import { useMapStore } from '../store/mapStore';
import { useAuthStore, canReview } from '../store/authStore';
import AnswerCard from '../components/knowledge/AnswerCard';
import CitationViewer from '../components/knowledge/CitationViewer';
import LessonEditor from '../components/knowledge/LessonEditor';
import { EVENT_TYPE_COLORS, formatEventType } from '../components/map/eventStyles';

const inputCls =
  'text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none';

/** Browser speech-to-text (Web Speech API - free, runs in Chrome/Edge). */
function useSpeech(onText) {
  const Rec =
    typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const start = () => {
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };
  const stop = () => recRef.current?.stop();
  return { supported: Boolean(Rec), listening, start, stop };
}

/** Search hit -> citation shape used by the viewer. */
const hitToCitation = (h, i) => ({
  n: i + 1,
  kind: h.kind,
  doc_id: h.doc_id,
  filename: h.filename,
  page: h.page,
  bbox: h.bbox,
  snippet: h.snippet,
  well_id: h.well_id,
  type: h.event_type,
  formation: (h.formations || [])[0],
  depth_from_md: h.depth_range?.[0],
  depth_to_md: h.depth_range?.[1],
});

function AskPanel({ wellIds, onCite, activeCitation, onSaveLesson }) {
  const activeWell = useMapStore((s) => s.activeWell);
  const user = useAuthStore((s) => s.user);
  const [wellId, setWellId] = useState(activeWell?.well_id || '');
  const [radius, setRadius] = useState(10);
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const endRef = useRef(null);
  const speech = useSpeech((t) => setQuestion((q) => (q ? `${q} ${t}` : t)));

  useEffect(() => {
    knowledgeApi
      .suggestions(wellId || undefined)
      .then((res) => setSuggestions(res.data.questions))
      .catch(() => setSuggestions([]));
  }, [wellId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread.length]);

  const ask = async (q) => {
    const text = (q ?? question).trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    setQuestion('');
    try {
      const res = await knowledgeApi.ask({
        question: text,
        well_id: wellId || undefined,
        radius_km: wellId ? radius : undefined,
      });
      setThread((t) => [...t, res.data]);
      const first = res.data.citations.find((c) => c.doc_id) || res.data.citations[0];
      if (first) onCite({ ...first, _answer: res.data.answer_id });
    } catch (err) {
      setError(apiErrorMessage(err, 'The advisor could not answer.'));
      setQuestion(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-h-[600px]">
      <div className="flex flex-wrap items-center gap-2 text-xs bg-royal-50 border border-royal-100 rounded-lg p-2.5">
        <span className="text-ink-600">Context well</span>
        <select value={wellId} onChange={(e) => setWellId(e.target.value)} className={inputCls}>
          <option value="">None (whole field)</option>
          {wellIds.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        {wellId && (
          <>
            <span className="text-ink-600">offsets within</span>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className={inputCls}
            >
              {[5, 10, 20, 50].map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>
          </>
        )}
        <span className="text-[10px] text-ink-600">
          Used when a question says “offset/nearby wells”.
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto max-h-[58vh] pr-1" aria-live="polite">
        {thread.length === 0 && (
          <div className="text-center py-8 text-xs text-ink-600">
            <Sparkles className="w-8 h-8 mx-auto text-gold-500 mb-2" aria-hidden="true" />
            Ask about offset-well history. Answers use only recorded events and reports, and every
            statement is cited.
          </div>
        )}
        {thread.map((r) => (
          <div key={r.answer_id} className="space-y-1.5">
            <p className="ml-auto max-w-[85%] w-fit bg-royal-700 text-white text-sm rounded-xl rounded-br-sm px-3 py-2">
              {r.question}
            </p>
            <AnswerCard
              result={r}
              activeCitation={activeCitation}
              onCite={(c) => onCite({ ...c, _answer: r.answer_id })}
              onSaveLesson={onSaveLesson}
              canCurate={canReview(user)}
            />
          </div>
        ))}
        {busy && (
          <p className="text-xs text-royal-700 animate-pulse">
            Searching records and checking citations…
          </p>
        )}
        <div ref={endRef} />
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Suggested questions">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={busy}
              className="text-[11px] text-left bg-white border border-line hover:border-royal-500 hover:bg-royal-50 rounded-full px-2.5 py-1 text-royal-900 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded">{error}</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="flex items-end gap-2"
      >
        <label className="flex-1">
          <span className="sr-only">Question</span>
          <textarea
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="e.g. What mud losses occurred near 2,400 m in the Namsang within 10 km, and how were they handled?"
            className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-royal-600 focus:outline-none resize-none"
          />
        </label>
        {speech.supported && (
          <button
            type="button"
            onClick={speech.listening ? speech.stop : speech.start}
            className={`p-2.5 rounded-lg border ${speech.listening ? 'bg-red-50 border-red-300 text-red-700 animate-pulse' : 'border-line text-royal-700 hover:bg-royal-50'}`}
            aria-label={speech.listening ? 'Stop voice input' : 'Ask by voice'}
            title="Voice input (browser speech recognition)"
          >
            {speech.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
        <button
          type="submit"
          disabled={busy || question.trim().length < 3}
          className="flex items-center gap-1 bg-royal-700 hover:bg-royal-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg disabled:opacity-50"
        >
          <Send className="w-4 h-4" aria-hidden="true" /> Ask
        </button>
      </form>
    </div>
  );
}

function SearchPanel({ options, wellIds, onCite, activeCitation }) {
  const activeWell = useMapStore((s) => s.activeWell);
  const [query, setQuery] = useState('');
  const [f, setF] = useState({
    formation: '',
    event_type: '',
    depth_from: '',
    depth_to: '',
    kind: '',
    well_id: '',
    radius_km: '',
  });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const run = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await knowledgeApi.search({
        query,
        formation: f.formation,
        event_types: f.event_type ? [f.event_type] : undefined,
        depth_from: f.depth_from === '' ? undefined : Number(f.depth_from),
        depth_to: f.depth_to === '' ? undefined : Number(f.depth_to),
        kind: f.kind,
        well_id: f.well_id,
        radius_km: f.well_id && f.radius_km ? Number(f.radius_km) : undefined,
        limit: 20,
      });
      setResult(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Search failed.'));
    } finally {
      setBusy(false);
    }
  };

  const hits = useMemo(() => (result?.results || []).map(hitToCitation), [result]);

  return (
    <div className="space-y-3">
      <form onSubmit={run} className="space-y-2">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search the knowledge base</span>
            <Search className="w-4 h-4 text-ink-600 absolute left-2.5 top-2.5" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. lost circulation cured with LCM pill"
              className="w-full text-sm border border-line rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-royal-600 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="bg-royal-700 hover:bg-royal-900 text-white text-sm px-4 rounded-lg disabled:opacity-50"
          >
            Search
          </button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            aria-label="Formation"
            className={inputCls}
            value={f.formation}
            onChange={set('formation')}
          >
            <option value="">Any formation</option>
            {options.formations?.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Event type"
            className={`${inputCls} capitalize`}
            value={f.event_type}
            onChange={set('event_type')}
          >
            <option value="">Any event type</option>
            {options.event_types?.map((x) => (
              <option key={x} value={x}>
                {formatEventType(x)}
              </option>
            ))}
          </select>
          <input
            aria-label="Depth from"
            type="number"
            placeholder="From m"
            className={`${inputCls} w-24`}
            value={f.depth_from}
            onChange={set('depth_from')}
          />
          <input
            aria-label="Depth to"
            type="number"
            placeholder="To m"
            className={`${inputCls} w-24`}
            value={f.depth_to}
            onChange={set('depth_to')}
          />
          <select
            aria-label="Source kind"
            className={inputCls}
            value={f.kind}
            onChange={set('kind')}
          >
            <option value="">Reports + events</option>
            <option value="document">Reports only</option>
            <option value="event">Event records only</option>
          </select>
          <select
            aria-label="Well scope"
            className={inputCls}
            value={f.well_id}
            onChange={set('well_id')}
          >
            <option value="">All wells</option>
            {activeWell && <option value={activeWell.well_id}>Active: {activeWell.well_id}</option>}
            {wellIds.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          {f.well_id && (
            <select
              aria-label="Radius"
              className={inputCls}
              value={f.radius_km}
              onChange={set('radius_km')}
            >
              <option value="">This well only</option>
              {[5, 10, 20].map((r) => (
                <option key={r} value={r}>
                  + offsets within {r} km
                </option>
              ))}
            </select>
          )}
        </div>
      </form>
      {error && (
        <p className="p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded">{error}</p>
      )}
      {result && (
        <p className="text-[11px] text-ink-600 tabular-nums">
          {result.results.length} result(s) from {result.candidates} indexed chunk(s) after filters
          · {result.took_ms} ms · {result.embedding_model} + keyword index
        </p>
      )}
      <ul className="space-y-2" aria-busy={busy}>
        {(result?.results || []).map((h, i) => {
          const c = hits[i];
          const active = activeCitation?._search && activeCitation.n === c.n;
          return (
            <li key={h.chunk_id}>
              <button
                type="button"
                onClick={() => onCite({ ...c, _search: true })}
                className={`w-full text-left border rounded-lg p-3 text-xs ${active ? 'border-royal-600 bg-royal-50' : 'border-line hover:bg-royal-50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-royal-900 flex items-center gap-1.5">
                    {h.kind === 'event' ? (
                      <>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: EVENT_TYPE_COLORS[h.event_type] }}
                          aria-hidden="true"
                        />
                        <span className="capitalize">{formatEventType(h.event_type)}</span> ·{' '}
                        {h.well_id}
                      </>
                    ) : (
                      <>
                        {h.filename} · p.{h.page}
                      </>
                    )}
                  </span>
                  <span className="text-[10px] text-ink-600 tabular-nums">
                    {h.vector_similarity != null && `sim ${h.vector_similarity.toFixed(2)}`}
                    {h.keyword_score != null && ` · kw ${h.keyword_score.toFixed(1)}`}
                  </span>
                </div>
                <p className="mt-1 text-ink-900">{h.snippet}</p>
                <p className="mt-1 text-[10px] text-ink-600">
                  {(h.formations || []).join(', ')}
                  {h.depth_range && ` · ${h.depth_range[0]}–${h.depth_range[1]} m`}
                  {h.section && h.kind === 'document' && ` · ${h.section}`}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BenchmarkBadge() {
  const [m, setM] = useState(null);
  useEffect(() => {
    knowledgeApi
      .metrics()
      .then((r) => setM(r.data))
      .catch(() => {});
  }, []);
  const b = m?.latest_benchmark;
  if (!b) return null;
  return (
    <span
      className="text-[11px] text-ink-600 flex items-center gap-1 tabular-nums"
      title="scripts/evaluate_advisor.py"
    >
      <Gauge className="w-3.5 h-3.5 text-royal-700" aria-hidden="true" />
      Benchmark: {b.passed}/{b.questions} questions with correct citations · citation precision{' '}
      {b.mean_event_citation_precision}
    </span>
  );
}

export default function Knowledge() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'search' ? 'search' : 'ask';
  const [citation, setCitation] = useState(null);
  const [options, setOptions] = useState({});
  const [wellIds, setWellIds] = useState([]);
  const [lessonEvents, setLessonEvents] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    Promise.all([wellsApi.getFilterOptions(), wellsApi.listWells({ limit: 100, sort: 'well_id' })])
      .then(([o, w]) => {
        setOptions(o.data);
        setWellIds(w.data.wells.map((x) => x.well_id));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-xl border border-line shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-royal-700 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" /> Knowledge repository
          </span>
          <h2 className="text-xl font-bold text-royal-900 font-serif">Ask NWIS</h2>
          <p className="text-xs text-ink-600 mt-1">
            Questions are answered only from recorded events and uploaded reports - click a citation
            to see the page.
          </p>
          <BenchmarkBadge />
        </div>
        <div
          role="tablist"
          aria-label="Knowledge view"
          className="flex bg-royal-50 border border-line rounded-lg p-1 gap-1"
        >
          {[
            ['ask', 'Ask NWIS', MessageSquare],
            ['search', 'Search', Search],
          ].map(([k, label, Icon]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setParams({ tab: k })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                tab === k
                  ? 'bg-royal-700 text-white'
                  : 'text-ink-600 hover:bg-royal-100 hover:text-royal-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </div>

      {saved && (
        <p className="p-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
          Lesson “{saved.title}” saved to the Lessons library.
        </p>
      )}

      <div className="grid lg:grid-cols-5 gap-4">
        <section
          className="lg:col-span-3 bg-white rounded-xl border border-line shadow-sm p-4"
          role="tabpanel"
        >
          {tab === 'ask' ? (
            <AskPanel
              wellIds={wellIds}
              onCite={setCitation}
              activeCitation={citation}
              onSaveLesson={setLessonEvents}
            />
          ) : (
            <SearchPanel
              options={options}
              wellIds={wellIds}
              onCite={setCitation}
              activeCitation={citation}
            />
          )}
        </section>
        <div className="lg:col-span-2 lg:sticky lg:top-4 self-start w-full">
          {citation ? (
            <CitationViewer citation={citation} onClose={() => setCitation(null)} />
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-line p-6 text-center text-xs text-ink-600 min-h-[300px] flex items-center justify-center">
              Click a citation or a search result to open the source page with the evidence
              highlighted.
            </div>
          )}
        </div>
      </div>

      {lessonEvents && (
        <LessonEditor
          eventIds={lessonEvents}
          onClose={() => setLessonEvents(null)}
          onSaved={(l) => {
            setLessonEvents(null);
            setSaved(l);
          }}
        />
      )}
    </div>
  );
}
