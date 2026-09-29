import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, UploadCloud, ListChecks, Gauge } from 'lucide-react';
import { wellsApi } from '../api/wells';
import DocumentsTab from '../components/documents/DocumentsTab';
import ReviewTab from '../components/documents/ReviewTab';
import EvaluationTab from '../components/documents/EvaluationTab';

const TABS = [
  { key: 'documents', label: 'Upload & documents', icon: UploadCloud },
  { key: 'review', label: 'Review queue', icon: ListChecks },
  { key: 'evaluation', label: 'Extraction quality', icon: Gauge },
];

export default function Documents() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'documents';
  const [wellIds, setWellIds] = useState([]);

  useEffect(() => {
    wellsApi
      .listWells({ limit: 100, sort: 'well_id' })
      .then((res) => setWellIds(res.data.wells.map((w) => w.well_id)))
      .catch(() => setWellIds([]));
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-xl border border-line shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-royal-700 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" aria-hidden="true" /> Document intelligence
          </span>
          <h2 className="text-xl font-bold text-royal-900 font-serif">Reports &amp; Review</h2>
          <p className="text-xs text-ink-600 mt-1">
            Upload WCR/DDR PDFs; agents extract events and formation tops with page-level evidence.
            Low-confidence items wait for a reviewer.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Documents view"
          className="flex flex-wrap bg-royal-50 border border-line rounded-lg p-1 gap-1"
        >
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setParams({ tab: key })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === key
                  ? 'bg-royal-700 text-white'
                  : 'text-ink-600 hover:bg-royal-100 hover:text-royal-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="bg-white rounded-xl border border-line shadow-sm overflow-hidden"
        role="tabpanel"
      >
        {tab === 'documents' && <DocumentsTab wellIds={wellIds} />}
        {tab === 'review' && <ReviewTab wellIds={wellIds} />}
        {tab === 'evaluation' && <EvaluationTab />}
      </div>
    </div>
  );
}
