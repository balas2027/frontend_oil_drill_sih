import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ShieldCheck, Lock, Mail, Compass, AlertCircle } from 'lucide-react';

// Synthetic demo accounts seeded by the backend (app/routers/auth.py)
const DEMO_ACCOUNTS = [
  ['admin', 'admin@oil.in', 'admin123'],
  ['reviewer', 'reviewer@oil.in', 'reviewer123'],
  ['engineer', 'engineer@oil.in', 'engineer123'],
  ['viewer', 'viewer@oil.in', 'viewer123'],
];

export default function Login() {
  const [email, setEmail] = useState('admin@oil.in');
  const [password, setPassword] = useState('admin123');
  const { login, loading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-royal-50">
      {/* Left Panel - Royal 900 Theme */}
      <div className="w-full md:w-5/12 bg-royal-900 text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Subtle background graphic glow */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-royal-700 rounded-full blur-3xl opacity-40 pointer-events-none"></div>

        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-lg bg-gold-500 flex items-center justify-center text-royal-900 font-bold shadow-lg">
              <Compass className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xs tracking-wider uppercase text-gold-500 font-semibold">
                Oil India Limited
              </span>
              <h1 className="text-xl font-bold tracking-tight">eRTMAC - NWIS</h1>
            </div>
          </div>

          <div className="mt-12 space-y-4">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white leading-tight">
              Nearby Wells Intelligence System
            </h2>
            <p className="text-royal-100 text-sm leading-relaxed">
              Giving every drilling engineer the memory of every well ever drilled nearby - and
              warning them before history repeats.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-royal-700/60 text-xs text-royal-100/80 space-y-1">
          <div className="flex items-center gap-2 text-gold-500 font-medium">
            <ShieldCheck className="w-4 h-4" /> Decision Support System for Drilling Operations
          </div>
          <p>© 2026 Oil India Limited. SIH Problem Statement 26121.</p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full md:w-7/12 p-8 md:p-16 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-line p-8">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-royal-900">Sign in to NWIS Portal</h3>
            <p className="text-xs text-ink-600 mt-1">
              Enter your credentials to access the intelligence platform
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-ink-900 mb-1">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-600 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-royal-600"
                  placeholder="engineer@oil.in"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-900 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-600 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-royal-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="bg-royal-50 border border-royal-100 rounded-lg p-3 text-xs text-ink-600 space-y-1">
              <span className="font-semibold text-royal-900">Demo accounts (one per role):</span>
              {DEMO_ACCOUNTS.map(([role, email, pw]) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setEmail(email);
                    setPassword(pw);
                  }}
                  className="w-full flex justify-between items-center text-left px-1.5 py-0.5 rounded hover:bg-royal-100"
                >
                  <span className="capitalize font-medium text-ink-900 w-16">{role}</span>
                  <code className="text-royal-700 font-mono">{email}</code>
                  <code className="text-ink-600 font-mono">{pw}</code>
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-royal-700 hover:bg-royal-900 text-white font-medium text-sm rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Portal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
