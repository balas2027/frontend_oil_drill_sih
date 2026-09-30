import i18n from '../../i18n';

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
  { min: 0, color: '#1E8E5A', get label() { return i18n.t('density.none'); } },
  { min: 1, color: '#E0A100', get label() { return i18n.t('density.few'); } },
  { min: 3, color: '#E8871E', get label() { return i18n.t('density.some'); } },
  { min: 6, color: '#C62D3B', get label() { return i18n.t('density.many'); } },
];

/** Event type in the current UI language (falls back to the raw type). */
export const formatEventType = (type) =>
  type ? i18n.t(`event_types.${type}`, { defaultValue: type.replace(/_/g, ' ') }) : '';

/** Well status / trajectory words in the current UI language. */
export const formatStatusWord = (word) =>
  word ? i18n.t(`status_words.${word}`, { defaultValue: word }) : '';
