import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Overview from './pages/Dashboard/Overview';
import Health from './pages/Dashboard/Health';
import Devices from './pages/Dashboard/Devices';
import Alerts from './pages/Dashboard/Alerts';
import Clients from './pages/Dashboard/Clients';
import Networks from './pages/Dashboard/Networks';
import Applications from './pages/Dashboard/Applications';
import Cloner from './pages/Cloner';
import { SiteProvider } from './context/SiteContext';
import { SettingsProvider } from './context/SettingsContext';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isReady, setIsReady] = useState(false); // New state to prevent early rendering

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
        const res = await apiClient.get('/cloner/auth-session');
        if (res.data && res.data.token_value) {
          setIsLoggedIn(true);
        } else {
          sessionStorage.removeItem('token');
        }
      } catch (error) {
        sessionStorage.removeItem('token');
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
          await apiClient.get('/cloner/auth-session');
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
    // Add a slightly longer delay after the Login component's own delay 
    // to ensure React context is strictly sequential
    setTimeout(() => {
      setIsLoggedIn(true);
    }, 500);
  };

  const handleLogout = async () => {
    try {
      const { default: apiClient } = await import('./api/apiClient');
      await apiClient.post('/cloner/logout');
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
          <MainLayout onLogout={handleLogout}>
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/health" element={<Health />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/networks" element={<Networks />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/applications" element={<Applications />} />
              <Route path="/cloner" element={<Cloner />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </MainLayout>
        </SiteProvider>
      </SettingsProvider>
    </Router>
  );
}

export default App;

