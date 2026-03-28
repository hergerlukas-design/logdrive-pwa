import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

// Typen aus der Datenbank extrahieren für sauberes TypeScript
type Trip = Database['public']['Tables']['trips']['Row'];

interface TripContextType {
  activeTrip: Trip | null;
  isLoadingActiveTrip: boolean;
  checkActiveTrip: (userId: string) => Promise<void>;
  clearActiveTrip: () => void;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export const TripProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [isLoadingActiveTrip, setIsLoadingActiveTrip] = useState(false);

  // Prüft, ob es eine Fahrt ohne End-Kilometer für den aktuellen User gibt
  const checkActiveTrip = useCallback(async (userId: string) => {
    setIsLoadingActiveTrip(true);
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', userId)
        .is('end_km', null)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = Keine Zeile gefunden (das ist okay)
        console.error('Fehler beim Laden der aktiven Fahrt:', error.message);
      }

      setActiveTrip(data || null);
    } catch (err) {
      console.error('Unerwarteter Fehler im TripContext:', err);
    } finally {
      setIsLoadingActiveTrip(false);
    }
  }, []);

  const clearActiveTrip = () => setActiveTrip(null);

  return (
    <TripContext.Provider value={{ activeTrip, isLoadingActiveTrip, checkActiveTrip, clearActiveTrip }}>
      {children}
    </TripContext.Provider>
  );
};

// Custom Hook für die einfache Nutzung in unseren Komponenten
export const useTrip = () => {
  const context = useContext(TripContext);
  if (context === undefined) {
    throw new Error('useTrip muss innerhalb eines TripProviders verwendet werden');
  }
  return context;
};