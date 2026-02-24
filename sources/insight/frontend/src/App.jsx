import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Overview from './pages/Dashboard/Overview';
import { Health, Alerts, Clients, Networks, Devices, Applications } from './pages/Dashboard/Placeholders';
import Cloner from './pages/Cloner';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      const storedToken = sessionStorage.getItem('token');
      if (!storedToken) {
        setCheckingAuth(false);
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
      }
    };

    verifySession();

    const handleUnauthorized = () => {
      setIsLoggedIn(false);
      sessionStorage.removeItem('token');
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    sessionStorage.removeItem('token');
  };

  if (checkingAuth) {
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
    </Router>
  );
}

export default App;

