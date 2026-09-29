import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, isAdmin } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Page } from './components/common/PageBoundary';
import { lazyPage } from './components/common/lazyPage';

// Heavy pages (MapLibre, deck.gl, pdf.js) load on demand; lazyPage recovers from stale chunks
const MapPage = lazyPage(() => import('./pages/MapPage'));
const DataExplorer = lazyPage(() => import('./pages/DataExplorer'));
const Documents = lazyPage(() => import('./pages/Documents'));
const DocumentDetail = lazyPage(() => import('./pages/DocumentDetail'));
const RiskAlerts = lazyPage(() => import('./pages/RiskAlerts'));
const Admin = lazyPage(() => import('./pages/Admin'));
const Knowledge = lazyPage(() => import('./pages/Knowledge'));
const Lessons = lazyPage(() => import('./pages/Lessons'));
const Correlation = lazyPage(() => import('./pages/Correlation'));

function AdminRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  // Wait for the stored user before deciding; non-admins go back to the dashboard
  if (!user) return null;
  return isAdmin(user) ? children : <Navigate to="/dashboard" replace />;
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <Page>
                <Dashboard />
              </Page>
            }
          />
          <Route
            path="map"
            element={
              <Page>
                <MapPage />
              </Page>
            }
          />
          <Route
            path="data"
            element={
              <Page>
                <DataExplorer />
              </Page>
            }
          />
          <Route
            path="documents"
            element={
              <Page>
                <Documents />
              </Page>
            }
          />
          <Route
            path="documents/:docId"
            element={
              <Page>
                <DocumentDetail />
              </Page>
            }
          />
          <Route
            path="alerts"
            element={
              <Page>
                <RiskAlerts />
              </Page>
            }
          />
          <Route
            path="correlation"
            element={
              <Page>
                <Correlation />
              </Page>
            }
          />
          <Route
            path="knowledge"
            element={
              <Page>
                <Knowledge />
              </Page>
            }
          />
          <Route
            path="lessons"
            element={
              <Page>
                <Lessons />
              </Page>
            }
          />
          <Route
            path="admin"
            element={
              <Page>
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              </Page>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
