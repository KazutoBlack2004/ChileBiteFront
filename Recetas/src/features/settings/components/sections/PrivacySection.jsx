import React, { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, Loader, Download, MapPin, Locate, Navigation } from "lucide-react";
import { toast } from "@heroui/react";
import { supabase } from '@/lib/supabaseClient';
import { Section, Row, BRAND } from "./SettingsShared";
import {
  isLocationSavingEnabled,
  setLocationSavingPreference,
  getSavedUserLocationSession,
  saveUserLocationSession,
} from '@/features/locales/utils/geo';

export function PrivacySection({ user, profile }) {
  const [profileVisibility, setProfileVisibility] = useState(profile?.profile_visibility || 'public');
  const [isSaving, setIsSaving] = useState(false);

  // For collections visibility, we check if they have any public collections
  const [collectionsPublic, setCollectionsPublic] = useState(false);
  const [loadingCols, setLoadingCols] = useState(true);

  // Geolocation preference & saved coordinates state
  const [locationEnabled, setLocationEnabled] = useState(() => isLocationSavingEnabled());
  const [savedCoords, setSavedCoords] = useState(() => getSavedUserLocationSession());
  const [locatingGps, setLocatingGps] = useState(false);

  const handleToggleLocationSaving = () => {
    const nextValue = !locationEnabled;
    setLocationEnabled(nextValue);

    if (!nextValue) {
      setLocationSavingPreference(false);
      setSavedCoords(null);
      toast.success("Guardado de ubicación desactivado y coordenadas borradas.");
      return;
    }

    setLocationSavingPreference(true);
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      setLocatingGps(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          saveUserLocationSession(coords);
          setSavedCoords(coords);
          setLocatingGps(false);
          toast.success("Ubicación activada y guardada para mostrar locales cercanos.");
        },
        () => {
          setLocatingGps(false);
          toast.info("Preferencia activada. Verifica permisos de GPS en tu navegador.");
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      toast.success("Preferencia de ubicación activada.");
    }
  };

  const handleRefreshCoords = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocationSavingPreference(true, coords);
        setLocationEnabled(true);
        setSavedCoords(coords);
        setLocatingGps(false);
        toast.success("Ubicación actual actualizada y guardada.");
      },
      () => {
        setLocatingGps(false);
        toast.danger("No se pudo obtener la ubicación desde el navegador.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    async function checkCollections() {
      if (!user) return;
      const { data } = await supabase.from('core_coleccion').select('is_public').eq('user_id', user.id);
      if (data) {
        setCollectionsPublic(data.some(c => c.is_public));
      }
      setLoadingCols(false);
    }
    checkCollections();
  }, [user]);

  const handleVisibilityChange = async (value) => {
    setProfileVisibility(value);
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ profile_visibility: value }).eq('id', user.id);
      if (error) throw error;
      toast.success("Visibilidad del perfil actualizada.");
    } catch (err) {
      toast.danger("Error al actualizar la visibilidad.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCollectionsToggle = async () => {
    const newValue = !collectionsPublic;
    setCollectionsPublic(newValue);
    setIsSaving(true);
    try {
      const { error } = await supabase.from('core_coleccion').update({ is_public: newValue }).eq('user_id', user.id);
      if (error) throw error;
      toast.success(`Colecciones marcadas como ${newValue ? 'públicas' : 'privadas'}.`);
    } catch (err) {
      toast.danger("Error al actualizar colecciones.");
      setCollectionsPublic(!newValue);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    toast.success("Generando exportación de datos...");
    // Future Edge Function implementation
    setTimeout(() => {
      toast.info("Esta función estará disponible pronto.");
    }, 1500);
  };

  return (
    <Section title="Privacidad">
      <Row icon={Lock} label="Visibilidad del Perfil" sublabel="Controla quién puede ver tu perfil público" iconColor="#8b5cf6">
        <div className="flex flex-col gap-3 mt-3">
          <label className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer transition-colors ${profileVisibility === 'public'
              ? 'border-brand-primary/40 dark:border-[#f0a262]/40 bg-brand-primary/5 dark:bg-[#f0a262]/10'
              : 'border-border-subtle dark:border-zinc-800 bg-white dark:bg-[#18181d] hover:bg-surface-muted/50 dark:hover:bg-zinc-800/40'
            }`}>
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-text-muted dark:text-zinc-400" />
              <div>
                <p className="text-sm font-bold text-text-main dark:text-zinc-100">Público</p>
                <p className="text-xs text-text-muted dark:text-zinc-400">Cualquier persona puede ver tu perfil</p>
              </div>
            </div>
            <input
              type="radio"
              name="visibility"
              value="public"
              checked={profileVisibility === 'public'}
              onChange={() => handleVisibilityChange('public')}
              className="w-4 h-4 accent-[#7a461b] dark:accent-[#f0a262]"
            />
          </label>
          <label className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer transition-colors ${profileVisibility === 'private'
              ? 'border-brand-primary/40 dark:border-[#f0a262]/40 bg-brand-primary/5 dark:bg-[#f0a262]/10'
              : 'border-border-subtle dark:border-zinc-800 bg-white dark:bg-[#18181d] hover:bg-surface-muted/50 dark:hover:bg-zinc-800/40'
            }`}>
            <div className="flex items-center gap-3">
              <EyeOff className="w-5 h-5 text-text-muted dark:text-zinc-400" />
              <div>
                <p className="text-sm font-bold text-text-main dark:text-zinc-100">Privado</p>
                <p className="text-xs text-text-muted dark:text-zinc-400">Solo tú puedes ver tu perfil</p>
              </div>
            </div>
            <input
              type="radio"
              name="visibility"
              value="private"
              checked={profileVisibility === 'private'}
              onChange={() => handleVisibilityChange('private')}
              className="w-4 h-4 accent-[#7a461b] dark:accent-[#f0a262]"
            />
          </label>
        </div>
      </Row>

      <Row icon={Eye} label="Colecciones Guardadas" sublabel="Hacer que tus colecciones de recetas sean públicas" iconColor="#0ea5e9">
        <div className="flex items-center justify-between mt-2 py-1">
          <div className="flex flex-col">
            <p className="text-sm font-bold text-text-main dark:text-zinc-100">Colecciones Públicas</p>
            <p className="text-xs text-text-muted dark:text-zinc-400 mt-0.5">Permitir que otros vean tus recetas guardadas</p>
          </div>
          {loadingCols ? (
            <Loader className="w-5 h-5 animate-spin text-text-muted dark:text-zinc-500" />
          ) : (
            <button
              type="button"
              onClick={handleCollectionsToggle}
              disabled={isSaving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary dark:focus-visible:ring-[#f0a262] ${collectionsPublic ? 'bg-brand-primary dark:bg-[#f0a262]' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 shadow ring-0 transition duration-200 ease-in-out ${collectionsPublic ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          )}
        </div>
      </Row>

      <Row
        icon={MapPin}
        label="Ubicación y Cercanía"
        sublabel="Elige si deseas guardar tu ubicación para ver locales e ingredientes cercanos"
        iconColor="#10b981"
      >
        <div className="mt-2 space-y-3">
          <div className="flex items-center justify-between py-1">
            <div className="flex flex-col pr-4">
              <p className="text-sm font-bold text-text-main dark:text-zinc-100">
                Guardar mi ubicación
              </p>
              <p className="text-xs text-text-muted dark:text-zinc-400 mt-0.5 leading-relaxed">
                Al activarlo, recordaremos tu zona para mostrarte automáticamente dónde comprar los ingredientes de tus recetas y qué locales están más cerca de ti.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleLocationSaving}
              disabled={locatingGps}
              aria-label="Activar o desactivar guardado de ubicación"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${locationEnabled ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 shadow ring-0 transition duration-200 ease-in-out ${locationEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border-subtle dark:border-zinc-800/80">
            <div className="flex items-center gap-2 text-xs">
              <Navigation
                className={`w-3.5 h-3.5 ${locationEnabled && savedCoords
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-text-muted dark:text-zinc-500'
                  }`}
              />
              <span className="text-text-muted dark:text-zinc-400">
                Estado:{' '}
                <strong className="text-text-main dark:text-zinc-200">
                  {locationEnabled
                    ? savedCoords
                  ? 'Ubicación activa y guardada'
                  : 'Activada (listo para ubicar)'
                    : 'Desactivada'}
                </strong>
              </span>
            </div>

            {locationEnabled && (
              <button
                type="button"
                onClick={handleRefreshCoords}
                disabled={locatingGps}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-500/30 transition-all cursor-pointer"
              >
                <Locate className={`w-3.5 h-3.5 ${locatingGps ? 'animate-spin' : ''}`} />
                <span>{locatingGps ? 'Actualizando...' : 'Actualizar mi ubicación'}</span>
              </button>
            )}
          </div>
        </div>
      </Row>

      <Row icon={Download} label="Exportar mis datos" sublabel="Descarga una copia de toda tu información" iconColor="#10b981">
        <div className="mt-2 space-y-3">
          <p className="text-xs text-text-muted dark:text-zinc-400 leading-relaxed">
            Obtén un archivo JSON con tu perfil, colecciones y recetas en cumplimiento con normativas de privacidad.
          </p>
          <button
            type="button"
            onClick={handleExportData}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Descargar datos
          </button>
        </div>
      </Row>
    </Section>
  );
}
