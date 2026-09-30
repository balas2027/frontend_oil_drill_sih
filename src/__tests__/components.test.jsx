// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import DataTable from '../components/common/DataTable';
import AlertFeed from '../components/risk/AlertFeed';
import { RiskLevelChip } from '../components/risk/LevelChip';
import { RISK_TYPES } from '../components/risk/riskUtils';
import { formatEventType } from '../components/map/eventStyles';
import HotspotPanel from '../components/correlation/HotspotPanel';

vi.mock('../api/documents', () => ({
  documentsApi: { upload: vi.fn() },
  PIPELINE_STEPS: [{ agent: 'ocr' }, { agent: 'extraction' }],
}));

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
afterEach(cleanup);

describe('language switching (item 2)', () => {
  function Probe() {
    const { t } = useTranslation();
    return (
      <p>
        {t('explorer.title')} | {RISK_TYPES[0].label} | {formatEventType('stuck_pipe')}
      </p>
    );
  }

  it('re-renders components and module labels in the chosen language', async () => {
    render(<Probe />);
    expect(screen.getByText(/Data Explorer \| Mud loss \| Stuck pipe/i)).toBeInTheDocument();
    await act(() => i18n.changeLanguage('hi'));
    expect(screen.getByText(/डेटा एक्सप्लोरर/)).toBeInTheDocument();
    await act(() => i18n.changeLanguage('as'));
    expect(screen.getByText(/ডেটা এক্সপ্ল'ৰাৰ/)).toBeInTheDocument();
    expect(localStorage.getItem('nwis_lang')).toBe('as');
    expect(document.documentElement.lang).toBe('as');
  });

  it('keeps identical keys in every language file', async () => {
    const flat = (o, p = '') =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]
      );
    const [en, hi, as] = await Promise.all(
      ['en', 'hi', 'as'].map((l) => import(`../i18n/${l}.json`).then((m) => flat(m.default).sort()))
    );
    expect(hi).toEqual(en);
    expect(as).toEqual(en);
  });
});

describe('DataTable', () => {
  const columns = [
    { key: 'id', label: 'ID', sortKey: 'id' },
    { key: 'name', label: 'Name' },
  ];

  it('renders rows and reports sort changes', async () => {
    const onSort = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[
          { id: 'W1', name: 'Alpha' },
          { id: 'W2', name: 'Beta' },
        ]}
        rowKey={(r) => r.id}
        sort="id"
        onSort={onSort}
      />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: /sort by id/i }));
    expect(onSort).toHaveBeenCalledWith('-id');
  });

  it('shows the empty text', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} emptyText="Nothing" />);
    expect(screen.getByText('Nothing')).toBeInTheDocument();
  });
});

describe('RiskLevelChip', () => {
  it('labels the level with text, not colour alone', () => {
    render(<RiskLevelChip p={0.8} />);
    expect(screen.getByText(/critical|high/i)).toBeInTheDocument();
  });
});

describe('AlertFeed (item 6 UI)', () => {
  const alert = {
    _id: 'a1',
    well_id: 'NWIS-UA-006',
    level: 'critical',
    status: 'open',
    depth_md: 2380,
    ts: '2026-09-30T02:00:00Z',
    title: 'Mud loss ahead',
    message: '3 of 4 offset wells lost circulation in the next 150 m.',
    rule: 'fused_risk',
    evidence: { wells_with_event: ['NWIS-UA-001'], wells_drilled: 4, mitigations: [], events: [] },
    suggested_checks: ['Pre-treat mud with LCM'],
  };
  const props = (over = {}) => ({
    alerts: [alert],
    filters: { status: 'active', level: '' },
    onFilters: vi.fn(),
    canAct: true,
    busyId: null,
    onAction: vi.fn(),
    onFeedback: vi.fn(),
    freshIds: new Set(),
    ...over,
  });

  it('lets an engineer acknowledge and rate an alert', async () => {
    const p = props();
    render(
      <MemoryRouter>
        <AlertFeed {...p} />
      </MemoryRouter>
    );
    expect(screen.getByText('Mud loss ahead')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /acknowledge/i }));
    expect(p.onAction).toHaveBeenCalledWith('a1', 'ack');
    await userEvent.click(screen.getByRole('button', { name: /^useful$/i }));
    expect(p.onFeedback).toHaveBeenCalledWith('a1', true);
    await userEvent.click(screen.getByRole('button', { name: /evidence/i }));
    expect(screen.getByText('Pre-treat mud with LCM')).toBeInTheDocument();
    expect(screen.getByText('Fused risk model')).toBeInTheDocument();
  });

  it('hides actions for viewers and switches filters', async () => {
    const p = props({ canAct: false });
    render(
      <MemoryRouter>
        <AlertFeed {...p} />
      </MemoryRouter>
    );
    expect(screen.queryByRole('button', { name: /acknowledge/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'All' }));
    expect(p.onFilters).toHaveBeenCalledWith({ status: '', level: '' });
  });

  it('shows the empty state in Hindi', async () => {
    await act(() => i18n.changeLanguage('hi'));
    render(
      <MemoryRouter>
        <AlertFeed {...props({ alerts: [] })} />
      </MemoryRouter>
    );
    expect(screen.getByText(/कोई अलर्ट मेल नहीं खाता/)).toBeInTheDocument();
  });
});

describe('HotspotPanel', () => {
  const data = {
    bin_m: 10,
    min_wells: 2,
    wells: [{}, {}, {}],
    hotspots: [
      {
        id: 'h1',
        depth_from: 2400,
        depth_to: 2450,
        n_wells: 2,
        reference_formation: 'Namsang',
        types: { mud_loss: 2 },
        summary: 'Losses in 2 of 3 wells',
        wells: [{ well_id: 'A', md_from: 2401, md_to: 2420 }],
        mitigations: [{ text: 'LCM pill', count: 2 }],
        volume_lost_bbl: 120,
        npt_hours: 6,
        max_severity: 4,
        event_count: 2,
        events: [{ _id: 'e1', type: 'mud_loss', well_id: 'A', depth_from_md: 2401, depth_to_md: 2420, severity: 4 }],
      },
    ],
  };

  it('expands a hotspot and selects its evidence', async () => {
    const onSelect = vi.fn();
    const onSelectEvent = vi.fn();
    const { rerender } = render(
      <HotspotPanel data={data} selectedId={null} onSelect={onSelect} onSelectEvent={onSelectEvent} />
    );
    expect(screen.getByText(/Hotspots \(1\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { expanded: false }));
    expect(onSelect).toHaveBeenCalledWith('h1');
    rerender(
      <HotspotPanel data={data} selectedId="h1" onSelect={onSelect} onSelectEvent={onSelectEvent} />
    );
    expect(screen.getByText('LCM pill')).toBeInTheDocument();
    const evidence = screen.getByText(/Evidence \(2 events\)/).parentElement;
    await userEvent.click(within(evidence).getByRole('button'));
    expect(onSelectEvent).toHaveBeenCalledWith(data.hotspots[0].events[0]);
  });
});

describe('UploadZone', () => {
  it('rejects non-PDF files without calling the API', async () => {
    const { default: UploadZone } = await import('../components/documents/UploadZone');
    const { documentsApi } = await import('../api/documents');
    const { container } = render(<UploadZone wellIds={['W1']} />);
    const input = container.querySelector('input[type=file]');
    await userEvent.upload(input, new File(['x'], 'notes.txt', { type: 'text/plain' }), {
      applyAccept: false,
    });
    expect(await screen.findByText('Only PDF files are accepted')).toBeInTheDocument();
    expect(documentsApi.upload).not.toHaveBeenCalled();
  });
});
