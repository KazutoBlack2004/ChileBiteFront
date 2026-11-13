import React from 'react';
import { ShieldCheck, MapPin, X, Navigation } from 'lucide-react';

interface GeolocationConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const GeolocationConsentModal: React.FC<GeolocationConsentModalProps> = ({
  isOpen,
  onAccept,
  onDecline,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="geo-consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md p-6 rounded-3xl mp-card shadow-2xl border mp-border text-zinc-900 dark:text-zinc-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        {/* Close icon */}
        <button
          type="button"
          onClick={onDecline}
          className="absolute top-5 right-5 p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          aria-label="Cerrar modal de consentimiento"
        >
          <X className="size-4" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <Navigation className="size-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Tu Ubicación
            </span>
            <h3 id="geo-consent-title" className="font-serif text-lg font-bold mp-text-title leading-tight">
              Encuentra locales cerca de ti
            </h3>
          </div>
        </div>

        {/* Description & Legal Disclosure */}
        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
          Para mostrarte las ferias libres y locales más cercanos a tu hogar, ordenarlos por cercanía y ayudarte a llegar fácilmente, necesitamos permiso para conocer tu ubicación aproximada.
        </p>

        <div className="p-3.5 rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 space-y-2 text-[11px] text-zinc-600 dark:text-zinc-400">
          <div className="flex items-start gap-2">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Tu privacidad primero:</strong> Tu ubicación solo se utiliza en tu propio dispositivo para mostrarte locales cercanos y nunca se comparte con terceros.</span>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Protección de datos:</strong> Cumplimos con la Ley N° 19.628 sobre protección de la vida privada en Chile.</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>Puedes activar o desactivar esta opción cuando quieras desde la configuración de tu cuenta. Revisa más detalles en nuestra <a href="/privacidad#geolocalizacion" target="_blank" className="text-emerald-600 dark:text-emerald-400 underline font-semibold">Política de Privacidad</a>.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t mp-border">
          <button
            type="button"
            onClick={onDecline}
            className="px-4 py-2 rounded-xl text-xs font-semibold mp-button transition-all cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            No por ahora
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
          >
            Permitir y Localizar
          </button>
        </div>
      </div>
    </div>
  );
};

