import { describe, it, expect } from 'vitest';
import { initialForm, formEdits } from '../components/documents/reviewForm';
import { PIPELINE_STEPS } from '../api/documents';

const eventItem = {
  kind: 'event',
  values: {
    type: 'mud_loss',
    severity: 3,
    depth_from_md: 753,
    depth_to_md: 787,
    formation: 'Tipam',
    drilling_context: { mud_weight: 1.55 },
    impact: { volume_lost_bbl: 252, npt_hours: null },
    mitigation: 'Spot cement plug',
    outcome: null,
  },
};

describe('review form', () => {
  it('maps canonical item values to the form', () => {
    const f = initialForm(eventItem);
    expect(f).toMatchObject({
      type: 'mud_loss',
      depth_from_md: 753,
      mud_weight: 1.55,
      volume_lost_bbl: 252,
      npt_hours: '',
    });
    expect(
      initialForm({ kind: 'formation_top', values: { formation: 'Tipam', top_md: 513 } })
    ).toEqual({
      formation: 'Tipam',
      top_md: 513,
      base_md: '',
      lithology: '',
    });
  });

  it('sends only changed, non-empty fields, with numbers as numbers', () => {
    const initial = initialForm(eventItem);
    expect(formEdits(initial, { ...initial })).toEqual({});
    const edited = {
      ...initial,
      depth_to_md: '790',
      mitigation: 'Pumped LCM pill',
      npt_hours: '',
      severity: 4,
    };
    expect(formEdits(initial, edited)).toEqual({
      depth_to_md: 790,
      mitigation: 'Pumped LCM pill',
      severity: 4,
    });
  });
});

describe('pipeline steps', () => {
  it('follows the guide order (Section 10.8)', () => {
    expect(PIPELINE_STEPS.map((s) => s.agent)).toEqual([
      'ingestion',
      'ocr',
      'extraction',
      'normalisation',
      'validation',
      'indexing',
    ]);
  });
});
