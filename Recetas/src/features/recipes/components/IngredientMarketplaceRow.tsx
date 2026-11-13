import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Store,
  MapPin,
  Navigation,
  ExternalLink,
  Locate,
  ShoppingBag,
  Star,
  ArrowRight
} from 'lucide-react';
import { findNearbyLocalesForIngredient } from '@/features/locales/utils/ingredientMatcher';
import type { Coordinates } from '@/features/locales/utils/geo';

interface IngredientMarketplaceRowProps {
  id: number;
  text: string;
  structuredName?: string;
  checked: boolean;
  onToggleCheck: () => void;
  userLocation: Coordinates | null;
  isLocating: boolean;
  onRequestLocation: () => void;
}

export const IngredientMarketplaceRow: React.FC<IngredientMarketplaceRowProps> = ({
  text,
  structuredName,
  checked,
  onToggleCheck,
  userLocation,
  isLocating,
  onRequestLocation,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placement: 'bottom' | 'top';
  } | null>(null);

  const rowRef = useRef<HTMLLIElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lookup = findNearbyLocalesForIngredient(text, structuredName, userLocation, 35);
  const { searchKeyword, displayIngredient, nearbyMatches, nearbyGeneralLocales } = lookup;

  const updatePosition = useCallback(() => {
    if (!rowRef.current || typeof window === 'undefined') return;
    const rect = rowRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(370, window.innerWidth - 24);
    const estimatedHeight = 290;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: 'bottom' | 'top' =
      spaceBelow < estimatedHeight && rect.top > estimatedHeight ? 'top' : 'bottom';

    const left = Math.max(
      12,
      Math.min(rect.right - popoverWidth, window.innerWidth - popoverWidth - 12)
    );
    const top = placement === 'bottom' ? rect.bottom + 8 : rect.top - 8;

    setPopoverCoords({
      top,
      left,
      width: popoverWidth,
      placement,
    });
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    updatePosition();
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  useEffect(() => {
    if (!isHovered) return;
    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isHovered, updatePosition]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const marketplaceSearchUrl = `/marketplace?q=${encodeURIComponent(searchKeyword)}&near=1`;
  const marketplaceNearUrl = `/marketplace?near=1`;

  const popoverContent =
    isHovered && popoverCoords && typeof document !== 'undefined'
      ? createPortal(
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              position: 'fixed',
              top: popoverCoords.top,
              left: popoverCoords.left,
              width: popoverCoords.width,
              transform: popoverCoords.placement === 'top' ? 'translateY(-100%)' : 'none',
              zIndex: 9999,
            }}
            className="rounded-2xl bg-white dark:bg-[#141418] opacity-100 border border-zinc-200 dark:border-zinc-700/90 shadow-[0_24px_60px_rgba(0,0,0,0.65)] p-4 text-left animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Encabezado del Popover */}
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Comprar Ingrediente
                  </h4>
                  <p className="text-sm font-serif font-bold text-zinc-900 dark:text-white leading-snug">
                    {displayIngredient}
                  </p>
                </div>
              </div>

              {userLocation && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <Navigation className="w-2.5 h-2.5" />
                  En tu zona
                </span>
              )}
            </div>

            {/* Contenido según estado de ubicación GPS */}
            {!userLocation ? (
              <div className="py-3.5 space-y-3">
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Para mostrarte únicamente locales y ferias a tu alcance donde comprar{' '}
                  <strong className="text-zinc-900 dark:text-white">{displayIngredient}</strong>, necesitamos conocer tu ubicación actual.
                </p>
                <button
                  type="button"
                  onClick={onRequestLocation}
                  disabled={isLocating}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
                >
                  <Locate className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? 'Obteniendo ubicación...' : 'Activar mi ubicación actual'}</span>
                </button>
              </div>
            ) : nearbyMatches.length > 0 ? (
              <div className="py-3 space-y-2.5">
                <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                  Locales cercanos a ti con disponibilidad:
                </p>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {nearbyMatches.slice(0, 3).map(({ locale, distanceFormatted, matchedProduct }) => (
                    <a
                      key={locale.id}
                      href={`/marketplace/${locale.id}`}
                      className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-zinc-50 hover:bg-emerald-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 transition-all group/item"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-900 dark:text-white truncate group-hover/item:text-emerald-600 dark:group-hover/item:text-emerald-400 transition-colors">
                            {locale.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                            <Navigation className="w-2.5 h-2.5" />
                            A {distanceFormatted}
                          </span>
                          <span>•</span>
                          <span className="truncate">{locale.commune || locale.region}</span>
                          <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold ml-auto">
                            <Star className="w-2.5 h-2.5 fill-amber-500" />
                            {locale.rating}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {matchedProduct ? (
                          <div className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                            <span className="block text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                              ${matchedProduct.price.toLocaleString('es-CL')}
                            </span>
                            <span className="block text-[9px] text-zinc-500 dark:text-zinc-400">
                              por {matchedProduct.unit}
                            </span>
                          </div>
                        ) : (
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover/item:text-emerald-500" />
                        )}
                      </div>
                    </a>
                  ))}
                </div>

                {/* Botón principal hacia el Marketplace filtrado */}
                <div className="pt-1.5">
                  <a
                    href={marketplaceSearchUrl}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    <span>Comprar {displayIngredient} en Marketplace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : nearbyGeneralLocales.length > 0 ? (
              <div className="py-3 space-y-2.5">
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  No tenemos precio específico registrado para <strong>{displayIngredient}</strong> hoy, pero puedes consultar en estos puestos cercanos en{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {nearbyGeneralLocales[0].locale.commune || nearbyGeneralLocales[0].locale.region}
                  </strong>:
                </p>

                <div className="space-y-1.5">
                  {nearbyGeneralLocales.slice(0, 2).map(({ locale, distanceFormatted }) => (
                    <a
                      key={locale.id}
                      href={`/marketplace/${locale.id}`}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-50 hover:bg-emerald-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs transition-colors"
                    >
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                        {locale.name}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        A {distanceFormatted}
                      </span>
                    </a>
                  ))}
                </div>

                <a
                  href={marketplaceNearUrl}
                  className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm"
                >
                  <span>Ver todos los locales cerca de mí</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <div className="py-3 space-y-2.5">
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  No encontramos locales registrados a menos de 35 km de tu ubicación actual para este ingrediente.
                </p>
                <a
                  href="/marketplace"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-colors"
                >
                  <span>Explorar Marketplace</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <li
      ref={rowRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl transition-all duration-200 ${
        isHovered ? 'ring-1 ring-emerald-500/50' : ''
      } ${
        checked
          ? 'bg-surface-muted/40 border border-transparent'
          : 'premium-glass-panel hover:bg-surface-muted/60 border border-border-subtle shadow-sm'
      }`}
    >
      {/* Parte izquierda: Checkbox e ingrediente (la opacidad solo afecta al texto cuando se marca, nunca al modal) */}
      <div
        onClick={onToggleCheck}
        className={`flex items-start sm:items-center gap-4 flex-1 cursor-pointer select-none min-w-0 ${
          checked ? 'opacity-50' : ''
        }`}
      >
        <span
          className={`mt-0.5 sm:mt-0 shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center font-bold text-xs transition-colors ${
            checked
              ? 'bg-brand-primary border-brand-primary text-white'
              : 'border-border-strong text-transparent group-hover:border-brand-primary'
          }`}
        >
          ✓
        </span>
        <span
          className={`flex-1 text-base sm:text-lg font-medium tracking-tight break-words ${
            checked ? 'line-through text-text-subtle' : 'text-text-main'
          }`}
        >
          {text}
        </span>
      </div>

      {/* Parte derecha: Indicador de acceso rápido al Marketplace cercano */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {userLocation ? (
          nearbyMatches.length > 0 ? (
            <a
              href={marketplaceSearchUrl}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-500/30 transition-all shadow-xs"
              title={`Comprar ${displayIngredient} en locales cercanos`}
            >
              <Store className="w-3.5 h-3.5 shrink-0" />
              <span>
                {nearbyMatches.length} {nearbyMatches.length === 1 ? 'local' : 'locales'} ({nearbyMatches[0].distanceFormatted})
              </span>
              {nearbyMatches[0].matchedProduct && (
                <span className="hidden md:inline font-extrabold pl-1 border-l border-emerald-500/30">
                  ${nearbyMatches[0].matchedProduct.price.toLocaleString('es-CL')}
                </span>
              )}
            </a>
          ) : (
            <a
              href={marketplaceNearUrl}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-muted hover:bg-emerald-600/15 text-text-muted hover:text-emerald-600 dark:hover:text-emerald-400 border border-border-subtle transition-all"
            >
              <MapPin className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Ver ferias cercanas</span>
            </a>
          )
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRequestLocation();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-400 hover:text-white border border-emerald-500/25 transition-all cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>¿Dónde comprar cerca?</span>
          </button>
        )}
      </div>

      {popoverContent}
    </li>
  );
};
