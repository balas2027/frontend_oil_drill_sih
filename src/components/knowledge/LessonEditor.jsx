import { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import { lessonsApi } from '../../api/knowledge';
import { apiErrorMessage } from '../../api/client';

const inputCls =
  'w-full text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none';

/**
 * "Create lesson from events" (Section 10.9): pre-filled from the selected
 * events, edited by a reviewer, then saved to the lessons library.
 */
export default function LessonEditor({ eventIds, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    lessonsApi
      .draft(eventIds)
      .then((res) => {
        const d = res.data;
        setForm({ ...d, tags: (d.tags || []).join(', '), status: 'published' });
      })
      .catch((err) => setError(apiErrorMessage(err, 'Could not prepare the lesson draft.')));
  }, [eventIds]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: form.title,
        risk_type: form.risk_type,
        formation: form.formation || null,
        what_happened: form.what_happened,
        cause: form.cause || null,
        mitigation: form.mitigation,
        outcome: form.outcome || null,
        recommendation: form.recommendation || null,
        event_ids: form.event_ids,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        status: form.status,
      };
      const res = await lessonsApi.create(body);
      onSaved?.(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the lesson.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-royal-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Create lesson">
      <div className="bg-white rounded-xl shadow-xl border border-line w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-royal-50">
          <h3 className="text-sm font-bold text-royal-900">Create lesson from {eventIds.length} event(s)</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-royal-100" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {!form && !error && <p className="p-4 text-xs text-ink-600 animate-pulse">Preparing draft…</p>}
        {error && <p className="m-4 p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded">{error}</p>}
        {form && (
          <div className="p-4 grid grid-cols-2 gap-3 text-xs">
            <label className="col-span-2">
              <span className="font-semibold text-ink-600">Title</span>
              <input className={inputCls} value={form.title} onChange={set('title')} />
            </label>
            <label>
              <span className="font-semibold text-ink-600">Risk type</span>
              <input className={inputCls} value={form.risk_type} onChange={set('risk_type')} />
            </label>
            <label>
              <span className="font-semibold text-ink-600">Formation</span>
              <input className={inputCls} value={form.formation || ''} onChange={set('formation')} />
            </label>
            {[
              ['what_happened', 'What happened'],
              ['cause', 'Cause'],
              ['mitigation', 'Mitigation that worked'],
              ['outcome', 'Outcome'],
              ['recommendation', 'Recommendation for future wells'],
            ].map(([k, label]) => (
              <label key={k} className="col-span-2">
                <span className="font-semibold text-ink-600">{label}</span>
                <textarea rows={2} className={inputCls} value={form[k] || ''} onChange={set(k)} />
              </label>
            ))}
            <label className="col-span-2">
              <span className="font-semibold text-ink-600">Tags (comma separated)</span>
              <input className={inputCls} value={form.tags} onChange={set('tags')} />
            </label>
            <p className="col-span-2 text-[11px] text-ink-600">
              Linked wells: {(form.wells || []).join(', ')} · the lesson links back to each event and its source report.
            </p>
            <div className="col-span-2 flex items-center justify-end gap-2">
              <select className="text-xs border border-line rounded-md px-2 py-1.5" value={form.status} onChange={set('status')}>
                <option value="published">Publish</option>
                <option value="draft">Save as draft</option>
              </select>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1 bg-royal-700 hover:bg-royal-900 text-white text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" /> Save lesson
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
