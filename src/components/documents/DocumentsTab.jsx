import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentsApi } from '../../api/documents';
import { apiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import DataTable, { Pagination } from '../common/DataTable';
import UploadZone from './UploadZone';
import { DocStatusChip, PipelineStepper } from './DocBadges';

const LIMIT = 15;
const POLL_MS = 2000;

export default function DocumentsTab({ wellIds }) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ documents: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await documentsApi.list({ page, limit: LIMIT });
      setData(res.data);
      setError(null);
      return res.data.documents.some((d) => ['queued', 'processing'].includes(d.status));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load documents.'));
      return false;
    } finally {
      setLoading(false);
    }
  }, [page]);

  // Poll while any document is still in the pipeline
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const busy = await load();
      if (!cancelled && busy) timer.current = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [load]);

  const onUploaded = () => {
    clearTimeout(timer.current);
    const tick = async () => {
      if (await load()) timer.current = setTimeout(tick, POLL_MS);
    };
    tick();
  };

  const columns = [
    {
      key: 'filename',
      label: 'Document',
      render: (d) => (
        <span className="font-medium text-royal-900 break-all">
          {d.filename}
          <span className="block text-[10px] text-ink-600 font-normal">
            {d.doc_type} · {d.pages} p · {d.pdf_kind}
            {d.ocr_mean_conf != null &&
              d.pdf_kind !== 'text' &&
              ` · OCR ${Math.round(d.ocr_mean_conf * 100)}%`}
          </span>
        </span>
      ),
    },
    {
      key: 'well_id',
      label: 'Well',
      className: 'font-mono',
      render: (d) => d.well_id || <span className="text-orange-700 font-sans">unmatched</span>,
    },
    { key: 'status', label: 'Status', render: (d) => <DocStatusChip status={d.status} /> },
    {
      key: 'pipeline',
      label: 'Pipeline',
      render: (d) => (d.job ? <PipelineStepper steps={d.job.steps} compact /> : '—'),
    },
    {
      key: 'items',
      label: 'Extracted',
      className: 'tabular-nums whitespace-nowrap',
      render: (d) => {
        const c = d.review_counts || {};
        if (!Object.keys(c).length) return '—';
        return (
          <span className="text-[11px]">
            {c.auto_accepted || 0} auto · {c.approved || 0} approved ·{' '}
            <b className={c.pending ? 'text-orange-700' : ''}>{c.pending || 0} pending</b> ·{' '}
            {c.rejected || 0} rejected
          </span>
        );
      },
    },
    {
      key: 'uploaded_at',
      label: 'Uploaded',
      className: 'tabular-nums whitespace-nowrap',
      render: (d) =>
        `${d.uploaded_at?.slice(0, 16).replace('T', ' ')} · ${d.uploaded_by?.split('@')[0]}`,
    },
  ];

  return (
    <div>
      <div className="p-4 border-b border-line">
        <UploadZone wellIds={wellIds} onUploaded={onUploaded} disabled={user?.role === 'viewer'} />
      </div>
      {error && (
        <p className="m-3 p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </p>
      )}
      <DataTable
        columns={columns}
        rows={data.documents}
        rowKey={(d) => d._id}
        onToggle={(id) => navigate(`/documents/${id}`)}
        loading={loading}
        emptyText="No documents yet - upload a WCR or DDR PDF above."
      />
      <Pagination page={page} limit={LIMIT} total={data.total} onPage={setPage} />
    </div>
  );
}
