import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Diagnosis } from './pages/Diagnosis';
import { MobileBottomNav } from './components/MobileBottomNav';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 font-inter text-gray-900 pb-16 md:pb-0">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/diagnosis" element={<Diagnosis />} />
          {/* Redirect unknown routes to Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global Bottom Navigation for Mobile */}
        <MobileBottomNav />
      </div>
    </BrowserRouter>
  );
};

export default App;
