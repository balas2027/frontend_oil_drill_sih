import React from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
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
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Map & Nearby Wells', path: '/map', icon: MapPin },
    { label: 'Data Explorer', path: '/data', icon: Database },
    { label: 'Correlation', path: '/correlation', icon: TrendingUp },
    { label: 'Risk & Alerts', path: '/alerts', icon: AlertTriangle },
    { label: 'Ask NWIS & Search', path: '/knowledge', icon: BookOpen },
    { label: 'Lessons', path: '/lessons', icon: Lightbulb },
    { label: 'Documents', path: '/documents', icon: FileText },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-royal-50">
      {/* Top Navigation Header - Royal 900 */}
      <header className="bg-royal-900 text-white shadow-md z-30">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-gold-500 flex items-center justify-center text-royal-900 font-bold shadow">
              <Compass className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] tracking-wider uppercase text-gold-500 font-semibold block">
                Oil India Limited
              </span>
              <h1 className="text-base font-bold tracking-tight leading-none">eRTMAC - NWIS</h1>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 bg-royal-700/60 px-3 py-1.5 rounded-lg border border-royal-600">
              <UserCheck className="w-4 h-4 text-gold-500" />
              <div>
                <span className="font-semibold block text-white">{user?.name || 'Engineer'}</span>
                <span className="text-[10px] text-royal-100 uppercase tracking-wider">
                  {user?.role || 'Engineer'}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors text-xs font-medium"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
        {/* Official Gold Line Separator */}
        <div className="h-0.5 bg-gold-500 w-full"></div>
      </header>

      {/* Main Layout Container */}
      <div className="flex flex-1">
        {/* Left Sidebar Nav */}
        <aside className="w-64 bg-white border-r border-line p-4 hidden md:flex flex-col justify-between">
          <nav className="space-y-1">
            <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-ink-600">
              Navigation Menu
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-royal-100 text-royal-900 font-semibold border-l-4 border-royal-700'
                      : 'text-ink-600 hover:bg-royal-50 hover:text-royal-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-royal-700' : 'text-ink-600'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-3 bg-royal-50 rounded-lg border border-royal-100 text-[11px] text-ink-600">
            <span className="font-semibold text-royal-900 block mb-0.5">System Status</span>
            <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Atlas DB Connected
            </div>
          </div>
        </aside>

        {/* Main Workspace Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Official Footer */}
      <footer className="bg-white border-t border-line py-2.5 px-6 text-center text-xs text-ink-600 flex flex-col md:flex-row justify-between items-center gap-2">
        <span>eRTMAC-NWIS v1.0.0 — Decision Support System for Drilling Operations</span>
        <span className="text-[11px] text-ink-600">
          Notice: Advisory system only. Rig supervisor retains final authority.
        </span>
      </footer>
    </div>
  );
}
