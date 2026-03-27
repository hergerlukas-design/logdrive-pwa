import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Car, Hash, Gauge, Loader2 } from 'lucide-react';

export const AddVehicle: React.FC = () => {
  const navigate = useNavigate();

  const [model, setModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [currentMileage, setCurrentMileage] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLicensePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLicensePlate(e.target.value.toUpperCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!model.trim() || !licensePlate.trim() || currentMileage === '') {
      setErrorMsg('Bitte fülle alle Felder aus.');
      return;
    }

    if (Number(currentMileage) < 0) {
      setErrorMsg('Der Kilometerstand darf nicht negativ sein.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const { error } = await supabase.from('vehicles').insert({
      model: model.trim(),
      license_plate: licensePlate.trim(),
      current_mileage: Number(currentMileage),
    });

    if (error) {
      setErrorMsg(`Fehler beim Speichern: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background p-4">
      <div className="w-full max-w-md mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            aria-label="Zurück zum Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Fahrzeug hinzufügen</h1>
        </div>

        {/* Fehleranzeige */}
        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Formular */}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5"
        >
          {/* Modell */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Fahrzeugmodell
            </label>
            <div className="relative">
              <Car className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                type="text"
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="z.B. VW Golf 8"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </div>

          {/* Kennzeichen */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Kennzeichen
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                type="text"
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary font-mono tracking-widest uppercase"
                placeholder="z.B. M-AB 1234"
                value={licensePlate}
                onChange={handleLicensePlateChange}
              />
            </div>
          </div>

          {/* Aktueller Kilometerstand */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Aktueller Kilometerstand
            </label>
            <div className="relative">
              <Gauge className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                type="number"
                required
                min={0}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="z.B. 45000"
                value={currentMileage}
                onChange={(e) =>
                  setCurrentMileage(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Bitte den aktuellen Tachostand eintragen.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium flex justify-center items-center hover:bg-blue-700 transition-colors disabled:opacity-50 mt-2"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              'Fahrzeug speichern'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
