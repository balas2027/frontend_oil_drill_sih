import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { wellsApi, eventsApi } from '../api/wells';
import { 
  Compass, Database, Activity, CheckCircle, ShieldAlert, Layers, 
  MapPin, TrendingUp, FileText, ArrowRight 
} from 'lucide-react';

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState({ wells: 0, events: 0, drilling: 0 });
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [healthRes, wellsRes, eventsRes] = await Promise.all([
          apiClient.get('/health'),
          wellsApi.listWells({ limit: 100 }),
          eventsApi.listEvents({ limit: 5 }),
        ]);
        setHealth(healthRes.data);
        const wells = wellsRes.data.wells;
        setStats({
          wells: wellsRes.data.total,
          events: eventsRes.data.total,
          drilling: wells.filter(w => w.status === 'drilling').length,
        });
        setRecentEvents(eventsRes.data.events);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-line shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-royal-700">Phase 1 + 2 — Data Foundation + Map</span>
          <h2 className="text-xl font-bold text-royal-900 font-serif">Command Dashboard</h2>
          <p className="text-xs text-ink-600 mt-1">Nearby Wells Intelligence System (NWIS) — Upper Assam Basin Demo Data</p>
        </div>
        <button
          onClick={() => navigate('/map')}
          className="flex items-center gap-2 bg-royal-700 hover:bg-royal-900 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm"
        >
          <MapPin className="w-4 h-4" /> Open Map & Nearby Wells <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-line shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-royal-100 flex items-center justify-center text-royal-700">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-ink-600 font-medium">Total Wells</span>
            <p className="text-xl font-bold text-royal-900">{loading ? '...' : stats.wells}</p>
            <span className="text-[10px] text-ink-600">Upper Assam Basin</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-line shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gold-100 flex items-center justify-center text-gold-500">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-ink-600 font-medium">Active Drilling</span>
            <p className="text-xl font-bold text-royal-900">{loading ? '...' : stats.drilling}</p>
            <span className="text-[10px] text-emerald-700 font-medium">Currently drilling</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-line shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-royal-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-ink-600 font-medium">Total Events</span>
            <p className="text-xl font-bold text-royal-900">{loading ? '...' : stats.events}</p>
            <span className="text-[10px] text-ink-600">Across all wells</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-line shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-ink-600 font-medium">DB Status</span>
            <p className="text-sm font-bold text-emerald-700 capitalize">{health?.db_status || 'Checking...'}</p>
            <span className="text-[10px] text-ink-600">nwis_db @ Atlas</span>
          </div>
        </div>
      </div>

      {/* Recent Events Table */}
      <div className="bg-white rounded-xl border border-line shadow-sm">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h3 className="text-sm font-bold text-royal-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-royal-700" /> Recent Drilling Events
          </h3>
          <span className="text-[10px] text-ink-600">Showing latest 5</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-royal-50 text-royal-700 uppercase text-[10px] tracking-wider">
                <th className="text-left px-4 py-2.5 font-bold">Well</th>
                <th className="text-left px-4 py-2.5 font-bold">Type</th>
                <th className="text-left px-4 py-2.5 font-bold">Formation</th>
                <th className="text-left px-4 py-2.5 font-bold">Depth (MD)</th>
                <th className="text-left px-4 py-2.5 font-bold">Severity</th>
                <th className="text-left px-4 py-2.5 font-bold">Mitigation</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((evt, idx) => (
                <tr key={evt._id || idx} className="border-b border-line/50 hover:bg-royal-50/50">
                  <td className="px-4 py-2.5 font-medium text-royal-900">{evt.well_id}</td>
                  <td className="px-4 py-2.5 capitalize">{(evt.type || '').replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5">{evt.formation || '—'}</td>
                  <td className="px-4 py-2.5 font-mono">{evt.depth_from_md}–{evt.depth_to_md} m</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      evt.severity >= 4 ? 'bg-red-50 text-red-700' :
                      evt.severity >= 3 ? 'bg-orange-50 text-orange-700' :
                      'bg-green-50 text-green-700'
                    }`}>
                      {evt.severity}/5
                    </span>
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px] truncate">{evt.mitigation || '—'}</td>
                </tr>
              ))}
              {recentEvents.length === 0 && !loading && (
                <tr><td colSpan={6} className="text-center py-6 text-ink-600">No events recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
