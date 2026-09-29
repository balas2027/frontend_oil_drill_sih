import { useState } from 'react';
import { Play, Square, Timer } from 'lucide-react';

const SPEEDS = [5, 10, 20, 50];

/** Replay control (admin) and live-run status (everyone). */
export default function SimulatorPanel({
  run,
  isAdmin,
  canReplay,
  busy,
  onStart,
  onStop,
  wsState,
}) {
  const [startMd, setStartMd] = useState(0);
  const [speed, setSpeed] = useState(10);
  const running = run?.status === 'running';

  return (
    <div className="space-y-2 text-xs">
      {run ? (
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-royal-900 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${running ? 'bg-emerald-500 animate-pulse' : 'bg-ink-600/40'}`}
                aria-hidden="true"
              />
              Replay {run.status}
            </span>
            <span className="tabular-nums text-ink-600">
              {Math.round(run.depth_md).toLocaleString('en-IN')} /{' '}
              {Math.round(run.total_depth_md).toLocaleString('en-IN')} m · {run.speed_mps} m/s
            </span>
          </div>
          <div className="h-1.5 bg-royal-100 rounded mt-1" aria-hidden="true">
            <div
              className="h-1.5 bg-royal-700 rounded"
              style={{ width: `${Math.round((run.progress || 0) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-ink-600 mt-1">
            {run.alerts_fired} alert(s) fired · feed {wsState === 'open' ? 'connected' : wsState}
            {run.error && <span className="text-red-700"> · {run.error}</span>}
          </p>
        </div>
      ) : (
        <p className="text-ink-600">
          No live feed for this well. Showing the offset-based look-ahead at the chosen depth.
        </p>
      )}

      {isAdmin && canReplay && (
        <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-line">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-ink-600">Start depth (m)</span>
            <input
              type="number"
              min="0"
              step="50"
              value={startMd}
              onChange={(e) => setStartMd(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 border border-line rounded-md px-2 py-1 tabular-nums focus:ring-2 focus:ring-royal-600 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-ink-600">Speed</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="border border-line rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s} m/s
                </option>
              ))}
            </select>
          </label>
          {running ? (
            <button
              type="button"
              disabled={busy}
              onClick={onStop}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5" aria-hidden="true" /> Stop replay
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStart({ startMd, speed })}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-royal-700 hover:bg-royal-900 text-white font-medium disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" /> Replay as live
            </button>
          )}
        </div>
      )}
      {isAdmin && !canReplay && (
        <p className="text-[10px] text-ink-600 flex items-center gap-1">
          <Timer className="w-3 h-3" aria-hidden="true" /> This well has no recorded drilling data
          to replay.
        </p>
      )}
    </div>
  );
}
