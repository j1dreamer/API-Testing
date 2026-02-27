import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Capture from './pages/Capture';
import Detail from './pages/Detail';
import './App.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-slate-200">
        <Routes>
          <Route path="/" element={<Navigate to="/capture" replace />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/detail/:logId" element={<Detail />} />
          <Route path="*" element={<Navigate to="/capture" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
