import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  // Solange Supabase den Status prüft, zeigen wir einen Lade-Spinner
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  // Wenn kein User gefunden wurde -> Zurück zum Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User ist autorisiert -> Zeige die gewünschte Seite (z.B. Dashboard)
  return <>{children}</>;
};