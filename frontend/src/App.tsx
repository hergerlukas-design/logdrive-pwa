import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }    from './context/AuthContext'
import { TripProvider }    from './context/TripContext'
import { Login }           from './pages/Login'
import { Dashboard }       from './pages/Dashboard'
import { AddVehicle }      from './pages/AddVehicle'
import { AddExpense }      from './pages/AddExpense'
import { DropboxCallback } from './pages/DropboxCallback'
import { ProtectedRoute }  from './components/ProtectedRoute'

const App: React.FC = () => (
  <AuthProvider>
    <TripProvider>
      <Router>
        <Routes>
          <Route path="/login"            element={<Login />} />
          <Route path="/dropbox/callback" element={<DropboxCallback />} />

          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/fahrzeug-hinzufuegen" element={
            <ProtectedRoute><AddVehicle /></ProtectedRoute>
          } />
          <Route path="/ausgabe-erfassen" element={
            <ProtectedRoute><AddExpense /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </TripProvider>
  </AuthProvider>
)

export default App
