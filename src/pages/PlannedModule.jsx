import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, CheckCircle2, Circle, ArrowRight } from 'lucide-react';

/** Modules scheduled for later phases (Development Guide Section 12). */
const MODULES = {
  alerts: {
    icon: AlertTriangle,
    title: 'Risk & Alerts',
    phase: 'Phase 6',
    summary:
      'Look-ahead risk ribbon for the active well and real-time alerts that fire before the bit reaches depths where offset wells had problems.',
    planned: [
      'Offset-prior risk per 10 m depth bin (similarity-weighted, Beta-smoothed)',
      'Real-time anomaly detectors on live drilling parameters (loss, kick, stuck pipe, torque)',
      'Fusion model with SHAP drivers and supporting offset events',
      'Alert rules with cooldown / dedupe, WebSocket push, acknowledge and "useful?" feedback',
      'Replay of historical wells from drilling_ts as a live feed',
    ],
    ready: [
      {
        to: '/data?tab=drilling',
        label: 'Drilling parameter logs with event signatures (replay data)',
      },
      { to: '/data?tab=events', label: 'Offset events by type, formation and depth' },
      { to: '/map', label: 'Offset wells and similarity ranking' },
    ],
  },
  knowledge: {
    icon: BookOpen,
    title: 'Knowledge Base & Ask NWIS',
    phase: 'Phase 4',
    summary:
      'Hybrid search and a cited advisor over reports and events ("How did offset wells cure losses in Tipam?").',
    planned: [
      'Hybrid search API: structured filters + vector + keyword',
      'Advisor with citation enforcement and self-check',
      'Answer cards that open the PDF page with the highlighted snippet',
      'Lessons library and "create lesson from events"',
    ],
    ready: [
      {
        to: '/documents',
        label: 'Upload reports - they are already chunked, embedded and keyword-indexed',
      },
      { to: '/data?tab=events', label: 'Browse events and open their source PDF page' },
    ],
  },
};

export default function PlannedModule({ module }) {
  const cfg = MODULES[module];
  const Icon = cfg.icon;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="bg-white p-6 rounded-xl border border-line shadow-sm">
        <span className="text-xs uppercase font-bold tracking-wider text-royal-700 flex items-center gap-1.5">
          <Icon className="w-4 h-4" aria-hidden="true" /> {cfg.phase} of the development plan
        </span>
        <h2 className="text-xl font-bold text-royal-900 font-serif mt-1">{cfg.title}</h2>
        <p className="text-sm text-ink-600 mt-1">{cfg.summary}</p>
        <p className="mt-3 inline-block text-[11px] font-semibold px-2 py-1 rounded bg-gold-100 text-[#6B5310] border border-gold-500/40">
          Not built yet - scheduled for {cfg.phase}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-white p-5 rounded-xl border border-line shadow-sm">
          <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-2">
            Planned capabilities
          </h3>
          <ul className="space-y-1.5 text-sm">
            {cfg.planned.map((p) => (
              <li key={p} className="flex gap-2">
                <Circle className="w-3.5 h-3.5 text-ink-600/50 shrink-0 mt-1" aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="bg-white p-5 rounded-xl border border-line shadow-sm">
          <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-2">
            Available today
          </h3>
          <ul className="space-y-1.5 text-sm">
            {cfg.ready.map((r) => (
              <li key={r.label}>
                <Link to={r.to} className="flex gap-2 text-royal-600 hover:underline">
                  <CheckCircle2
                    className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-1"
                    aria-hidden="true"
                  />
                  <span>{r.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-1" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
