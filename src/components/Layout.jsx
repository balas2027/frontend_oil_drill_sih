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
  Lock,
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

/** Active-alert summary, polled for the header bell and the nav badge. */
function useAlertSummary() {
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
  return summary;
}

const TEXT_SIZE_KEY = 'nwis_text_size';
function readTextSize() {
  try {
    return localStorage.getItem(TEXT_SIZE_KEY) || 'md';
  } catch {
    return 'md';
  }
}

/** Header bell (Section 9): active alerts, coloured by the most severe level. */
function AlertsBell({ summary }) {
  const { t } = useTranslation();
  const active = summary?.active || 0;
  const worst = ['critical', 'warning', 'watch', 'info'].find((l) => summary?.by_level?.[l]);
  const live = summary?.simulations?.length > 0;
  return (
    <Link
      to="/alerts"
      className="relative flex items-center gap-1.5 bg-white hover:bg-royal-100 px-3 h-9 rounded border border-line text-royal-700"
      aria-label={`${t('header.alerts_bell', { count: active })}${worst ? ` (${worst})` : ''}`}
    >
      <Bell className="w-4 h-4 text-royal-700" aria-hidden="true" />
      {live && (
        <span className="text-[10px] uppercase tracking-wider text-statutory-600 font-bold">
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
  const [textSize, setTextSize] = useState(readTextSize);
  const alertSummary = useAlertSummary();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef(null);

  useEffect(() => setMobileNavOpen(false), [location.pathname, setMobileNavOpen]);

  // A- / A / A+ (portal accessibility control) scales every rem-based size
  useEffect(() => {
    document.documentElement.dataset.textSize = textSize;
    try {
      localStorage.setItem(TEXT_SIZE_KEY, textSize);
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new Event('resize'));
  }, [textSize]);

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
        <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-[0.08em] text-ink-600 truncate font-display">
          {t('nav.section')}
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
            className={`relative flex items-center rounded text-[13px] transition-colors ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
            } ${
              isActive ? 'bg-royal-700 text-white font-semibold' : 'text-ink-900 hover:bg-royal-100'
            }`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-royal-600'}`}
              aria-hidden="true"
            />
            {!collapsed && <span className="truncate flex-1">{label}</span>}
            {item.key === 'alerts' && alertSummary?.open > 0 && (
              <span
                className={`min-w-[20px] h-5 px-1 rounded-sm bg-hazard-700 text-white text-[10px] font-bold flex items-center justify-center ${
                  collapsed ? 'absolute -top-1 -right-1' : ''
                }`}
                aria-label={t('header.alerts_bell', { count: alertSummary.open })}
              >
                {alertSummary.open}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const statusText = `${t('status.title')}: ${online ? t('status.online') : t('status.offline')} (${
    syncTime ? t('footer.last_sync', { time: syncTime }) : t('footer.never_synced')
  })`;

  const statusBox = (
    <div className="p-3 bg-white rounded border border-line text-[11px] text-ink-600">
      <span className="font-semibold text-royal-900 block mb-0.5">{t('status.title')}</span>
      {online ? (
        <div className="flex items-center gap-1.5 text-statutory-800 font-semibold">
          <span className="w-2 h-2 rounded-full bg-statutory-600" aria-hidden="true"></span>
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
      className="p-2 bg-white rounded border border-line flex items-center justify-center"
      title={statusText}
      aria-label={statusText}
    >
      {online ? (
        <span className="w-2.5 h-2.5 rounded-full bg-statutory-600" aria-hidden="true" />
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
      )}
    </div>
  );

  const ctl =
    'flex items-center gap-1.5 bg-white hover:bg-royal-100 px-2.5 h-9 rounded border border-line text-xs text-royal-700';
  const current = items.find(
    (n) => location.pathname === n.path || location.pathname.startsWith(`${n.path}/`)
  );
  const crumb = current
    ? t(`nav.${current.key}`)
    : location.pathname.startsWith('/wells/')
      ? t('nav.well')
      : '';
  const ribbonBtn = (size, label) => (
    <button
      key={size}
      type="button"
      onClick={() => setTextSize(size)}
      aria-pressed={textSize === size}
      aria-label={t(`header.text_${size}`)}
      className={`px-1 leading-none hover:text-saffron-400 ${
        textSize === size ? 'text-saffron-400 underline underline-offset-2' : ''
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-royal-50 print:h-auto print:overflow-visible">
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-saffron-600 focus:text-white focus:px-3 focus:py-2 focus:rounded focus:font-semibold"
      >
        {t('a11y.skip')}
      </a>

      <header className="sticky top-0 shrink-0 z-30 print:hidden">
        {/* Tier 1 - portal ribbon: identity, connection, skip link, text size, language */}
        <div className="bg-navy-900 text-white text-[11px] font-display font-semibold">
          <div className="px-4 h-8 flex items-center justify-between gap-3">
            <p className="truncate">
              <span lang="hi">{t('header.ribbon_org_hi')}</span>
              <span className="mx-1.5 text-white/40">|</span>
              <span>{t('header.ribbon_org')}</span>
              <span className="hidden lg:inline">
                <span className="mx-1.5 text-white/40">|</span>
                <span lang="hi">{t('header.ribbon_ministry_hi')}</span>
                <span className="mx-1.5 text-white/40">|</span>
                {t('header.ribbon_ministry')}
              </span>
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden md:flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${online ? 'bg-statutory-600' : 'bg-hazard-700'}`}
                  aria-hidden="true"
                />
                {online ? t('status.online') : t('status.offline')}
              </span>
              <span className="hidden md:inline text-white/40">|</span>
              <a
                href="#main-content"
                onClick={(e) => {
                  e.preventDefault();
                  mainRef.current?.focus();
                }}
                className="hidden md:inline hover:text-saffron-400"
              >
                {t('a11y.skip')}
              </a>
              <span className="hidden md:inline text-white/40">|</span>
              <span className="flex items-center" role="group" aria-label={t('header.text_size')}>
                {ribbonBtn('sm', 'A-')}
                {ribbonBtn('md', 'A')}
                {ribbonBtn('lg', 'A+')}
              </span>
              <span className="text-white/40">|</span>
              <label className="flex items-center">
                <span className="sr-only">{t('header.language')}</span>
                <select
                  value={i18n.language}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="text-ink-900">
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {/* Tricolor micro-accent */}
          <div className="flex h-[3px]" aria-hidden="true">
            <span className="flex-1 bg-saffron-400" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-statutory-600" />
          </div>
        </div>

        {/* Tier 2 - institutional masthead */}
        <div className="bg-white border-b border-line">
          <div className="px-4 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="md:hidden p-2 rounded border border-line text-royal-700"
                aria-label={mobileNavOpen ? t('nav.close_menu') : t('nav.open_menu')}
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-nav"
              >
                {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="w-10 h-10 rounded bg-navy-900 flex items-center justify-center shrink-0">
                <Compass className="w-5 h-5 text-saffron-400 stroke-[2.5]" aria-hidden="true" />
              </div>
              <div className="hidden sm:block w-px h-10 bg-line" aria-hidden="true" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-navy-900 leading-tight tracking-tight">
                    {t('app.name')}
                  </h1>
                  <span className="hidden md:inline px-1.5 py-0.5 rounded-sm bg-saffron-50 border border-saffron-300 text-saffron-600 text-[10px] font-bold uppercase tracking-wider font-display">
                    {t('header.system_badge')}
                  </span>
                </div>
                <p className="text-xs text-ink-600 truncate">
                  {t('app.full')} · {t('app.org')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <AlertsBell summary={alertSummary} />
              <button
                type="button"
                onClick={toggleFieldMode}
                aria-pressed={fieldMode}
                title={t('header.field_mode_hint')}
                className={`${ctl} hidden sm:flex ${fieldMode ? 'border-saffron-600 bg-saffron-50' : ''}`}
              >
                <Sun className="w-4 h-4 text-saffron-600" aria-hidden="true" />
                <span className="hidden lg:inline">{t('header.field_mode')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowShortcuts(true)}
                className={`${ctl} hidden lg:flex`}
                aria-label={t('header.shortcuts')}
                title={`${t('header.shortcuts')} (?)`}
              >
                <Keyboard className="w-4 h-4" aria-hidden="true" />
              </button>
              <div className="hidden sm:flex items-center gap-2 pl-3 ml-1 border-l border-line">
                <div className="text-right leading-tight">
                  <span className="font-bold block text-navy-900 font-display">
                    {user?.name || 'Engineer'}
                  </span>
                  <span className="text-[10px] text-ink-600 uppercase tracking-wider font-semibold">
                    {t(`common.role.${user?.role || 'engineer'}`)}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-full bg-navy-900 text-white flex items-center justify-center">
                  <UserCheck className="w-4 h-4" aria-hidden="true" />
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 bg-hazard-700 hover:bg-[#8e1515] text-white px-3 h-9 rounded text-xs font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('header.sign_out')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tier 3 - operational command bar */}
        <div className="bg-white border-b border-line">
          <div className="px-4 h-9 flex items-center justify-between gap-3 text-[11px]">
            <nav
              aria-label={t('header.breadcrumb')}
              className="flex items-center gap-1.5 font-display font-semibold uppercase tracking-wider min-w-0"
            >
              <span className="text-ink-600">{t('app.name')}</span>
              <span className="text-ink-600" aria-hidden="true">
                ›
              </span>
              <span className="text-navy-900 truncate">{crumb}</span>
            </nav>
            <div className="flex items-center gap-3 text-ink-600 shrink-0">
              {alertSummary?.simulations?.length > 0 && (
                <span className="hidden md:flex items-center gap-1 text-statutory-800 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-statutory-600" aria-hidden="true" />
                  {t('header.replays_running', { n: alertSummary.simulations.length })}
                </span>
              )}
              <span className="tabular-nums">
                {syncTime ? t('footer.last_sync', { time: syncTime }) : t('footer.never_synced')}
              </span>
            </div>
          </div>
        </div>
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
              sidebarOpen ? 'w-64 p-3' : 'w-16 py-3 px-2'
            }`}
          >
            <div>{renderNav(!sidebarOpen)}</div>
            <div className="mt-4 space-y-3">
              {sidebarOpen ? statusBox : miniStatusBox}
              {sidebarOpen && (
                <div className="pt-3 border-t border-line text-[11px] leading-tight">
                  <p className="font-bold text-navy-900 uppercase font-display">{t('app.org')}</p>
                  <p className="text-ink-600">{t('footer.assets')}</p>
                </div>
              )}
            </div>
          </aside>

          {/* Open / Close toggle icon at the vertical middle of the sidebar edge */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? t('nav.close_menu') : t('nav.open_menu')}
            aria-expanded={sidebarOpen}
            aria-controls="desktop-sidebar"
            title={sidebarOpen ? t('nav.close_menu') : t('nav.open_menu')}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-6 h-12 rounded bg-white border border-line flex items-center justify-center text-royal-700 hover:bg-navy-900 hover:text-white hover:border-navy-900 transition-colors"
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

          <footer className="shrink-0 print:hidden bg-[#FFF8E1] border-t border-[#FFE082] py-2 px-4 text-[11px] flex flex-col md:flex-row justify-between items-center gap-1.5">
            <span className="flex items-center gap-1.5 font-display font-bold uppercase tracking-wide text-saffron-600">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" /> {t('footer.notice')}
            </span>
            <span className="text-ink-600 font-display font-semibold">{t('footer.version')}</span>
          </footer>
        </div>
      </div>

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
