import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Overview from './pages/Dashboard/Overview';
import { Health, Alerts, Clients, Networks, Devices, Applications } from './pages/Dashboard/Placeholders';
import Cloner from './pages/Cloner';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    const handleUnauthorized = () => {
      setIsLoggedIn(false);
      localStorage.removeItem('token');
    };

    // Listen for the custom event dispatched by apiClient interceptor
    window.addEventListener('unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('unauthorized', handleUnauthorized);
    };
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('token');
  };

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

          {/* Catch-all route within MainLayout */}
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;
