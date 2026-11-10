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

  // Wenn kein User gefunden wurde -> Zum Login, Ziel (z.B. NFC-Link /fahrzeug/:id) merken
  if (!user) {
    const target = location.pathname + location.search;
    const next = target !== '/dashboard' ? `?next=${encodeURIComponent(target)}` : '';
    return <Navigate to={`/login${next}`} replace />;
  }

  // User ist autorisiert -> Zeige die gewünschte Seite (z.B. Dashboard)
  return <>{children}</>;
};