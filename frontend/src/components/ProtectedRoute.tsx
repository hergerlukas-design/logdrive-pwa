import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Solange Supabase den Status prüft, zeigen wir einen Lade-Spinner
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  // Wenn kein User gefunden wurde -> Zurück zum Login (mit ?next= für Redirect nach Login)
  if (!user) {
    const next = location.pathname + location.search
    const loginPath = next === '/dashboard' ? '/login' : `/login?next=${encodeURIComponent(next)}`
    return <Navigate to={loginPath} replace />;
  }

  // User ist autorisiert -> Zeige die gewünschte Seite (z.B. Dashboard)
  return <>{children}</>;
};