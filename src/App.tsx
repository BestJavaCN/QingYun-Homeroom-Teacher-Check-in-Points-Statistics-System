import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Header from '@/components/common/Header';
import { CheckInDataProvider } from '@/contexts/CheckInDataContext';
import routes from './routes';

const App: React.FC = () => {
  return (
    <Router>
      <CheckInDataProvider>
        <Toaster />
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-grow bg-gray-50">
            <Routes>
              {routes.map((route, index) => (
                <Route
                  key={index}
                  path={route.path}
                  element={route.element}
                />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </CheckInDataProvider>
    </Router>
  );
};

export default App;