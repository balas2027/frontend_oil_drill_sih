import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
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
const PlannedModule = lazyPage(() => import('./pages/PlannedModule'));

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
                <PlannedModule module="alerts" />
              </Page>
            }
          />
          <Route
            path="correlation"
            element={
              <Page>
                <PlannedModule module="correlation" />
              </Page>
            }
          />
          <Route
            path="knowledge"
            element={
              <Page>
                <PlannedModule module="knowledge" />
              </Page>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
