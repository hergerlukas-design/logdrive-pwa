import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TripProvider } from './context/TripContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AddVehicle } from './pages/AddVehicle';
import { ProtectedRoute } from './components/ProtectedRoute';

const App: React.FC = () => {
  return (
    // Die Provider stellen den Status für User und Fahrten in der gesamten App zur Verfügung
    <AuthProvider>
      <TripProvider>
        <Router>
          <Routes>
            {/* Öffentliche Route */}
            <Route path="/login" element={<Login />} />
            
            {/* Geschützte Route */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Geschützte Route: Fahrzeug hinzufügen */}
            <Route
              path="/fahrzeug-hinzufuegen"
              element={
                <ProtectedRoute>
                  <AddVehicle />
                </ProtectedRoute>
              }
            />

            {/* Fallback: Wenn jemand eine unbekannte URL eingibt, leite ihn zum Dashboard (welches ihn ggf. zum Login schickt) */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </TripProvider>
    </AuthProvider>
  );
};

export default App;