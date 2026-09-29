import { AlertOctagon, AlertTriangle, CheckCircle2, Eye, Info } from 'lucide-react';
import { alertLevel, levelFor } from './riskUtils';

const RISK_ICONS = {
  octagon: AlertOctagon,
  triangle: AlertTriangle,
  eye: Eye,
  check: CheckCircle2,
};
const ALERT_ICONS = { info: Info, watch: Eye, warning: AlertTriangle, critical: AlertOctagon };

/** Risk level for a probability: colour + icon + label (never colour alone). */
export function RiskLevelChip({ p, size = 'sm' }) {
  const l = levelFor(p);
  const Icon = RISK_ICONS[l.icon];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold ${
        size === 'lg' ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'
      }`}
      style={{ color: l.color, background: l.bg }}
    >
      <Icon className={size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3'} aria-hidden="true" />
      {l.label}
    </span>
  );
}

/** Alert level chip (info / watch / warning / critical). */
export function AlertLevelChip({ level }) {
  const l = alertLevel(level);
  const Icon = ALERT_ICONS[level] || Info;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ color: l.color, background: l.bg }}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {l.label}
    </span>
  );
}

export function AlertLevelIcon({ level, className = 'w-4 h-4' }) {
  const Icon = ALERT_ICONS[level] || Info;
  return (
    <Icon className={className} style={{ color: alertLevel(level).color }} aria-hidden="true" />
  );
}
