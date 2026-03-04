import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import GlobalLayout from './layouts/GlobalLayout';
import SiteLayout from './layouts/SiteLayout';
import Login from './pages/Login';
import GlobalDashboard from './pages/Dashboard/GlobalDashboard';
import SiteDetail from './pages/Dashboard/SiteDetail';
import Configuration from './pages/Configuration';
import AdminLogs from './pages/Admin/Logs';
import { SiteProvider } from './context/SiteContext';
import { SettingsProvider } from './context/SettingsContext';
import './App.css';

// Guard for admin-only routes.
// - No session  → App.jsx never renders the Router at all (shows Login instead).
// - Has session, not admin → redirect to /dashboard, session stays alive.
const AdminRoute = ({ userRole, children }) => {
  if (userRole === 'admin') return children;
  return <Navigate to="/dashboard" replace />;
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isReady, setIsReady] = useState(false);
  // userRole lives in React state so Sidebar and AdminRoute re-render reactively.
  // Initialized from sessionStorage so the very first render already has the correct
  // role — prevents the Admin tab from flashing hidden before verifySession completes.
  const [userRole, setUserRole] = useState(
    () => sessionStorage.getItem('userRole') || 'guest'
  );

  useEffect(() => {
    const verifySession = async () => {
      const storedToken = sessionStorage.getItem('token');
      if (!storedToken) {
        setCheckingAuth(false);
        setIsReady(true);
        return;
      }
      try {
        // Must use apiClient so /api prefix is applied
        const { default: apiClient } = await import('./api/apiClient');
        const res = await apiClient.get('/auth/session');
        if (res.data && res.data.token_value) {
          // /auth/session is a stateless echo — it does NOT return a role field.
          // The authoritative role was written to sessionStorage by the login flow.
          // Read from sessionStorage; do NOT overwrite it.
          const role = sessionStorage.getItem('userRole') || 'guest';
          setIsLoggedIn(true);
          setUserRole(role);
        } else {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('userRole');
        }
      } catch (error) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('userRole');
      } finally {
        setCheckingAuth(false);
        setIsReady(true);
      }
    };

    verifySession();

    const handleUnauthorized = () => {
      setIsLoggedIn(false);
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('selectedSiteId');
      window.location.href = '/'; // Hard reset
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  // Health Check Polling to keep browser tab active and check session
  useEffect(() => {
    let heartbeatInterval;
    if (isLoggedIn) {
      heartbeatInterval = setInterval(async () => {
        try {
          // Dynamic import to avoid breaking initial load
          const { default: apiClient } = await import('./api/apiClient');
          // Lightweight request to keep session and connection alive
          await apiClient.get('/auth/session');
          console.debug('Health Check Polling - isPaused: false, lastStatus: online');
        } catch (e) {
          console.warn('Health Check Polling - failed', e);
        }
      }, 30 * 1000); // 30 seconds
    }

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [isLoggedIn]);

  const handleLoginSuccess = () => {
    // Login component already wrote userRole to sessionStorage before calling this.
    // Read it synchronously here so React state is set in the same tick as isLoggedIn.
    const role = sessionStorage.getItem('userRole') || 'guest';
    setTimeout(() => {
      setUserRole(role);
      setIsLoggedIn(true);
    }, 500);
  };

  const handleLogout = async () => {
    try {
      const { default: apiClient } = await import('./api/apiClient');
      await apiClient.post('/auth/logout');
    } catch (e) {
      console.warn('Backend logout failed', e);
    }
    setIsLoggedIn(false);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('selectedSiteId');
    window.location.href = '/';
  };

  if (checkingAuth || !isReady) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Router>
      <SettingsProvider>
        <SiteProvider>
          <Routes>
            {/* Global routes — use GlobalLayout */}
            <Route element={<GlobalLayout onLogout={handleLogout} userRole={userRole} />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<GlobalDashboard />} />
              <Route path="/config" element={<Configuration />} />
              <Route path="/admin/logs" element={
                <AdminRoute userRole={userRole}>
                  <AdminLogs />
                </AdminRoute>
              } />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>

            {/* Site-specific routes — use SiteLayout */}
            <Route path="/site/:siteId" element={<SiteLayout onLogout={handleLogout} userRole={userRole} />}>
              <Route index element={<SiteDetail />} />
              <Route path="cloner" element={<Configuration />} />
            </Route>
          </Routes>
        </SiteProvider>
      </SettingsProvider>
    </Router>
  );
}

export default App;

