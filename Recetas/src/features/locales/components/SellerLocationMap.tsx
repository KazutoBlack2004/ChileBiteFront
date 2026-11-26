import React, { useState, useRef, useMemo } from 'react';
import { Card } from '@heroui/react';
import {
  MapPin,
  Navigation,
  Compass,
  Locate,
  Clock,
  Sparkles,
  ExternalLink,
  Star,
  Leaf,
  Fish,
  Wheat,
  Milk,
  Store,
  Layers,
  ShieldCheck,
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
  getGoogleMapsUrl,
  getWazeUrl,
  getSavedUserLocationSession,
  saveUserLocationSession,
  setLocationSavingPreference
} from '../utils/geo';
import { GeolocationConsentModal } from './GeolocationConsentModal';

interface SellerLocationMapProps {
  currentLocale: Locale;
}

export const SellerLocationMap: React.FC<SellerLocationMapProps> = ({ currentLocale }) => {
  const mapRef = useRef<MapRef | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(() =>
    getSavedUserLocationSession()
  );
  const [isLocating, setIsLocating] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [selectedPopupLocale, setSelectedPopupLocale] = useState<Locale | null>(null);

  // Nearby locales (same region or closest)
  const nearbyLocales = useMemo(() => {
    return locales.filter((l) => l.id !== currentLocale.id && l.region === currentLocale.region);
  }, [currentLocale]);

  // Execute browser geolocation once consent is granted
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
        setUserLocation(coords);
        saveUserLocationSession(coords);
        setIsLocating(false);

        // Center between user and current store
        mapRef.current?.flyTo({
          center: [
            (coords.lng + currentLocale.lng) / 2,
            (coords.lat + currentLocale.lat) / 2,
          ],
          zoom: 12.5,
          duration: 1500,
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
    setUserLocation(null);
    setShowConsentModal(false);
  };

  // Helper for category badge visual
  const getCategoryTheme = (category: string) => {
    switch (category) {
      case "Verdulería":
        return { bg: "bg-emerald-600", icon: Leaf };
      case "Pescadería":
        return { bg: "bg-sky-600", icon: Fish };
      case "Tostadurías y Frutos Secos":
        return { bg: "bg-amber-600", icon: Wheat };
      case "Quesería y Lácteos":
        return { bg: "bg-yellow-600", icon: Milk };
      default:
        return { bg: "bg-zinc-700", icon: Store };
    }
  };

  const CurrentCategoryIcon = getCategoryTheme(currentLocale.category).icon;

  // Real-time distance if userLocation is available
  const currentDistanceKm = userLocation
    ? calculateHaversineDistance(
      userLocation.lat,
      userLocation.lng,
      currentLocale.lat,
      currentLocale.lng
    )
    : null;

  return (
    <div className="space-y-4">
      {/* Geolocation Consent Modal */}
      <GeolocationConsentModal
        isOpen={showConsentModal}
        onAccept={handleAcceptConsent}
        onDecline={handleDeclineConsent}
      />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b mp-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <MapPin className="size-4" />
            <span>Ubicación y Cómo Llegar</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mp-text-title">
            Encuentra este puesto en el mapa
          </h2>
          <p className="text-xs sm:text-sm mp-text-muted mt-1">
            Revisa la ubicación exacta de {currentLocale.name}, otros puestos cercanos en la zona y traza tu ruta de navegación.
          </p>
        </div>

        {/* GPS Button */}
        <button
          type="button"
          onClick={handleRequestLocation}
          disabled={isLocating}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer select-none active:scale-95 shrink-0 ${userLocation
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
                : 'Ver distancia desde mi ubicación'}
          </span>
        </button>
      </div>

      {/* Map + Sidebar Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Interactive Map */}
        <div className="lg:col-span-2">
          <Card className="relative h-[420px] sm:h-[480px] w-full overflow-hidden rounded-3xl mp-card shadow-xl border mp-border">
            <Map
              ref={mapRef}
              className="w-full h-full"
              center={[currentLocale.lng, currentLocale.lat]}
              zoom={14}
            >
              <MapControls
                position="top-right"
                showZoom
                showCompass
                showFullscreen
                showLocate
                onLocate={(coords) => {
                  setUserLocation({ lat: coords.latitude, lng: coords.longitude });
                }}
              />

              {/* User Location Marker */}
              {userLocation && (
                <MapMarker longitude={userLocation.lng} latitude={userLocation.lat}>
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

              {/* Nearby Locales Markers */}
              {nearbyLocales.map((nearby) => {
                const nearbyTheme = getCategoryTheme(nearby.category);
                const Icon = nearbyTheme.icon;
                const isSelected = selectedPopupLocale?.id === nearby.id;

                return (
                  <MapMarker
                    key={nearby.id}
                    longitude={nearby.lng}
                    latitude={nearby.lat}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPopupLocale(nearby);
                      mapRef.current?.flyTo({
                        center: [nearby.lng, nearby.lat],
                        zoom: 14.5,
                        duration: 900,
                        essential: true,
                      });
                    }}
                  >
                    <MarkerContent>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPopupLocale(nearby);
                          mapRef.current?.flyTo({
                            center: [nearby.lng, nearby.lat],
                            zoom: 14.5,
                            duration: 900,
                            essential: true,
                          });
                        }}
                        className={`relative flex items-center justify-center transition-all ${isSelected ? 'scale-125 opacity-100 z-40' : 'opacity-85 hover:opacity-100 hover:scale-115'
                          }`}
                      >
                        <div className={`size-8 rounded-full ${nearbyTheme.bg} border-2 border-white shadow-md flex items-center justify-center text-white ${isSelected ? 'ring-4 ring-emerald-400' : ''}`}>
                          <Icon className="size-4" />
                        </div>
                      </div>
                    </MarkerContent>
                    {!isSelected && (
                      <MarkerTooltip>
                        <div className="p-1 min-w-[130px] text-left">
                          <div className="font-bold text-xs truncate text-white">{nearby.name}</div>
                          <div className="text-[10px] text-emerald-400 font-semibold">{nearby.commune || nearby.category}</div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">Click para ver tarjeta</div>
                        </div>
                      </MarkerTooltip>
                    )}
                  </MapMarker>
                );
              })}

              {/* Current Store Main Highlighted Marker */}
              <MapMarker
                longitude={currentLocale.lng}
                latitude={currentLocale.lat}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPopupLocale(currentLocale);
                  mapRef.current?.flyTo({
                    center: [currentLocale.lng, currentLocale.lat],
                    zoom: 15,
                    duration: 900,
                    essential: true,
                  });
                }}
              >
                <MarkerContent>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPopupLocale(currentLocale);
                      mapRef.current?.flyTo({
                        center: [currentLocale.lng, currentLocale.lat],
                        zoom: 15,
                        duration: 900,
                        essential: true,
                      });
                    }}
                    className="relative flex items-center justify-center scale-125 z-40"
                  >
                    <span className="absolute -inset-1.5 rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <div className="relative size-10 rounded-full bg-emerald-600 border-2 border-white shadow-2xl flex items-center justify-center text-white ring-4 ring-emerald-400">
                      <CurrentCategoryIcon className="size-5 stroke-[2.2]" />
                    </div>
                    <div className="absolute -bottom-1 size-2 rotate-45 bg-emerald-600 border-r border-b border-white" />
                  </div>
                </MarkerContent>
                {selectedPopupLocale?.id !== currentLocale.id && (
                  <MarkerTooltip>
                    <div className="p-1 min-w-[150px] text-left">
                      <div className="font-bold text-xs text-white">{currentLocale.name}</div>
                      <div className="text-[10px] text-emerald-400 font-semibold">{currentLocale.address || currentLocale.commune}</div>
                    </div>
                  </MarkerTooltip>
                )}
              </MapMarker>

              {/* Rich Card Popup when clicking any marker */}
              {selectedPopupLocale && (
                <MapPopup
                  key={selectedPopupLocale.id}
                  longitude={selectedPopupLocale.lng}
                  latitude={selectedPopupLocale.lat}
                  onClose={() => setSelectedPopupLocale(null)}
                  closeButton
                  closeOnClick={false}
                  offset={24}
                  className="p-0 border-none bg-transparent shadow-none"
                >
                  <div className="p-3.5 min-w-[270px] max-w-[300px] bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                    <div className="relative aspect-video rounded-xl overflow-hidden mb-2.5 shadow-sm bg-zinc-100 dark:bg-zinc-800">
                      <img
                        src={selectedPopupLocale.image}
                        alt={selectedPopupLocale.name}
                        className="w-full h-full object-cover"
                      />
                      {selectedPopupLocale.stallNumber && (
                        <span className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {selectedPopupLocale.stallNumber}
                        </span>
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <h4 className="font-serif font-bold text-sm text-zinc-900 dark:text-white leading-tight">
                        {selectedPopupLocale.name}
                      </h4>
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                        <Star className="size-3 fill-amber-500 text-amber-500" />
                        <span>{selectedPopupLocale.rating}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
                      <MapPin className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="truncate">
                        {selectedPopupLocale.address ? `${selectedPopupLocale.address}, ` : ''}
                        {selectedPopupLocale.commune || selectedPopupLocale.region}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2.5 line-clamp-2 leading-relaxed">
                      {selectedPopupLocale.description}
                    </p>

                    {selectedPopupLocale.featuredProducts && selectedPopupLocale.featuredProducts.length > 0 && (
                      <div className="mb-3 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block mb-1">
                          Precios del día:
                        </span>
                        <div className="space-y-1">
                          {selectedPopupLocale.featuredProducts.slice(0, 2).map((p, i) => (
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

                    <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/marketplace/${selectedPopupLocale.id}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                        >
                          <span>Ver Catálogo</span>
                          <ExternalLink className="size-3" />
                        </a>

                        {selectedPopupLocale.whatsappNumber && (
                          <a
                            href={`https://wa.me/${selectedPopupLocale.whatsappNumber.replace(/\+/g, '')}?text=${encodeURIComponent(
                              `¡Hola ${selectedPopupLocale.name}! Los encontré en el mapa de ChileBite y quisiera consultar por sus productos.`
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

                      <div className="flex items-center gap-1.5 text-[11px]">
                        <a
                          href={getGoogleMapsUrl(selectedPopupLocale.lat, selectedPopupLocale.lng, selectedPopupLocale.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition-colors"
                        >
                          <Navigation className="size-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Google Maps</span>
                        </a>
                        <a
                          href={getWazeUrl(selectedPopupLocale.lat, selectedPopupLocale.lng)}
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
          </Card>
        </div>

        {/* Right Column: Direction Cards & Info */}
        <div className="flex flex-col justify-between gap-4 p-6 rounded-3xl mp-card border mp-border shadow-xl">
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Detalles de Acceso
              </span>
              <h3 className="font-serif text-xl font-bold mp-text-title leading-tight">
                {currentLocale.name}
              </h3>
              {currentLocale.stallNumber && (
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {currentLocale.stallNumber}
                </p>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <MapPin className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="mp-text-title font-medium leading-relaxed">
                  {currentLocale.address ? `${currentLocale.address}, ` : ''}
                  {currentLocale.commune || currentLocale.region}
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span className="mp-text-muted leading-relaxed">
                  {currentLocale.hours || 'Atención en horario habitual de feria'}
                </span>
              </div>

              {currentDistanceKm !== null ? (
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <Navigation className="size-4 shrink-0 mt-0.5" />
                  <span>A {formatDistance(currentDistanceKm)} de tu ubicación actual.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 text-zinc-500 dark:text-zinc-400">
                  <Navigation className="size-4 shrink-0 mt-0.5" />
                  <span>Distancia aproximada: a {currentLocale.distance}.</span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Action Buttons (Clean Lucide Icons, No Emojis) */}
          <div className="space-y-2 pt-4 border-t mp-border">
            <span className="text-[11px] font-bold mp-text-muted uppercase tracking-wider block mb-1">
              Trazar Ruta Directa:
            </span>

            <a
              href={getGoogleMapsUrl(currentLocale.lat, currentLocale.lng, currentLocale.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-semibold text-xs transition-all shadow-xs active:scale-95"
            >
              <Navigation className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>Abrir en Google Maps</span>
              <ExternalLink className="size-3 mp-text-muted ml-auto" />
            </a>

            <a
              href={getWazeUrl(currentLocale.lat, currentLocale.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-semibold text-xs transition-all shadow-xs active:scale-95"
            >
              <Compass className="size-4 text-sky-600 dark:text-sky-400" />
              <span>Abrir en Waze</span>
              <ExternalLink className="size-3 mp-text-muted ml-auto" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

