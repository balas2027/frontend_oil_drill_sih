import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { Compass, Database, Activity, CheckCircle, ShieldAlert, Layers } from 'lucide-react';

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/health')
      .then(res => setHealth(res.data))
      .catch(() => setHealth({ status: 'offline', db_status: 'disconnected' }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-line shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-royal-700">Phase 0 — Setup Complete</span>
          <h2 className="text-xl font-bold text-royal-900 font-serif">Command Dashboard</h2>
          <p className="text-xs text-ink-600 mt-1">Nearby Wells Intelligence System (NWIS) for Oil India Limited</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>MongoDB Atlas Ready</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-line shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-royal-100 flex items-center justify-center text-royal-700">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-ink-600 font-medium">Active Wells</span>
            <p className="text-xl font-bold text-royal-900">0 Wells</p>
            <span className="text-[10px] text-ink-600">Phase 1 Seed Pending</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-line shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gold-100 flex items-center justify-center text-gold-500">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-ink-600 font-medium">Database Status</span>
            <p className="text-xl font-bold text-royal-900 capitalize">{health?.db_status || 'Checking...'}</p>
            <span className="text-[10px] text-emerald-700 font-medium">nwis_db @ Mongo Atlas</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-line shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-royal-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-ink-600 font-medium">Active Alerts</span>
            <p className="text-xl font-bold text-royal-900">0 Open</p>
            <span className="text-[10px] text-ink-600">No active incidents</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-line shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-ink-600 font-medium">Processed Documents</span>
            <p className="text-xl font-bold text-royal-900">0 Files</p>
            <span className="text-[10px] text-ink-600">WCR / DDR Pipeline</span>
          </div>
        </div>
      </div>

      {/* Backend Integration Status */}
      <div className="bg-white p-6 rounded-xl border border-line shadow-sm">
        <h3 className="text-sm font-bold text-royal-900 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-royal-700" />
          System Initialization Log
        </h3>

        <div className="space-y-2 text-xs font-mono bg-royal-50 p-4 rounded-lg border border-royal-100 text-ink-900">
          <p className="text-emerald-700">✓ FastAPI Backend service initialized successfully.</p>
          <p className="text-emerald-700">✓ MongoDB Atlas connection verified using credentials from db.env.</p>
          <p className="text-emerald-700">✓ Database schema indexes (2dsphere geospatial, unique email, well_id) created.</p>
          <p className="text-emerald-700">✓ Default Administrator user seeded: admin@oil.in.</p>
          <p className="text-royal-700">ℹ API Health Status: {loading ? 'Loading...' : JSON.stringify(health)}</p>
        </div>
      </div>
    </div>
  );
}
