import { locales, type Locale } from '../data/locales';
import { calculateHaversineDistance, formatDistance, type Coordinates } from './geo';

export interface NearbyIngredientMatch {
  locale: Locale;
  distanceKm: number;
  distanceFormatted: string;
  matchedProduct: {
    name: string;
    price: number;
    unit: string;
  } | null;
}

export interface IngredientLookupResult {
  searchKeyword: string;
  displayIngredient: string;
  isMarketplaceIngredient: boolean;
  nearbyMatches: NearbyIngredientMatch[];
  nearbyGeneralLocales: Array<{
    locale: Locale;
    distanceKm: number;
    distanceFormatted: string;
  }>;
}

const STOP_UNITS_AND_WORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'al', 'con', 'sin', 'por', 'para', 'en', 'o', 'y', 'a',
  'kg', 'kilo', 'kilos', 'g', 'gr', 'grs', 'gramos', 'mg', 'l', 'lt', 'litro', 'litros', 'ml', 'cc',
  'taza', 'tazas', 'cucharada', 'cucharadas', 'cda', 'cdas', 'cucharadita', 'cucharaditas', 'cdta', 'cdtas',
  'unidad', 'unidades', 'und', 'diente', 'dientes', 'cabeza', 'cabezas', 'atado', 'atados', 'paquete', 'paquetes',
  'pizca', 'pizcas', 'chorrito', 'chorro', 'tiras', 'tira', 'rodaja', 'rodajas', 'rebanada', 'rebanadas',
  'rama', 'ramas', 'hoja', 'hojas', 'trozo', 'trozos', 'cubo', 'cubos', 'lata', 'latas', 'tarro', 'tarros',
  'sobre', 'sobres', 'puñado', 'pote', 'vaso', 'vasos', 'media', 'medio', 'cuarto',
  'picado', 'picada', 'picados', 'picadas', 'rallado', 'rallada', 'molido', 'molida', 'fresco', 'fresca', 'frescos', 'frescas',
  'grande', 'grandes', 'mediano', 'mediana', 'pequeño', 'pequeña', 'cortado', 'cortada', 'pelado', 'pelada', 'cocido', 'cocida',
  'crudo', 'cruda', 'desgranado', 'desgranada', 'lavado', 'lavada', 'limpio', 'limpia', 'entero', 'entera', 'gusto', 'opcional'
]);

const normalize = (str: string): string =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const singularize = (word: string): string => {
  const w = normalize(word);
  if (w.length <= 3) return w;
  if (w.endsWith('es') && !w.endsWith('tes') && !w.endsWith('les') && w.endsWith('nes')) {
    return w.slice(0, -2); // piñones -> piñon, limones -> limon
  }
  if (w.endsWith('ces')) {
    return w.slice(0, -3) + 'z'; // nueces -> nuez
  }
  if (w.endsWith('s') && !w.endsWith('is')) {
    return w.slice(0, -1); // tomates -> tomate, papas -> papa, paltas -> palta
  }
  return w;
};

/**
 * Extrae el nombre limpio del ingrediente desde un objeto estructurado o línea de texto de receta
 */
export function extractIngredientKeyword(rawText?: string, structuredName?: string): {
  searchKeyword: string;
  displayIngredient: string;
} {
  const source = (structuredName && structuredName.trim()) ? structuredName.trim() : (rawText || '').trim();
  if (!source) {
    return { searchKeyword: '', displayIngredient: 'Ingrediente' };
  }

  // Limpiar números, fracciones y signos de puntuación
  const cleaned = source
    .replace(/\([^)]*\)/g, ' ') // quitar paréntesis
    .replace(/[0-9¼½¾⅓⅔⅛⅜⅝⅞.,/+-]+/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_UNITS_AND_WORDS.has(normalize(t)));

  if (tokens.length === 0) {
    return { searchKeyword: cleaned || source, displayIngredient: cleaned || source };
  }

  // Si es estructurado (ej. "Queso Chanco", "Tomate", "Harina Tostada"), conservamos hasta 2 palabras clave
  const primaryTokens = tokens.slice(0, 2);
  const display = primaryTokens
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return {
    searchKeyword: primaryTokens[0],
    displayIngredient: display,
  };
}

/**
 * Comprueba si dos nombres de ingrediente coinciden (considerando singular/plural y raíces)
 */
function termsMatch(candidate: string, query: string): boolean {
  const normCand = normalize(candidate);
  const normQuery = normalize(query);
  if (!normCand || !normQuery || normQuery.length < 2) return false;

  if (normCand.includes(normQuery) || normQuery.includes(normCand)) {
    return true;
  }

  const singCand = singularize(normCand);
  const singQuery = singularize(normQuery);

  if (singCand.length >= 3 && singQuery.length >= 3) {
    if (singCand.includes(singQuery) || singQuery.includes(singCand)) {
      return true;
    }
    // Comparar cada palabra
    const candWords = normCand.split(/\s+/).map(singularize);
    const queryWords = normQuery.split(/\s+/).map(singularize);
    for (const qw of queryWords) {
      if (qw.length < 3) continue;
      if (candWords.some((cw) => cw === qw || (cw.length >= 4 && (cw.startsWith(qw) || qw.startsWith(cw))))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Busca locales cercanos a la ubicación del usuario que vendan el ingrediente consultado.
 * Solo devuelve locales dentro de `maxRadiusKm` (por defecto 35 km) para no mostrar locales lejanos.
 */
export function findNearbyLocalesForIngredient(
  rawText: string,
  structuredName: string | undefined,
  userLocation: Coordinates | null,
  maxRadiusKm = 35
): IngredientLookupResult {
  const { searchKeyword, displayIngredient } = extractIngredientKeyword(rawText, structuredName);
  const fullPhrase = structuredName?.trim() || displayIngredient;

  // Verificar si algún local en la plataforma vende este ingrediente y obtener el término canónico de tag
  let canonicalTag = searchKeyword;
  let existsInAnyStore = false;

  for (const loc of locales) {
    const matchedTag = loc.tags.find((t) => termsMatch(t, fullPhrase) || termsMatch(t, searchKeyword));
    if (matchedTag) {
      existsInAnyStore = true;
      canonicalTag = matchedTag;
      break;
    }
    const matchedFeat = loc.featuredProducts?.find(
      (p) => termsMatch(p.name, fullPhrase) || termsMatch(p.name, searchKeyword)
    );
    if (matchedFeat) {
      existsInAnyStore = true;
      canonicalTag = matchedFeat.name;
      break;
    }
    const matchedCat = loc.catalog?.find(
      (c) => termsMatch(c.name, fullPhrase) || termsMatch(c.name, searchKeyword)
    );
    if (matchedCat) {
      existsInAnyStore = true;
      break;
    }
  }

  if (!userLocation) {
    return {
      searchKeyword: canonicalTag || searchKeyword,
      displayIngredient,
      isMarketplaceIngredient: existsInAnyStore,
      nearbyMatches: [],
      nearbyGeneralLocales: [],
    };
  }

  // Filtrar estrictamente locales cercanos a la ubicación del usuario (<= maxRadiusKm)
  const localesWithDistance = locales
    .map((locale) => {
      const distanceKm = calculateHaversineDistance(
        userLocation.lat,
        userLocation.lng,
        locale.lat,
        locale.lng
      );
      return {
        locale,
        distanceKm,
        distanceFormatted: formatDistance(distanceKm),
      };
    })
    .filter((item) => item.distanceKm <= maxRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearbyMatches: NearbyIngredientMatch[] = [];

  for (const item of localesWithDistance) {
    const { locale, distanceKm, distanceFormatted } = item;

    // 1. Buscar en catálogo detallado
    const catProd = locale.catalog?.find(
      (p) => p.inStock && (termsMatch(p.name, fullPhrase) || termsMatch(p.name, searchKeyword))
    );

    // 2. Buscar en productos destacados del día
    const featProd = locale.featuredProducts?.find(
      (p) => termsMatch(p.name, fullPhrase) || termsMatch(p.name, searchKeyword)
    );

    // 3. Buscar en tags del local
    const tagMatch = locale.tags.find(
      (t) => termsMatch(t, fullPhrase) || termsMatch(t, searchKeyword)
    );

    if (catProd || featProd || tagMatch) {
      const productInfo = catProd
        ? { name: catProd.name, price: catProd.price, unit: catProd.unit }
        : featProd
          ? { name: featProd.name, price: featProd.price, unit: featProd.unit }
          : null;

      if (tagMatch && canonicalTag === searchKeyword) {
        canonicalTag = tagMatch;
      }

      nearbyMatches.push({
        locale,
        distanceKm,
        distanceFormatted,
        matchedProduct: productInfo,
      });
    }
  }

  return {
    searchKeyword: canonicalTag || searchKeyword,
    displayIngredient,
    isMarketplaceIngredient: existsInAnyStore,
    nearbyMatches,
    nearbyGeneralLocales: localesWithDistance.slice(0, 3),
  };
}

