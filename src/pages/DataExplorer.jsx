import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, Compass, AlertTriangle, Activity } from 'lucide-react';
import { wellsApi } from '../api/wells';
import { apiErrorMessage } from '../api/client';
import WellsTab from '../components/explorer/WellsTab';
import EventsTab from '../components/explorer/EventsTab';
import DrillingTab from '../components/explorer/DrillingTab';

const TABS = [
  { key: 'wells', label: 'Wells', icon: Compass },
  { key: 'events', label: 'Events', icon: AlertTriangle },
  { key: 'drilling', label: 'Drilling data', icon: Activity },
];

export default function DataExplorer() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'wells';
  const wellFilter = params.get('well') || '';
  const [options, setOptions] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([wellsApi.getFilterOptions(), wellsApi.listWells({ limit: 100, sort: 'well_id' })])
      .then(([opts, wells]) =>
        setOptions({ ...opts.data, wellIds: wells.data.wells.map((w) => w.well_id) })
      )
      .catch((err) => setError(apiErrorMessage(err, 'Could not load filter options.')));
  }, []);

  const go = (next) => setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-xl border border-line shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-royal-700 flex items-center gap-1">
            <Database className="w-3.5 h-3.5" aria-hidden="true" /> Data foundation
          </span>
          <h2 className="text-xl font-bold text-royal-900 font-serif">Data Explorer</h2>
          <p className="text-xs text-ink-600 mt-1">
            Browse wells, drilling events and drilling parameter logs. Upper Assam data is a
            synthetic demo dataset.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Dataset"
          className="flex bg-royal-50 border border-line rounded-lg p-1 gap-1"
        >
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => go({ tab: key, well: key === 'events' ? wellFilter : '' })}
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

      {error && (
        <p className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </p>
      )}

      <div
        className="bg-white rounded-xl border border-line shadow-sm overflow-hidden"
        role="tabpanel"
      >
        {tab === 'wells' && (
          <WellsTab
            options={options}
            onShowEvents={(wellId) => go({ tab: 'events', well: wellId })}
          />
        )}
        {tab === 'events' && (
          <EventsTab
            options={options}
            wellFilter={wellFilter}
            onWellFilterChange={(w) => go({ tab: 'events', well: w })}
          />
        )}
        {tab === 'drilling' && <DrillingTab wellIds={options.drilling_ts_wells} />}
      </div>
    </div>
  );
}
