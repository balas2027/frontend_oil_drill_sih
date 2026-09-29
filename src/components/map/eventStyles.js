export const EVENT_TYPE_COLORS = {
  mud_loss: '#E8871E',
  kick: '#C62D3B',
  stuck_pipe: '#7C3AED',
  torque_spike: '#D97706',
  overpressure: '#DC2626',
  cementing_issue: '#059669',
  fishing: '#0284C7',
  wellbore_instability: '#6366F1',
  npt: '#64748B',
  other: '#94A3B8',
};

/** Event-density ring scale (colour + label, never colour alone). */
export const EVENT_DENSITY_STOPS = [
  { min: 0, color: '#1E8E5A', label: '0 events' },
  { min: 1, color: '#E0A100', label: '1–2' },
  { min: 3, color: '#E8871E', label: '3–5' },
  { min: 6, color: '#C62D3B', label: '6+' },
];

export const formatEventType = (type) => (type || '').replace(/_/g, ' ');
