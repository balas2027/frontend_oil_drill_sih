import { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Compass,
  LayoutDashboard,
  MapPin,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  FileText,
  LogOut,
  UserCheck,
  Database,
  Lightbulb,
  Bell,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Sun,
  WifiOff,
  Activity,
} from 'lucide-react';
import { useAuthStore, isAdmin } from '../store/authStore';
import { useUiStore, formatSyncTime } from '../store/uiStore';
import { alertsApi } from '../api/risk';
import { alertLevel } from './risk/riskUtils';
import { LANGUAGES } from '../i18n';
import { SHORTCUTS, useShortcuts } from '../hooks/useShortcuts';

const BELL_POLL_MS = 15000;

const NAV = [
  { key: 'dashboard', path: '/dashboard', icon: LayoutDashboard },
  { key: 'map', path: '/map', icon: MapPin },
  { key: 'data', path: '/data', icon: Database },
  { key: 'correlation', path: '/correlation', icon: TrendingUp },
  { key: 'monitor', path: '/monitor', icon: Activity },
  { key: 'alerts', path: '/alerts', icon: Bell },
  { key: 'knowledge', path: '/knowledge', icon: BookOpen },
  { key: 'lessons', path: '/lessons', icon: Lightbulb },
  { key: 'documents', path: '/documents', icon: FileText },
  { key: 'admin', path: '/admin', icon: Settings, adminOnly: true },
];

/** Header bell (Section 9): active alerts, coloured by the most severe level. */
function AlertsBell() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      alertsApi
        .summary()
        .then((res) => !cancelled && setSummary(res.data))
        .catch(() => {});
    load();
    const timer = setInterval(load, BELL_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [location.pathname]);

  const active = summary?.active || 0;
  const worst = ['critical', 'warning', 'watch', 'info'].find((l) => summary?.by_level?.[l]);
  const live = summary?.simulations?.length > 0;
  return (
    <Link
      to="/alerts"
      className="relative flex items-center gap-1.5 bg-royal-700/60 hover:bg-royal-700 px-3 py-2 rounded-lg border border-royal-600"
      aria-label={`${t('header.alerts_bell', { count: active })}${worst ? ` (${worst})` : ''}`}
    >
      <Bell className="w-4 h-4 text-gold-500" aria-hidden="true" />
      {live && (
        <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
          {t('header.live')}
        </span>
      )}
      {active > 0 && (
        <span
          className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
          style={{ background: alertLevel(worst).color }}
        >
          {active}
        </span>
      )}
    </Link>
  );
}

function ShortcutsDialog({ onClose }) {
  const { t } = useTranslation();
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 bg-royal-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="bg-white rounded-xl border border-line shadow-lg p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 id="shortcuts-title" className="text-sm font-bold text-royal-900">
            {t('shortcuts.title')}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-royal-100"
            aria-label={t('shortcuts.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <dl className="space-y-1.5 text-xs">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="flex justify-between gap-3">
              <dt className="text-ink-900">{t(s.labelKey)}</dt>
              <dd className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-1.5 py-0.5 rounded border border-line bg-royal-50 font-mono text-[11px]"
                  >
                    {k}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const {
    fieldMode,
    toggleFieldMode,
    online,
    lastSync,
    sidebarOpen,
    toggleSidebar,
    mobileNavOpen,
    setMobileNavOpen,
  } = useUiStore();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef(null);

  useEffect(() => setMobileNavOpen(false), [location.pathname, setMobileNavOpen]);

  // Notify map/chart canvases to recalculate dimensions when sidebar opens or closes
  useEffect(() => {
    const timer = setTimeout(() => window.dispatchEvent(new Event('resize')), 220);
    return () => clearTimeout(timer);
  }, [sidebarOpen]);

  useShortcuts((action) => {
    if (action === 'help') setShowShortcuts(true);
    else if (action === 'search') {
      navigate('/knowledge');
      // Focus the ask box once the (lazy) page has rendered
      setTimeout(() => mainRef.current?.querySelector('textarea, input')?.focus(), 400);
    } else navigate(action);
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const syncTime = formatSyncTime(lastSync);
  const items = NAV.filter((n) => !n.adminOnly || isAdmin(user));

  const renderNav = (collapsed = false) => (
    <nav className="space-y-1" aria-label={t('nav.menu')}>
      {!collapsed && (
        <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-ink-600 truncate">
          {t('nav.menu')}
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
        const label = t(`nav.${item.key}`);
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={isActive ? 'page' : undefined}
            aria-label={collapsed ? label : undefined}
            title={collapsed ? label : undefined}
            className={`flex items-center rounded-lg text-xs font-medium transition-colors ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
            } ${
              isActive
                ? collapsed
                  ? 'bg-royal-100 text-royal-900 font-semibold ring-1 ring-royal-700/30'
                  : 'bg-royal-100 text-royal-900 font-semibold border-l-4 border-royal-700'
                : 'text-ink-600 hover:bg-royal-50 hover:text-royal-900'
            }`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 ${isActive ? 'text-royal-700' : 'text-ink-600'}`}
              aria-hidden="true"
            />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const statusText = `${t('status.title')}: ${online ? t('status.online') : t('status.offline')} (${
    syncTime ? t('footer.last_sync', { time: syncTime }) : t('footer.never_synced')
  })`;

  const statusBox = (
    <div className="p-3 bg-royal-50 rounded-lg border border-royal-100 text-[11px] text-ink-600">
      <span className="font-semibold text-royal-900 block mb-0.5">{t('status.title')}</span>
      {online ? (
        <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
          {t('status.online')}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-red-700 font-medium">
          <WifiOff className="w-3 h-3" aria-hidden="true" />
          {t('status.offline')}
        </div>
      )}
      <span className="block mt-0.5 tabular-nums">
        {syncTime ? t('footer.last_sync', { time: syncTime }) : t('footer.never_synced')}
      </span>
    </div>
  );

  const miniStatusBox = (
    <div
      className="p-2 bg-royal-50 rounded-lg border border-royal-100 flex items-center justify-center"
      title={statusText}
      aria-label={statusText}
    >
      {online ? (
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
      )}
    </div>
  );

  const ctl =
    'flex items-center gap-1.5 bg-royal-700/60 hover:bg-royal-700 px-2.5 py-2 rounded-lg border border-royal-600 text-xs';

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-royal-50 print:h-auto print:overflow-visible">
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-gold-500 focus:text-royal-900 focus:px-3 focus:py-2 focus:rounded-lg focus:font-semibold"
      >
        {t('a11y.skip')}
      </a>

      {/* Fixed Top bar - Royal 900 */}
      <header className="sticky top-0 shrink-0 bg-royal-900 text-white shadow-md z-30 print:hidden">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-royal-700 transition-colors"
              aria-label={mobileNavOpen ? t('nav.close_menu') : t('nav.open_menu')}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="w-9 h-9 rounded-md bg-gold-500 flex items-center justify-center text-royal-900 font-bold shadow">
              <Compass className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            </div>
            <div>
              <span className="text-[10px] tracking-wider uppercase text-gold-500 font-semibold block">
                {t('app.org')}
              </span>
              <h1 className="text-base font-bold tracking-tight leading-none">{t('app.name')}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            <AlertsBell />
            <label className={`${ctl} hidden sm:flex`}>
              <span className="sr-only">{t('header.language')}</span>
              <select
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="text-ink-900">
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={toggleFieldMode}
              aria-pressed={fieldMode}
              title={t('header.field_mode_hint')}
              className={`${ctl} hidden sm:flex ${fieldMode ? 'ring-2 ring-gold-500' : ''}`}
            >
              <Sun className="w-4 h-4 text-gold-500" aria-hidden="true" />
              <span className="hidden lg:inline">{t('header.field_mode')}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className={`${ctl} hidden lg:flex`}
              aria-label={t('header.shortcuts')}
              title={`${t('header.shortcuts')} (?)`}
            >
              <Keyboard className="w-4 h-4 text-gold-500" aria-hidden="true" />
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-royal-700/60 px-3 py-1.5 rounded-lg border border-royal-600">
              <UserCheck className="w-4 h-4 text-gold-500" aria-hidden="true" />
              <div>
                <span className="font-semibold block text-white">{user?.name || 'Engineer'}</span>
                <span className="text-[10px] text-royal-100 uppercase tracking-wider">
                  {t(`common.role.${user?.role || 'engineer'}`)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-red-600/80 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors text-xs font-medium"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('header.sign_out')}</span>
            </button>
          </div>
        </div>
        {/* Official gold line */}
        <div className="h-0.5 bg-gold-500 w-full"></div>
      </header>

      {!online && (
        <div
          role="status"
          className="shrink-0 bg-[#FDF1E4] border-b border-[#E8871E] text-[#7A3E00] text-xs px-4 py-2 flex items-center gap-2 print:hidden"
        >
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          {syncTime
            ? t('status.offline_banner', { time: syncTime })
            : t('status.offline_banner_never')}
        </div>
      )}

      {/* Mobile slide-over fixed drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex print:hidden">
          <div
            className="fixed inset-0 bg-royal-900/40"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-nav"
            className="relative z-10 w-64 max-w-[80vw] bg-white border-r border-line h-full p-4 flex flex-col justify-between overflow-y-auto shadow-xl"
          >
            <div className="space-y-4">
              {renderNav(false)}
              <div className="flex gap-2 text-xs pt-2 border-t border-line">
                <select
                  value={i18n.language}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  aria-label={t('header.language')}
                  className="border border-line rounded-md px-2 py-1.5 bg-white"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={toggleFieldMode}
                  aria-pressed={fieldMode}
                  className="border border-line rounded-md px-2 py-1.5 bg-white"
                >
                  {t('header.field_mode')}
                </button>
              </div>
            </div>
            {statusBox}
          </div>
        </div>
      )}

      {/* Body container: Fixed Collapsible Sidebar + Independently Scrollable Main Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <div className="relative hidden md:flex shrink-0 h-full print:hidden">
          <aside
            id="desktop-sidebar"
            className={`flex flex-col justify-between bg-white border-r border-line h-full overflow-y-auto overflow-x-hidden transition-all duration-200 ease-in-out ${
              sidebarOpen ? 'w-64 p-4' : 'w-16 py-4 px-2'
            }`}
          >
            <div>{renderNav(!sidebarOpen)}</div>
            <div className="mt-4">{sidebarOpen ? statusBox : miniStatusBox}</div>
          </aside>

          {/* Open / Close toggle icon at the vertical middle of the sidebar edge */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? t('nav.close_menu') : t('nav.open_menu')}
            aria-expanded={sidebarOpen}
            aria-controls="desktop-sidebar"
            title={sidebarOpen ? t('nav.close_menu') : t('nav.open_menu')}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-6 h-12 rounded-full bg-white border border-line shadow-md flex items-center justify-center text-royal-700 hover:bg-royal-900 hover:text-gold-500 hover:border-royal-900 transition-colors"
          >
            {sidebarOpen ? (
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <main
            id="main-content"
            ref={mainRef}
            tabIndex={-1}
            className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto focus:outline-none"
          >
            {/* Re-render the whole page when the UI language changes, so every label,
                including helpers that read i18n directly, switches together */}
            <Outlet key={i18n.language} />
          </main>

          <footer className="shrink-0 print:hidden bg-white border-t border-line py-2.5 px-6 text-center text-xs text-ink-600 flex flex-col md:flex-row justify-between items-center gap-2">
            <span>{t('footer.version')}</span>
            <span className="tabular-nums">
              {syncTime ? t('footer.last_sync', { time: syncTime }) : t('footer.never_synced')}
            </span>
            <span className="text-[11px] text-ink-600">{t('footer.notice')}</span>
          </footer>
        </div>
      </div>

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
