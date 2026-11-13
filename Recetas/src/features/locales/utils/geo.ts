/**
 * Utilidades geoespaciales para el Marketplace de ChileBite
 * Cálculo de distancias Haversine, formato de distancias y enlaces de navegación
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Calcula la distancia en kilómetros entre dos coordenadas usando la fórmula de Haversine
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formatea una distancia en km a formato legible para humanos en Chile
 * ej: "850 m" o "3.2 km"
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Centros geográficos aproximados de las regiones de Chile para encuadre del mapa
 */
export const REGION_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  "Todas": { lat: -33.4489, lng: -70.6693, zoom: 11 },
  "Metropolitana de Santiago": { lat: -33.4489, lng: -70.6693, zoom: 11 },
  "Valparaíso": { lat: -33.0472, lng: -71.6127, zoom: 12 },
  "Coquimbo": { lat: -29.9533, lng: -71.3436, zoom: 12 },
  "La Araucanía": { lat: -38.7359, lng: -72.5850, zoom: 12 },
  "Los Lagos": { lat: -41.4815, lng: -72.9682, zoom: 12 },
  "Biobío": { lat: -36.8270, lng: -73.0503, zoom: 11 },
  "O'Higgins": { lat: -34.2890, lng: -71.2200, zoom: 10 },
  "Maule": { lat: -35.4264, lng: -71.6554, zoom: 11 },
  "Ñuble": { lat: -36.6067, lng: -72.1033, zoom: 11 },
  "Los Ríos": { lat: -39.8142, lng: -73.2459, zoom: 11 },
  "Antofagasta": { lat: -23.6509, lng: -70.3975, zoom: 11 },
  "Atacama": { lat: -27.3668, lng: -70.3323, zoom: 11 },
  "Tarapacá": { lat: -20.2133, lng: -70.1503, zoom: 11 },
  "Arica y Parinacota": { lat: -18.4783, lng: -70.3126, zoom: 11 },
  "Aysén": { lat: -45.5752, lng: -72.0662, zoom: 10 },
  "Magallanes": { lat: -53.1638, lng: -70.9171, zoom: 10 },
};

/**
 * Enlace para navegar hacia el local en Google Maps
 */
export function getGoogleMapsUrl(lat: number, lng: number, name?: string): string {
  const query = name ? encodeURIComponent(`${name}, Chile`) : `${lat},${lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${query}&destination_place_id=&travelmode=driving`;
}

/**
 * Enlace para navegar hacia el local en Waze
 */
export function getWazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

/**
 * Verifica si el usuario tiene activado el permiso de guardar y usar su ubicación
 */
export function isLocationSavingEnabled(): boolean {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chilebite_geo_consent') === 'accepted';
    }
  } catch {}
  return false;
}

/**
 * Guarda la ubicación del usuario en almacenamiento local y de sesión si el consentimiento está activo
 */
export function saveUserLocationSession(coords: Coordinates): void {
  try {
    if (typeof window !== 'undefined') {
      const serialized = JSON.stringify(coords);
      sessionStorage.setItem('chilebite_user_coords', serialized);
      if (localStorage.getItem('chilebite_geo_consent') === 'accepted') {
        localStorage.setItem('chilebite_user_coords', serialized);
      }
      window.dispatchEvent(new CustomEvent('chilebite:location-changed', { detail: coords }));
    }
  } catch {}
}

/**
 * Activa o desactiva la opción de guardar y utilizar la ubicación del usuario (usado en Ajustes y Modal de Consentimiento)
 */
export function setLocationSavingPreference(enabled: boolean, coords?: Coordinates | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (enabled) {
      localStorage.setItem('chilebite_geo_consent', 'accepted');
      localStorage.setItem('chilebite_save_location', 'true');
      if (coords) {
        const serialized = JSON.stringify(coords);
        localStorage.setItem('chilebite_user_coords', serialized);
        sessionStorage.setItem('chilebite_user_coords', serialized);
      }
      window.dispatchEvent(new CustomEvent('chilebite:location-changed', { detail: coords || getSavedUserLocationSession() }));
    } else {
      localStorage.setItem('chilebite_geo_consent', 'declined');
      localStorage.setItem('chilebite_save_location', 'false');
      localStorage.removeItem('chilebite_user_coords');
      sessionStorage.removeItem('chilebite_user_coords');
      window.dispatchEvent(new CustomEvent('chilebite:location-changed', { detail: null }));
    }
  } catch {}
}

/**
 * Recupera la ubicación guardada del usuario si el permiso está activo
 */
export function getSavedUserLocationSession(): Coordinates | null {
  try {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('chilebite_geo_consent') === 'declined') {
        return null;
      }
      const raw = localStorage.getItem('chilebite_user_coords') || sessionStorage.getItem('chilebite_user_coords');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
        return parsed;
      }
    }
  } catch {}
  return null;
}


