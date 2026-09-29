import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  FileDown,
  Gauge,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuthStore, canActOnAlerts, isAdmin } from '../store/authStore';
import { useMapStore } from '../store/mapStore';
import { wellsApi } from '../api/wells';
import { alertsApi, downloadBriefPdf, riskApi, simulatorApi } from '../api/risk';
import { apiErrorMessage } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import RiskRibbon from '../components/risk/RiskRibbon';
import RiskDetail from '../components/risk/RiskDetail';
import AlertFeed from '../components/risk/AlertFeed';
import ParamMiniCharts from '../components/risk/ParamMiniChart';
import SimulatorPanel from '../components/risk/SimulatorPanel';
import { RiskLevelChip } from '../components/risk/LevelChip';
import { appendRecords, fmtPct, levelFor, mergeAlerts } from '../components/risk/riskUtils';

const WELL_KEY = 'nwis_risk_well';
const SOUND_KEY = 'nwis_alert_sound';
const LIVE_RECORDS = 200;

function readStored(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

/** Two short tones for a critical alert (configurable, off by default). */
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    /* audio unavailable */
  }
}

const matchesFilters = (a, f) =>
  (!f.status ||
    (f.status === 'active' ? ['open', 'ack'].includes(a.status) : a.status === f.status)) &&
  (!f.level || a.level === f.level);

export default function RiskAlerts() {
  const { t } = useTranslation();
  const [briefBusy, setBriefBusy] = useState(false);
  const user = useAuthStore((s) => s.user);
  const activeWellId = useMapStore((s) => s.activeWellId);
  const radiusKm = useMapStore((s) => s.radiusKm);

  const [wells, setWells] = useState([]);
  const [replayable, setReplayable] = useState([]);
  const [wellId, setWellId] = useState(() => readStored(WELL_KEY, null));
  const [run, setRun] = useState(null);
  const [records, setRecords] = useState([]);
  const [risk, setRisk] = useState(null);
  const [depth, setDepth] = useState(0);
  const [selectedType, setSelectedType] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [filters, setFilters] = useState({ status: 'active', level: '' });
  const [freshIds, setFreshIds] = useState(() => new Set());
  const [banner, setBanner] = useState(null);
  const [soundOn, setSoundOn] = useState(() => readStored(SOUND_KEY, false));
  const [busy, setBusy] = useState(false);
  const [busyAlert, setBusyAlert] = useState(null);
  const [model, setModel] = useState(null);
  const [error, setError] = useState(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const live = run?.status === 'running';

  // Wells, replayable wells, running replays, model metrics
  useEffect(() => {
    Promise.all([wellsApi.listWells({ limit: 100 }), simulatorApi.status(), riskApi.model()])
      .then(([w, s, m]) => {
        setWells(w.data.wells);
        setReplayable(s.data.replayable_wells);
        setModel(m.data);
        const running = s.data.runs.find((r) => r.status === 'running');
        setWellId((cur) => {
          if (running) return running.well_id;
          if (cur && w.data.wells.some((x) => x.well_id === cur)) return cur;
          if (activeWellId) return activeWellId;
          return s.data.replayable_wells[0] || w.data.wells[0]?.well_id || null;
        });
      })
      .catch((err) => setError(apiErrorMessage(err, 'Could not load wells.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wellId) writeStored(WELL_KEY, wellId);
  }, [wellId]);

  // Well change: recover the live state (if a replay exists) over REST
  useEffect(() => {
    if (!wellId) return undefined;
    let cancelled = false;
    setRun(null);
    setRecords([]);
    setRisk(null);
    setSelectedType(null);
    setBanner(null);
    simulatorApi
      .snapshot(wellId)
      .then((res) => {
        if (cancelled) return;
        const snap = res.data;
        setRun(snap.status);
        setRecords(snap.records || []);
        if (snap.risk) setRisk(snap.risk);
        setDepth(snap.status ? Math.round(snap.status.depth_md) : 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wellId]);

  // Live feed
  const onLive = useCallback((msg) => {
    if (msg.type === 'snapshot') {
      setRun(msg.status);
      if (msg.records?.length) setRecords(msg.records.slice(-LIVE_RECORDS));
      if (msg.risk) setRisk(msg.risk);
    } else if (msg.type === 'live') {
      setRun(msg.status);
      setRecords((cur) => appendRecords(cur, msg.records, LIVE_RECORDS));
    } else if (msg.type === 'risk') {
      setRisk(msg.risk);
    } else if (msg.type === 'status') {
      setRun(msg.status);
      if (msg.status?.status !== 'running') setDepth(Math.round(msg.status.depth_md));
    }
  }, []);
  const liveState = useWebSocket(wellId ? `/ws/live/${wellId}` : null, { onMessage: onLive });

  // No live replay: look-ahead at the chosen depth (debounced), offsets + recorded history
  useEffect(() => {
    if (!wellId || live) return undefined;
    const t = setTimeout(() => {
      riskApi
        .lookahead(wellId, { depth_md: depth, radius_km: radiusKm })
        .then((res) => setRisk(res.data))
        .catch((err) => setError(apiErrorMessage(err, 'Look-ahead failed.')));
    }, 300);
    return () => clearTimeout(t);
  }, [wellId, depth, live, radiusKm]);

  // Alerts: REST list (also replays anything missed while disconnected) + WebSocket push
  const loadAlerts = useCallback(() => {
    if (!wellId) return;
    alertsApi
      .list({ well_id: wellId, status: filters.status, level: filters.level, limit: 100 })
      .then((res) => setAlerts(res.data.alerts))
      .catch((err) => setError(apiErrorMessage(err, 'Could not load alerts.')));
  }, [wellId, filters]);
  useEffect(loadAlerts, [loadAlerts]);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const onAlert = useCallback((msg) => {
    if (msg.type !== 'alert' && msg.type !== 'alert_update') return;
    const a = msg.alert;
    setAlerts((cur) => mergeAlerts(cur, [a]).filter((x) => matchesFilters(x, filtersRef.current)));
    if (msg.type === 'alert') {
      setFreshIds((s) => new Set(s).add(a._id));
      setTimeout(
        () =>
          setFreshIds((s) => {
            const n = new Set(s);
            n.delete(a._id);
            return n;
          }),
        8000
      );
      if (a.level === 'critical') {
        setBanner(a);
        if (soundRef.current) beep();
      }
    }
  }, []);
  const alertsState = useWebSocket(wellId ? `/ws/alerts/${wellId}` : null, {
    onMessage: onAlert,
    onOpen: loadAlerts,
  });

  const act = async (id, action) => {
    setBusyAlert(id);
    try {
      const res = await alertsApi[action](id);
      setAlerts((cur) => mergeAlerts(cur, [res.data]).filter((x) => matchesFilters(x, filters)));
      if (banner?._id === id) setBanner(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Action failed.'));
    } finally {
      setBusyAlert(null);
    }
  };

  const feedback = async (id, useful) => {
    setBusyAlert(id);
    try {
      const res = await alertsApi.feedback(id, useful);
      setAlerts((cur) => mergeAlerts(cur, [res.data.alert]));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save feedback.'));
    } finally {
      setBusyAlert(null);
    }
  };

  const startReplay = async ({ startMd, speed }) => {
    setBusy(true);
    setError(null);
    try {
      const res = await simulatorApi.start({ wellId, speed, startMd, radiusKm });
      setRun(res.data);
      setRecords([]);
      setAlerts([]);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not start the replay.'));
    } finally {
      setBusy(false);
    }
  };

  const stopReplay = async () => {
    setBusy(true);
    try {
      const res = await simulatorApi.stop(wellId);
      setRun(res.data);
      setDepth(Math.round(res.data.depth_md));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not stop the replay.'));
    } finally {
      setBusy(false);
    }
  };

  const brief = async () => {
    setBriefBusy(true);
    try {
      await downloadBriefPdf(wellId, radiusKm);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the brief.'));
    } finally {
      setBriefBusy(false);
    }
  };

  const toggleSound = () => {
    setSoundOn((v) => {
      writeStored(SOUND_KEY, !v);
      if (!v) beep(); // confirm, and unlock audio after a user gesture
      return !v;
    });
  };

  const well = wells.find((w) => w.well_id === wellId);
  const td = well?.total_depth_md || risk?.total_depth_md || 4000;
  const selected = useMemo(
    () => risk?.risks?.find((r) => r.type === selectedType) || risk?.risks?.[0] || null,
    [risk, selectedType]
  );
  const replay = model?.metrics?.replay;

  return (
    <div className="space-y-4">
      {/* Header + controls */}
      <div className="bg-white p-4 rounded-xl border border-line shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-royal-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" /> Phase 6 · Risk & alert
                agents
              </span>
              <h2 className="text-xl font-bold text-royal-900 font-serif">{t('risk.title')}</h2>
              <p className="text-xs text-ink-600 mt-0.5">
                Look-ahead risk from offset wells within {radiusKm} km and live drilling parameters.
                Offset wells suggest - the drilling engineer decides.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-2">
                <span className="text-ink-600">Well</span>
                <select
                  value={wellId || ''}
                  onChange={(e) => setWellId(e.target.value)}
                  className="text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none"
                >
                  {wells.map((w) => (
                    <option key={w.well_id} value={w.well_id}>
                      {w.well_id} · {w.status}
                      {replayable.includes(w.well_id) ? ' · replayable' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {!live && (
                <label className="flex items-center gap-2">
                  <span className="text-ink-600">Bit depth</span>
                  <input
                    type="range"
                    min="0"
                    max={Math.round(td)}
                    step="10"
                    value={depth}
                    onChange={(e) => setDepth(Number(e.target.value))}
                    className="w-40 accent-royal-700"
                    aria-label="Bit depth for the look-ahead"
                  />
                  <input
                    type="number"
                    min="0"
                    max={Math.round(td)}
                    step="10"
                    value={depth}
                    onChange={(e) => setDepth(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 border border-line rounded-md px-2 py-1 tabular-nums focus:ring-2 focus:ring-royal-600 focus:outline-none"
                  />
                  <span className="text-ink-600">m MD</span>
                </label>
              )}
              <button
                type="button"
                onClick={toggleSound}
                aria-pressed={soundOn}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-line bg-white text-[11px] text-royal-900 hover:bg-royal-100"
              >
                {soundOn ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                Critical sound {soundOn ? 'on' : 'off'}
              </button>
              <button
                type="button"
                onClick={brief}
                disabled={!wellId || briefBusy}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-royal-700 bg-white text-[11px] text-royal-700 font-medium hover:bg-royal-100 disabled:opacity-50"
              >
                <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                {briefBusy ? t('common.loading') : t('risk.brief_pdf')}
              </button>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-100 text-[#6B5310] border border-gold-500/40">
                {t('app.synthetic')}
              </span>
            </div>
          </div>
          <div className="w-full sm:w-80 bg-royal-50 border border-royal-100 rounded-lg p-3">
            <SimulatorPanel
              run={run}
              isAdmin={isAdmin(user)}
              canReplay={replayable.includes(wellId)}
              busy={busy}
              onStart={startReplay}
              onStop={stopReplay}
              wsState={liveState}
            />
          </div>
        </div>
      </div>

      {banner && (
        <div
          role="alert"
          className="flex items-start gap-3 p-3 rounded-xl border-2 border-[#C62D3B] bg-[#FDECEE] shadow-sm"
        >
          <AlertOctagon className="w-6 h-6 text-[#C62D3B] shrink-0" aria-hidden="true" />
          <div className="flex-1 text-xs">
            <p className="font-bold text-[#8F1D28] uppercase tracking-wide text-[11px]">
              Critical alert · {banner.well_id} · bit{' '}
              {Math.round(banner.depth_md).toLocaleString('en-IN')} m
            </p>
            <p className="font-semibold text-royal-900 text-sm">{banner.title}</p>
            <p className="text-ink-900">{banner.message}</p>
          </div>
          {canActOnAlerts(user) && banner.status === 'open' && (
            <button
              type="button"
              onClick={() => act(banner._id, 'ack')}
              className="px-3 py-1.5 rounded-lg bg-royal-700 hover:bg-royal-900 text-white text-xs font-medium"
            >
              Acknowledge
            </button>
          )}
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="p-1 rounded hover:bg-white"
            aria-label="Hide banner"
          >
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>
      )}

      {error && (
        <p className="p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded flex justify-between">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
            <X className="w-3.5 h-3.5" />
          </button>
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[auto,minmax(0,1fr),380px] lg:grid-cols-[auto,minmax(0,1fr)]">
        {/* Ribbon */}
        <section
          className="bg-white p-3 rounded-xl border border-line shadow-sm"
          aria-label="Risk ribbon"
        >
          <h3 className="text-sm font-bold text-royal-900 mb-1">Look-ahead ribbon</h3>
          <p className="text-[11px] text-ink-600 mb-2 tabular-nums">
            Bit {risk ? Math.round(risk.depth_md).toLocaleString('en-IN') : '—'} m MD
            {risk?.formation && ` · ${risk.formation}`} · next {risk?.window_m ?? 300} m
          </p>
          {risk ? (
            <RiskRibbon
              ribbon={risk.ribbon}
              depth={risk.depth_md}
              horizonM={risk.horizon_m}
              selectedType={selected?.type}
              onSelectType={setSelectedType}
            />
          ) : (
            <p className="text-xs text-ink-600 animate-pulse">Loading…</p>
          )}
        </section>

        {/* Risk summary + detail */}
        <section className="bg-white p-4 rounded-xl border border-line shadow-sm space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-royal-900 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-royal-700" aria-hidden="true" /> Risks in the next{' '}
              {risk?.horizon_m ?? 150} m
            </h3>
            {risk && (
              <span className="text-[10px] text-ink-600">
                {risk.live ? 'Offset history + live parameters' : 'Offset history only'} ·{' '}
                {risk.n_offsets} offset wells
                {risk.model_version && ` · ${risk.model_version}`}
              </span>
            )}
          </div>
          {risk?.warnings?.length > 0 && (
            <p className="text-[11px] p-2 rounded bg-gold-100 text-[#6B5310] border border-gold-500/40">
              {risk.warnings.join(' ')}
            </p>
          )}
          {risk && (
            <ul className="grid sm:grid-cols-2 gap-1.5">
              {risk.risks.map((r) => {
                const l = levelFor(r.probability);
                const active = r.type === selected?.type;
                return (
                  <li key={r.type}>
                    <button
                      type="button"
                      onClick={() => setSelectedType(r.type)}
                      aria-pressed={active}
                      className={`w-full text-left p-2 rounded-lg border text-xs ${
                        active ? 'border-royal-700 bg-royal-100' : 'border-line hover:bg-royal-50'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-royal-900">{r.label}</span>
                        <RiskLevelChip p={r.probability} />
                      </span>
                      <span className="flex items-center gap-2 mt-1">
                        <span className="flex-1 h-1.5 bg-royal-50 rounded" aria-hidden="true">
                          <span
                            className="block h-1.5 rounded"
                            style={{
                              width: `${Math.max(2, r.probability * 100)}%`,
                              background: l.color,
                            }}
                          />
                        </span>
                        <span className="tabular-nums text-ink-600 w-9 text-right">
                          {fmtPct(r.probability)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {selected && (
            <div className="border-t border-line pt-3">
              <RiskDetail risk={selected} assessment={risk} />
            </div>
          )}
        </section>

        {/* Alerts */}
        <section
          className="bg-white p-3 rounded-xl border border-line shadow-sm xl:col-auto lg:col-span-2 xl:col-span-1"
          aria-label="Alerts"
        >
          <h3 className="text-sm font-bold text-royal-900 mb-2 flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-royal-700" aria-hidden="true" /> Alerts · {wellId}
            <span className="ml-auto text-[10px] font-normal text-ink-600">
              {alertsState === 'open' ? 'live' : alertsState}
            </span>
          </h3>
          <AlertFeed
            alerts={alerts}
            filters={filters}
            onFilters={setFilters}
            canAct={canActOnAlerts(user)}
            busyId={busyAlert}
            onAction={act}
            onFeedback={feedback}
            freshIds={freshIds}
          />
        </section>
      </div>

      {/* Live parameters */}
      <section className="bg-white p-4 rounded-xl border border-line shadow-sm">
        <h3 className="text-sm font-bold text-royal-900 mb-2">
          Live parameters{' '}
          <span className="text-[11px] font-normal text-ink-600">
            {records.length ? `last ${records.length} records` : ''}
          </span>
        </h3>
        <ParamMiniCharts records={records} />
      </section>

      {model && (
        <p className="text-[11px] text-ink-600">
          {model.trained ? (
            <>
              Model {model.version} · trained on {model.training_wells?.length} replayed wells
              (synthetic){' '}
              {replay &&
                `· replay: ${Math.round((replay.event_recall || 0) * 100)} % of events warned, median lead ${replay.median_lead_m} m, ${replay.serious_false_per_1000m} false warnings per 1000 m`}
            </>
          ) : (
            'No trained model - offset prior and live-anomaly rules are used (cold start).'
          )}
        </p>
      )}
    </div>
  );
}
