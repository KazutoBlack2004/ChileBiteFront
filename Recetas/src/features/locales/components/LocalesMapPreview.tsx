import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Card } from '@heroui/react';
import {
  MapPin,
  Star,
  ExternalLink,
  Navigation,
  Locate,
  Maximize2,
  Minimize2,
  Fish,
  Leaf,
  Wheat,
  Milk,
  Store,
  Layers,
  Compass,
  MessageCircle
} from 'lucide-react';
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  MapPopup,
  MapControls,
  type MapRef
} from '@/components/ui/map';
import { locales, type Locale } from '../data/locales';
import {
  calculateHaversineDistance,
  formatDistance,
  REGION_CENTERS,
  getGoogleMapsUrl,
  getWazeUrl,
  setLocationSavingPreference
} from '../utils/geo';
import { MapLegend } from './MapLegend';
import { GeolocationConsentModal } from './GeolocationConsentModal';

interface LocalesMapPreviewProps {
  selectedRegion: string;
  setSelectedRegion: (region: string) => void;
  selectedCategory?: string;
  searchQuery?: string;
  selectedLocaleId?: string | null;
  setSelectedLocaleId?: (id: string | null) => void;
  userLocation?: { lat: number; lng: number } | null;
  setUserLocation?: (loc: { lat: number; lng: number } | null) => void;
}

const mapCategoryFilter = (filter: string) => {
  if (filter === "Verdulerías") return "Verdulería";
  if (filter === "Pescaderías") return "Pescadería";
  if (filter === "Tostadurías y Frutos Secos") return "Tostadurías y Frutos Secos";
  if (filter === "Queserías y Lácteos") return "Quesería y Lácteos";
  return filter;
};

export const LocalesMapPreview: React.FC<LocalesMapPreviewProps> = ({
  selectedRegion,
  setSelectedRegion,
  selectedCategory = "Todos",
  searchQuery = "",
  selectedLocaleId = null,
  setSelectedLocaleId,
  userLocation = null,
  setUserLocation,
}) => {
  const mapRef = useRef<MapRef | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize accents
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Filter locales based on parent criteria
  const filteredLocales = useMemo(() => {
    const baseFiltered = locales.filter((locale) => {
      const categoryMatch =
        selectedCategory === "Todos" || locale.category === mapCategoryFilter(selectedCategory);

      const regionMatch =
        selectedRegion === "Todas" ||
        locale.region === selectedRegion ||
        norm(locale.region).includes(norm(selectedRegion)) ||
        norm(selectedRegion).includes(norm(locale.region));

      let searchMatch = true;
      if (searchQuery.trim()) {
        const q = norm(searchQuery.trim());
        const rootQ = q.endsWith("es") && q.length > 4
          ? q.slice(0, -2)
          : (q.endsWith("s") && q.length > 3 ? q.slice(0, -1) : q);

        const check = (target: string) => {
          const normT = norm(target);
          return normT.includes(q) || normT.includes(rootQ);
        };

        const matchName = check(locale.name);
        const matchDesc = check(locale.description);
        const matchCommune = locale.commune ? check(locale.commune) : false;
        const matchTags = locale.tags.some((t) => check(t));
        const matchProducts = locale.featuredProducts
          ? locale.featuredProducts.some((p) => check(p.name))
          : false;
        const matchCatalog = locale.catalog
          ? locale.catalog.some((c) => check(c.name))
          : false;

        searchMatch = matchName || matchDesc || matchCommune || matchTags || matchProducts || matchCatalog;
      }

      return categoryMatch && regionMatch && searchMatch;
    });

    if (userLocation && selectedRegion === "Todas") {
      const nearby = baseFiltered.filter(
        (l) => calculateHaversineDistance(userLocation.lat, userLocation.lng, l.lat, l.lng) <= 35
      );
      if (nearby.length > 0) return nearby;
    }

    return baseFiltered;
  }, [selectedCategory, selectedRegion, searchQuery, userLocation]);

  // Find currently selected locale
  const selectedLocale = useMemo(() => {
    if (!selectedLocaleId) return null;
    return locales.find((l) => l.id === selectedLocaleId) || null;
  }, [selectedLocaleId]);

  // Center on region change or userLocation
  useEffect(() => {
    if (!mapRef.current) return;
    if (selectedRegion === "Todas" && userLocation) {
      mapRef.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 13,
        duration: 1200,
        essential: true,
      });
      return;
    }
    const centerConfig = REGION_CENTERS[selectedRegion] || REGION_CENTERS["Todas"];
    mapRef.current.flyTo({
      center: [centerConfig.lng, centerConfig.lat],
      zoom: centerConfig.zoom,
      duration: 1200,
      essential: true,
    });
  }, [selectedRegion, userLocation]);

  // Fly to selected local when selectedLocaleId changes from outside or card click
  useEffect(() => {
    if (!selectedLocale || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [selectedLocale.lng, selectedLocale.lat],
      zoom: 15,
      duration: 1200,
      essential: true,
    });
  }, [selectedLocale]);

  // Execute geolocation once consent is granted
  const executeGeolocation = () => {
    if (!("geolocation" in navigator)) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation?.(coords);
        setIsLocating(false);

        mapRef.current?.flyTo({
          center: [coords.lng, coords.lat],
          zoom: 14,
          duration: 1400,
          essential: true,
        });
      },
      (err) => {
        console.warn("Aviso de geolocalización:", err);
        setIsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Handle request location with consent verification
  const handleRequestLocation = () => {
    try {
      const consent = localStorage.getItem("chilebite_geo_consent");
      if (consent === "accepted") {
        executeGeolocation();
      } else {
        setShowConsentModal(true);
      }
    } catch {
      executeGeolocation();
    }
  };

  const handleAcceptConsent = () => {
    setLocationSavingPreference(true);
    setShowConsentModal(false);
    executeGeolocation();
  };

  const handleDeclineConsent = () => {
    setLocationSavingPreference(false);
    setUserLocation?.(null);
    setShowConsentModal(false);
  };

  // Helper for category badge visual
  const getCategoryTheme = (category: string) => {
    switch (category) {
      case "Verdulería":
        return {
          bg: "bg-emerald-600",
          ring: "ring-emerald-400",
          icon: Leaf,
          label: "Verdulería",
        };
      case "Pescadería":
        return {
          bg: "bg-sky-600",
          ring: "ring-sky-400",
          icon: Fish,
          label: "Pescadería",
        };
      case "Tostadurías y Frutos Secos":
        return {
          bg: "bg-amber-600",
          ring: "ring-amber-400",
          icon: Wheat,
          label: "Frutos Secos",
        };
      case "Quesería y Lácteos":
        return {
          bg: "bg-yellow-600",
          ring: "ring-yellow-400",
          icon: Milk,
          label: "Quesería",
        };
      default:
        return {
          bg: "bg-zinc-700",
          ring: "ring-zinc-400",
          icon: Store,
          label: category,
        };
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14" ref={containerRef}>
      {/* Geolocation Consent Modal */}
      <GeolocationConsentModal
        isOpen={showConsentModal}
        onAccept={handleAcceptConsent}
        onDecline={handleDeclineConsent}
      />

      {/* Header Info Banner */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>

          <h2 className="font-serif text-3xl font-bold text-zinc-900 dark:text-white md:text-4xl">
            Encuentra Ferias y Puestos Cercanos
          </h2>
          <p className="mt-1.5 text-zinc-600 dark:text-zinc-400 text-sm max-w-2xl">
            Explora las verdulerías, pescaderías, queserías y tostadurías cerca de ti. Selecciona cualquier puesto en el mapa para ver sus productos, horarios y cómo llegar.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRequestLocation}
            disabled={isLocating}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer select-none active:scale-95 ${userLocation
              ? 'bg-emerald-600 text-white shadow-emerald-600/20'
              : 'mp-button hover:border-emerald-600 dark:hover:border-emerald-500'
              }`}
          >
            <Locate className={`size-4 ${isLocating ? 'animate-spin' : ''}`} />
            <span>
              {isLocating
                ? 'Buscando tu ubicación...'
                : userLocation
                  ? 'Ubicación Activada'
                  : 'Usar Mi Ubicación'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-2.5 rounded-full mp-button hover:border-emerald-600 transition-all cursor-pointer"
            title={isExpanded ? 'Reducir tamaño' : 'Expandir mapa'}
            aria-label={isExpanded ? 'Reducir tamaño' : 'Expandir mapa'}
          >
            {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>

      {/* Main Map Card */}
      <Card
        className={`relative w-full overflow-hidden rounded-[2rem] mp-card shadow-2xl transition-all duration-500 ${isExpanded ? 'h-[85vh]' : 'h-[620px] md:h-[680px]'
          }`}
      >
        <Map
          ref={mapRef}
          className="w-full h-full"
          center={
            userLocation
              ? [userLocation.lng, userLocation.lat]
              : [REGION_CENTERS["Todas"].lng, REGION_CENTERS["Todas"].lat]
          }
          zoom={userLocation ? 13 : 11}
        >
          {/* Default MapLibre Controls (Zoom, Compass, Fullscreen) */}
          <MapControls
            position="top-right"
            showZoom
            showCompass
            showFullscreen
            showLocate
            onLocate={(coords) => {
              setUserLocation?.({ lat: coords.latitude, lng: coords.longitude });
            }}
          />

          {/* User Location Pulse Pin */}
          {userLocation && (
            <MapMarker
              longitude={userLocation.lng}
              latitude={userLocation.lat}
            >
              <MarkerContent>
                <div className="relative flex items-center justify-center">
                  <span className="absolute size-9 rounded-full bg-blue-500 opacity-60 animate-ping" />
                  <div className="relative size-5 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center">
                    <div className="size-2 rounded-full bg-white" />
                  </div>
                </div>
              </MarkerContent>
              <MarkerTooltip>
                <div className="font-semibold text-xs flex items-center gap-1.5 py-0.5 px-1">
                  <Compass className="size-3 text-blue-400" />
                  <span>Tu ubicación GPS</span>
                </div>
              </MarkerTooltip>
            </MapMarker>
          )}

          {/* Markers for all filtered locales */}
          {filteredLocales.map((locale) => {
            const isSelected = selectedLocaleId === locale.id;
            const categoryTheme = getCategoryTheme(locale.category);
            const CategoryIcon = categoryTheme.icon;

            const distLabel = userLocation
              ? formatDistance(
                calculateHaversineDistance(
                  userLocation.lat,
                  userLocation.lng,
                  locale.lat,
                  locale.lng
                )
              )
              : locale.distance;

            return (
              <MapMarker
                key={locale.id}
                longitude={locale.lng}
                latitude={locale.lat}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLocaleId?.(locale.id);
                }}
              >
                <MarkerContent>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLocaleId?.(locale.id);
                    }}
                    className={`relative flex items-center justify-center transition-all duration-300 ${isSelected ? 'scale-125 z-40' : 'hover:scale-115'
                      }`}
                  >
                    {/* Pulsing ring for Selected store */}
                    {isSelected && (
                      <span
                        className={`absolute -inset-1 rounded-full ${categoryTheme.bg} opacity-75 animate-ping`}
                      />
                    )}

                    {/* Marker badge */}
                    <div
                      className={`relative size-9 rounded-full ${categoryTheme.bg} border-2 border-white shadow-xl flex items-center justify-center text-white transition-all ${isSelected ? 'ring-4 ring-emerald-400' : ''
                        }`}
                    >
                      <CategoryIcon className="size-4.5 stroke-[2.2]" />
                    </div>

                    {/* Little stall pin tail */}
                    <div className="absolute -bottom-1 size-1.5 rotate-45 bg-inherit border-r border-b border-white" />
                  </div>
                </MarkerContent>

                {/* Hover Tooltip (only when not currently showing full popup card) */}
                {!isSelected && (
                  <MarkerTooltip>
                    <div className="p-1 min-w-[150px] text-left">
                      <div className="font-bold text-xs truncate text-white">{locale.name}</div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-300 mt-0.5">
                        <span className="text-emerald-400 font-semibold">{locale.commune || locale.category}</span>
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          <span>{locale.rating}</span>
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                        <Navigation className="size-2.5 text-emerald-400" />
                        <span>A {distLabel}</span>
                      </div>
                    </div>
                  </MarkerTooltip>
                )}
              </MapMarker>
            );
          })}

          {/* Interactive Rich Chilean Card Popup for Selected Store */}
          {selectedLocale && (
            <MapPopup
              key={selectedLocale.id}
              longitude={selectedLocale.lng}
              latitude={selectedLocale.lat}
              onClose={() => setSelectedLocaleId?.(null)}
              closeButton
              closeOnClick={false}
              offset={24}
              className="p-0 border-none bg-transparent shadow-none"
            >
              <div className="p-3.5 min-w-[270px] max-w-[300px] bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                {/* Store image */}
                <div className="relative aspect-video rounded-xl overflow-hidden mb-2.5 shadow-sm bg-zinc-100 dark:bg-zinc-800">
                  <img
                    src={selectedLocale.image}
                    alt={selectedLocale.name}
                    className="w-full h-full object-cover"
                  />
                  {selectedLocale.stallNumber && (
                    <span className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {selectedLocale.stallNumber}
                    </span>
                  )}
                </div>

                {/* Name & Rating */}
                <div className="flex items-start justify-between gap-1.5 mb-1">
                  <h4 className="font-serif font-bold text-sm text-zinc-900 dark:text-white leading-tight">
                    {selectedLocale.name}
                  </h4>
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                    <Star className="size-3 fill-amber-500 text-amber-500" />
                    <span>{selectedLocale.rating}</span>
                  </span>
                </div>

                {/* Address & Commune */}
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
                  <MapPin className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate">
                    {selectedLocale.address ? `${selectedLocale.address}, ` : ''}
                    {selectedLocale.commune || selectedLocale.region}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2.5 line-clamp-2 leading-relaxed">
                  {selectedLocale.description}
                </p>

                {/* Featured Products */}
                {selectedLocale.featuredProducts && selectedLocale.featuredProducts.length > 0 && (
                  <div className="mb-3 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block mb-1">
                      Precios del día:
                    </span>
                    <div className="space-y-1">
                      {selectedLocale.featuredProducts.slice(0, 2).map((p, i) => (
                        <div
                          key={i}
                          className="text-[11px] flex justify-between items-center text-zinc-700 dark:text-zinc-300"
                        >
                          <span className="truncate pr-1">{p.name}</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                            ${p.price.toLocaleString('es-CL')}/{p.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions: Ver Catálogo, Cómo llegar (Google Maps / Waze) y WhatsApp */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`/marketplace/${selectedLocale.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                    >
                      <span>Ver Catálogo</span>
                      <ExternalLink className="size-3" />
                    </a>

                    {selectedLocale.whatsappNumber && (
                      <a
                        href={`https://wa.me/${selectedLocale.whatsappNumber.replace(/\+/g, '')}?text=${encodeURIComponent(
                          `¡Hola ${selectedLocale.name}! Los encontré en el mapa de ChileBite y quisiera consultar por sus productos.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95 inline-flex items-center gap-1"
                        title="Contactar al WhatsApp del vendedor"
                      >
                        <MessageCircle className="size-3" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>

                  {/* Navigation Links: Google Maps / Waze (Clean Lucide Icons, No Emojis) */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <a
                      href={getGoogleMapsUrl(selectedLocale.lat, selectedLocale.lng, selectedLocale.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition-colors"
                    >
                      <Navigation className="size-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Google Maps</span>
                    </a>
                    <a
                      href={getWazeUrl(selectedLocale.lat, selectedLocale.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition-colors"
                    >
                      <Compass className="size-3 text-sky-600 dark:text-sky-400" />
                      <span>Waze</span>
                    </a>
                  </div>
                </div>
              </div>
            </MapPopup>
          )}
        </Map>

        {/* Top-Left Floating Badge Overlay */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800 p-3.5 rounded-2xl shadow-xl max-w-xs pointer-events-auto">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-zinc-900 dark:text-white font-bold text-xs flex items-center gap-1.5">
                <MapPin size={14} className="text-emerald-600 dark:text-emerald-400" />
                {selectedRegion === "Todas" ? "Todas las Regiones" : selectedRegion}
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                {filteredLocales.length} {filteredLocales.length === 1 ? 'local' : 'locales'}
              </span>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-1 leading-snug">
              {userLocation
                ? 'Mostrando los locales más cercanos a tu ubicación actual.'
                : 'Activa "Usar Mi Ubicación" para ver qué locales están más cerca de ti.'}
            </p>
          </div>
        </div>

        {/* Bottom-Left Map Legend */}
        <div className="absolute bottom-4 left-4 z-10 max-w-xs w-64 pointer-events-none">
          <MapLegend defaultExpanded={false} />
        </div>
      </Card>
    </section>
  );
};
