import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { apiErrorMessage } from '../../api/client';
import { detailText } from './adminUtils';

const LIMIT = 50;
const input =
  'border border-line rounded-md px-2 py-1.5 text-xs bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none';

export default function AuditTab() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ user: '', entity: '', action: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      adminApi
        .audit({ ...filters, page, limit: LIMIT })
        .then((res) => {
          setData(res.data);
          setError(null);
        })
        .catch((err) => setError(apiErrorMessage(err, i18n.t('admin.audit.load_error'))));
    }, 250);
    return () => clearTimeout(timer);
  }, [filters, page]);

  const set = (key) => (e) => {
    setFilters({ ...filters, [key]: e.target.value });
    setPage(1);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-ink-600">{t('admin.audit.user')}</span>
          <input
            value={filters.user}
            onChange={set('user')}
            className={input}
            placeholder="admin@"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-ink-600">{t('admin.audit.entity')}</span>
          <select value={filters.entity} onChange={set('entity')} className={input}>
            <option value="">{t('admin.audit.any')}</option>
            {data?.entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-ink-600">{t('admin.audit.action')}</span>
          <select value={filters.action} onChange={set('action')} className={input}>
            <option value="">{t('admin.audit.any')}</option>
            {data?.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-ink-600 tabular-nums">
          {data ? `${data.total} entries` : ''}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-royal-50 text-royal-700 uppercase text-[10px] tracking-wider text-left">
              <th className="px-3 py-2">{t('admin.audit.time')}</th>
              <th className="px-3 py-2">{t('admin.audit.user')}</th>
              <th className="px-3 py-2">{t('admin.audit.action')}</th>
              <th className="px-3 py-2">{t('admin.audit.entity')}</th>
              <th className="px-3 py-2">{t('admin.audit.details')}</th>
              <th className="px-3 py-2">{t('admin.audit.ip')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((i) => (
              <tr key={i._id} className="border-b border-line/60 hover:bg-royal-50/50 align-top">
                <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">
                  {new Date(i.ts).toLocaleString('en-IN', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </td>
                <td className="px-3 py-1.5">
                  {i.user} <span className="text-[10px] text-ink-600">{i.role}</span>
                </td>
                <td className="px-3 py-1.5 font-semibold text-royal-900">{i.action}</td>
                <td className="px-3 py-1.5">
                  {i.entity}
                  {i.entity_id && (
                    <span className="block text-[10px] text-ink-600 font-mono break-all">
                      {i.entity_id}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-ink-600 max-w-[360px] break-words">
                  {detailText(i.details)}
                </td>
                <td className="px-3 py-1.5 text-ink-600">{i.ip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="p-1 rounded border border-line disabled:opacity-40"
          aria-label={t('docs.pdf.prev')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
          className="p-1 rounded border border-line disabled:opacity-40"
          aria-label={t('docs.pdf.next')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
