import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { OverviewTab, ModelsTab, SimulatorTab, SourcesTab } from '../components/admin/OpsTabs';
import UsersTab from '../components/admin/UsersTab';
import AuditTab from '../components/admin/AuditTab';
import LearningTab from '../components/admin/LearningTab';
import NotificationsTab from '../components/admin/NotificationsTab';

const TABS = [
  { key: 'overview', Component: OverviewTab },
  { key: 'users', Component: UsersTab },
  { key: 'sources', Component: SourcesTab },
  { key: 'models', Component: ModelsTab },
  { key: 'learning', Component: LearningTab },
  { key: 'notifications', Component: NotificationsTab },
  { key: 'simulator', Component: SimulatorTab },
  { key: 'audit', Component: AuditTab },
];

/** Administration (Section 10.10). Route is admin-only (see App.jsx). */
export default function Admin() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const active = TABS.find((x) => x.key === params.get('tab')) || TABS[0];
  const tabRefs = useRef({});

  const select = (key) => {
    setParams({ tab: key }, { replace: true });
    tabRefs.current[key]?.focus();
  };
  // Arrow keys move between tabs (WAI-ARIA tabs pattern)
  const onKeyDown = (e) => {
    const i = TABS.findIndex((x) => x.key === active.key);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(TABS[(next + TABS.length) % TABS.length].key);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-xl border border-line shadow-sm">
        <span className="text-xs uppercase font-bold tracking-wider text-royal-700 flex items-center gap-1.5">
          <Settings className="w-4 h-4" aria-hidden="true" /> {t('admin.eyebrow')}
        </span>
        <h2 className="text-xl font-bold text-royal-900 font-serif">{t('admin.title')}</h2>
        <p className="text-xs text-ink-600 mt-1">{t('admin.subtitle')}</p>
      </div>
      <div className="bg-white rounded-xl border border-line shadow-sm">
        <div
          role="tablist"
          aria-label={t('admin.title')}
          onKeyDown={onKeyDown}
          className="flex overflow-x-auto overflow-y-hidden border-b border-line px-2"
        >
          {TABS.map((x) => {
            const selected = x.key === active.key;
            return (
              <button
                key={x.key}
                ref={(el) => (tabRefs.current[x.key] = el)}
                type="button"
                role="tab"
                id={`tab-${x.key}`}
                aria-selected={selected}
                aria-controls={`panel-${x.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(x.key)}
                className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${
                  selected
                    ? 'border-royal-700 text-royal-900 font-semibold'
                    : 'border-transparent text-ink-600 hover:text-royal-900'
                }`}
              >
                {t(`admin.tabs.${x.key}`)}
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id={`panel-${active.key}`}
          aria-labelledby={`tab-${active.key}`}
          className="p-4"
        >
          <active.Component />
        </div>
      </div>
    </div>
  );
}
