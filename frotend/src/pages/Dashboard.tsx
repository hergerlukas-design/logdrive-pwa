import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { Loader2, Car, Play, Square, History, MapPin, LogOut, PlusCircle } from 'lucide-react';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type Trip = Database['public']['Tables']['trips']['Row'];

export const Dashboard: React.FC = () => {
  const { activeTrip, isLoadingActiveTrip, checkActiveTrip, clearActiveTrip } = useTrip();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [pastTrips, setPastTrips] = useState<Trip[]>([]);
  
  const [startKm, setStartKm] = useState<number | ''>('');
  const [endKm, setEndKm] = useState<number | ''>('');
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isFetchingMileage, setIsFetchingMileage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentUserId = user?.id || '';

  useEffect(() => {
    const fetchVehicles = async () => {
      setIsLoadingVehicles(true);
      const { data, error } = await supabase.from('vehicles').select('*').order('model');
      
      if (error) {
        setErrorMsg(`DB-Fehler: ${error.message} (Code: ${error.code})`);
      } else if (data) {
        setVehicles(data);
      }
      setIsLoadingVehicles(false);
    };

    fetchVehicles();
    
    if (currentUserId) {
      checkActiveTrip(currentUserId);
    }
  }, [currentUserId, checkActiveTrip]);

  // Neue Logik: Lade die Historie der abgeschlossenen Fahrten
  useEffect(() => {
    const fetchPastTrips = async () => {
      if (!currentUserId) return;
      setIsLoadingHistory(true);
      
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', currentUserId)
        .not('end_km', 'is', null) // Nur beendete Fahrten
        .order('timestamp', { ascending: false })
        .limit(10); // Die letzten 10 Fahrten
        
      if (!error && data) {
        setPastTrips(data);
      }
      setIsLoadingHistory(false);
    };

    fetchPastTrips();
  }, [currentUserId, activeTrip]); // Lädt neu, sobald sich der Status der aktiven Fahrt ändert

  useEffect(() => {
    const fetchCurrentMileage = async () => {
      if (!selectedVehicleId || activeTrip) return;

      setIsFetchingMileage(true);
      setErrorMsg(null);
      
      const { data, error } = await supabase
        .from('vehicles')
        .select('current_mileage')
        .eq('id', selectedVehicleId)
        .single();

      if (error) {
        setErrorMsg(`DB-Fehler (KM-Stand): ${error.message}`);
      } else if (data) {
        setStartKm(data.current_mileage);
      }
      
      setIsFetchingMileage(false);
    };

    fetchCurrentMileage();
  }, [selectedVehicleId, activeTrip]);

  const handleStartTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId || startKm === '' || !startLocation) {
      setErrorMsg('Bitte fülle alle Pflichtfelder aus.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const { error } = await supabase.from('trips').insert({
      vehicle_id: selectedVehicleId,
      user_id: currentUserId,
      driver_id: currentUserId,
      start_km: Number(startKm),
      start_location: startLocation,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      setErrorMsg(`Fehler beim Starten der Fahrt: ${error.message}`);
    } else {
      await checkActiveTrip(currentUserId);
      setStartLocation('');
    }
    setIsSubmitting(false);
  };

  const handleEndTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || endKm === '' || !endLocation) {
      setErrorMsg('Bitte fülle alle Pflichtfelder aus.');
      return;
    }

    if (Number(endKm) < activeTrip.start_km) {
      setErrorMsg(`Der Endkilometerstand darf nicht kleiner sein als der Startwert (${activeTrip.start_km} km).`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from('trips')
      .update({
        end_km: Number(endKm),
        end_location: endLocation,
      })
      .eq('id', activeTrip.id);

    if (error) {
      setErrorMsg(`Fehler beim Beenden der Fahrt: ${error.message}`);
    } else {
      clearActiveTrip();
      setEndKm('');
      setEndLocation('');
      setSelectedVehicleId('');
    }
    setIsSubmitting(false);
  };

  // Hilfsfunktion zur Formatierung des Datums
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (isLoadingVehicles || isLoadingActiveTrip) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/fahrzeug-hinzufuegen')}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors"
            title="Fahrzeug hinzufügen"
          >
            <PlusCircle className="h-4 w-4" />
            Fahrzeug
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors"
            title="Abmelden"
          >
            <LogOut className="h-4 w-4" />
            Abmelden
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-mono break-words">
          {errorMsg}
        </div>
      )}

      {/* FORMULAR BEREICH */}
      <div className="mb-8">
        {!activeTrip ? (
          <form onSubmit={handleStartTrip} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Fahrzeug auswählen</label>
              <div className="relative">
                <Car className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <select
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary appearance-none bg-white"
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  required
                >
                  <option value="" disabled>Bitte wählen...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.model} ({v.license_plate})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Start Kilometerstand
                {isFetchingMileage && <Loader2 className="inline ml-2 h-3 w-3 animate-spin text-primary" />}
              </label>
              <input
                type="number"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                value={startKm}
                onChange={(e) => setStartKm(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="z.B. 150000"
                required
                disabled={isFetchingMileage}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Startort</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
                placeholder="z.B. München Büro"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isFetchingMileage}
              className="w-full bg-primary text-white py-3 rounded-lg font-medium flex justify-center items-center hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <><Play className="h-5 w-5 mr-2" /> Fahrt starten</>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEndTrip} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-t-4 border-t-green-500">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Aktive Fahrt</h2>
              <p className="text-sm text-slate-500">
                Gestartet bei {activeTrip.start_km} km in {activeTrip.start_location}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">End Kilometerstand</label>
              <input
                type="number"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                value={endKm}
                onChange={(e) => setEndKm(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={`Min. ${activeTrip.start_km}`}
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Zielort</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                value={endLocation}
                onChange={(e) => setEndLocation(e.target.value)}
                placeholder="z.B. Kundentermin Berlin"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium flex justify-center items-center hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <><Square className="h-5 w-5 mr-2" /> Fahrt beenden</>}
            </button>
          </form>
        )}
      </div>

      {/* HISTORIE BEREICH */}
      <div>
        <div className="flex items-center mb-4 text-slate-800">
          <History className="h-5 w-5 mr-2 text-primary" />
          <h2 className="text-xl font-bold">Letzte Fahrten</h2>
        </div>
        
        {isLoadingHistory ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin h-6 w-6 text-slate-400" />
          </div>
        ) : pastTrips.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-slate-100 text-center text-slate-500 shadow-sm">
            Noch keine beendeten Fahrten vorhanden.
          </div>
        ) : (
          <div className="space-y-3">
            {pastTrips.map((trip) => (
              <div key={trip.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm text-slate-500">
                    {formatDate(trip.timestamp)}
                  </div>
                  <div className="font-semibold text-primary bg-blue-50 px-2 py-1 rounded text-sm">
                    {/* Gefahrene Kilometer berechnen */}
                    {trip.end_km && (trip.end_km - trip.start_km)} km
                  </div>
                </div>
                
                <div className="flex items-center text-slate-800 text-sm mt-2">
                  <MapPin className="h-4 w-4 mr-2 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {trip.start_location} <span className="text-slate-400 mx-1">→</span> {trip.end_location}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};