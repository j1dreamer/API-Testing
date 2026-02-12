import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Capture from './pages/Capture';
import Cloner from './pages/Cloner';
import Detail from './pages/Detail';
// Login import removed
import './App.css';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const apiKey = localStorage.getItem('internal_app_auth');
  const location = useLocation();

  if (!apiKey) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Open Access Routes (Auth Removed) */}
        <Route path="/" element={
          <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
            {/* Navigation Bar */}
            <nav className="bg-white shadow-sm border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                  <div className="flex">
                    <div className="flex-shrink-0 flex items-center">
                      <span className="font-bold text-xl text-teal-600">Instant Insight</span>
                    </div>
                    <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                      <Link to="/" className="border-teal-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                        Dashboard
                      </Link>
                      <Link to="/capture" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                        Logs
                      </Link>
                      <Link to="/cloner" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                        Cloner
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              <Dashboard />
            </main>
          </div>
        } />

        <Route path="/capture" element={
          <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
            <nav className="bg-white shadow-sm border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                  <div className="flex">
                    <div className="flex-shrink-0 flex items-center">
                      <span className="font-bold text-xl text-teal-600">Instant Insight</span>
                    </div>
                    <Link to="/" className="ml-6 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Back to Dashboard</Link>
                  </div>
                </div>
              </div>
            </nav>
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"><Capture /></main>
          </div>
        } />

        <Route path="/cloner" element={<Cloner />} />
        <Route path="/detail/:logId" element={<Detail />} />
      </Routes>
    </Router>
  );
}

export default App;
