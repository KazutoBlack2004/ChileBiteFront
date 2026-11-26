import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const INGREDIENT_CATEGORIES = [
  'Vegetales',
  'Frutas',
  'Carnes y Aves',
  'Pescados y Mariscos',
  'Lácteos y Huevos',
  'Legumbres',
  'Cereales y Granos',
  'Frutos Secos y Semillas',
  'Grasas y Aceites',
  'Especias y Hierbas',
  'Dulces y Azúcares',
  'Bebidas',
  'Otros'
];

function normalizeCategory(rawCat) {
  if (!rawCat) return 'Otros';
  const clean = rawCat.trim();
  const lower = clean.toLowerCase();

  if (lower === 'vegetales' || lower.includes('vegetal') || lower.includes('verdur') || lower === 'hortalizas') return 'Vegetales';
  if (lower === 'frutas' || (lower.includes('frut') && !lower.includes('seco'))) return 'Frutas';
  if (lower.includes('carne') || lower.includes('ave') || lower.includes('pollo') || lower.includes('vacuno') || lower.includes('cerdo')) return 'Carnes y Aves';
  if (lower.includes('pescado') || lower.includes('marisco') || lower.includes('mar') || lower.includes('atun') || lower.includes('atún') || lower.includes('salm')) return 'Pescados y Mariscos';
  if (lower.includes('lacteo') || lower.includes('lácteo') || lower.includes('leche') || lower.includes('queso') || lower.includes('huevo') || lower.includes('yogur')) return 'Lácteos y Huevos';
  if (lower.includes('legumbre') || lower.includes('poroto') || lower.includes('lenteja') || lower.includes('garbanzo') || lower.includes('arveja')) return 'Legumbres';
  if (lower.includes('panader') || lower.includes('pan') || lower.includes('harina') || lower.includes('cereal') || lower.includes('grano') || lower.includes('pasta') || lower.includes('arroz') || lower.includes('avena')) return 'Cereales y Granos';
  if (lower.includes('seco') || lower.includes('semilla') || lower.includes('nuez') || lower.includes('almendra') || lower.includes('chia') || lower.includes('maní')) return 'Frutos Secos y Semillas';
  if (lower.includes('grasa') || lower.includes('aceite') || lower.includes('manteca') || lower.includes('oliva')) return 'Grasas y Aceites';
  if (lower.includes('especia') || lower.includes('hierba') || lower.includes('condimento') || lower.includes('sal') || lower.includes('pimienta') || lower.includes('oregano') || lower.includes('orégano')) return 'Especias y Hierbas';
  if (lower.includes('dulce') || lower.includes('azucar') || lower.includes('azúcar') || lower.includes('miel') || lower.includes('chocolate') || lower.includes('sirope')) return 'Dulces y Azúcares';
  if (lower.includes('bebida') || lower.includes('jugo') || lower.includes('infusion') || lower.includes('infusión') || lower.includes('cafe') || lower.includes('café') || lower.includes('vino')) return 'Bebidas';

  const match = INGREDIENT_CATEGORIES.find(c => c.toLowerCase() === lower);
  return match || 'Otros';
}

export const POST = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('X-Supabase-Auth');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No se proporcionó el token de autorización.' }), { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Configuración de Supabase incompleta en el servidor.' }), { status: 500 });
    }

    const supabaseServer = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión no válida o expirada.' }), { status: 401 });
    }

    // Verify admin role
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin' || profile?.rol === 'admin';
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Permisos insuficientes: se requiere rol de administrador.' }), { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const nombre = (body.nombre || '').trim();

    if (!nombre || nombre.length < 2) {
      return new Response(JSON.stringify({ error: 'Por favor, proporciona un nombre válido de ingrediente (mínimo 2 caracteres).' }), { status: 400 });
    }

    const geminiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || import.meta.env.PUBLIC_GEMINI_API_KEY;
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY no está configurada en las variables de entorno.' }), { status: 500 });
    }

    const systemPrompt = `Eres un asistente experto en nutrición, bromatología y gastronomía chilena e internacional para la plataforma ChileBite.
Tu tarea es estimar y proporcionar información nutricional, categoría oficial, tipo de medida, pesos aproximados y sellos para un ingrediente dado.

DEBES responder SIEMPRE en formato JSON estricto con los siguientes campos y restricciones:

1. "categoria": DEBE ser EXACTAMENTE una de estas 13 categorías oficiales:
   - "Vegetales"
   - "Frutas"
   - "Carnes y Aves"
   - "Pescados y Mariscos"
   - "Lácteos y Huevos"
   - "Legumbres"
   - "Cereales y Granos"
   - "Frutos Secos y Semillas"
   - "Grasas y Aceites"
   - "Especias y Hierbas"
   - "Dulces y Azúcares"
   - "Bebidas"
   - "Otros"

2. "tipo_medida": DEBE ser EXACTAMENTE una de estas 3 opciones:
   - "volumen": para líquidos, bebibles, aceites, vinagres, salsas fluidas, leche, caldos.
   - "unidad": para piezas contables enteras (huevos, frutas enteras como manzana o plátano, verduras enteras como tomate, cebolla, palta, zanahoria).
   - "peso": para sólidos pesables a granel (harinas, carnes, legumbres, arroz, azúcar, sales, frutos secos).

3. Valores nutricionales POR CADA 100g (o 100ml en líquidos):
   - "calorias_por_100g": número redondeado a 1 decimal o entero (kcal)
   - "proteinas_por_100g": número (g)
   - "grasas_por_100g": número (g)
   - "carbohidratos_por_100g": número (g)
   - "fibra_por_100g": número (g)
   - "azucares_por_100g": número (g)
   - "sodio_mg_por_100g": número (mg)

4. Equivalencias y conversiones caseras (en gramos o ml):
   - "peso_por_unidad_gramos": número o null. Peso de 1 pieza o unidad promedio entera (ej: 1 huevo ≈ 55, 1 palta ≈ 150, 1 manzana ≈ 180, 1 cebolla ≈ 150, 1 diente de ajo ≈ 5). Si el ingrediente es harina, líquido o granel incontable, devuelve null.
   - "peso_por_taza_gramos": número o null. Peso en gramos (o ml) que cabe en 1 taza estándar (240ml). Ej: 1 taza de harina de trigo ≈ 120, 1 taza de azúcar ≈ 200, 1 taza de leche ≈ 240, 1 taza de arroz crudo ≈ 200.
   - "peso_por_cucharada_gramos": número o null. Peso en gramos (o ml) de 1 cucharada sopera estándar (15ml). Ej: 1 cda de aceite ≈ 14, 1 cda de sal ≈ 15, 1 cda de azúcar ≈ 15, 1 cda de harina ≈ 10.

5. Certificaciones y dieta:
   - "es_vegano": boolean (true si no contiene ingredientes de origen animal: carne, leche, huevo, miel, gelatina).
   - "es_libre_de_gluten": boolean (true si no contiene trigo, cebada, centeno, avena con gluten ni derivados).

Responde ÚNICAMENTE con el objeto JSON válido, sin markdown ni explicaciones adicionales.`;

    let res;
    let geminiData;
    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: `Ingrediente: ${nombre}` }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      geminiData = await res.json().catch(() => null);

      if (res.ok && !geminiData?.error) {
        break;
      }

      const isRateLimitOrOverload = geminiData?.error?.message?.includes("quota") ||
                                    geminiData?.error?.message?.includes("limit") ||
                                    geminiData?.error?.message?.includes("demand") ||
                                    res.status === 429 || res.status === 503;

      if (!isRateLimitOrOverload) {
        break;
      }

      retries--;
      if (retries > 0) {
        console.warn(`[Gemini Autocomplete] Solicitud saturada. Reintentando en ${delay}ms... (Intentos restantes: ${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    if (!res?.ok || geminiData?.error) {
      const errMsg = geminiData?.error?.message || 'Error en el servicio de IA de Gemini';
      if (res?.status === 429 || res?.status === 503 || errMsg.includes("quota") || errMsg.includes("demand") || errMsg.includes("limit")) {
        return new Response(JSON.stringify({
          error: 'El servicio de IA está con alta demanda temporal. Por favor, intenta de nuevo en unos segundos.'
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: errMsg }), { status: res?.status || 500, headers: { 'Content-Type': 'application/json' } });
    }

    const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      return new Response(JSON.stringify({ error: 'La IA no devolvió datos para este ingrediente.' }), { status: 500 });
    }

    const cleanJson = textResponse.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const rawParsed = JSON.parse(cleanJson);

    // Sanitize and validate fields
    const sanitized = {
      categoria: normalizeCategory(rawParsed.categoria),
      tipo_medida: ['peso', 'volumen', 'unidad'].includes(rawParsed.tipo_medida) ? rawParsed.tipo_medida : 'peso',
      calorias_por_100g: Math.max(0, Number(rawParsed.calorias_por_100g) || 0),
      proteinas_por_100g: Math.max(0, Number(rawParsed.proteinas_por_100g) || 0),
      grasas_por_100g: Math.max(0, Number(rawParsed.grasas_por_100g) || 0),
      carbohidratos_por_100g: Math.max(0, Number(rawParsed.carbohidratos_por_100g) || 0),
      fibra_por_100g: Math.max(0, Number(rawParsed.fibra_por_100g) || 0),
      azucares_por_100g: Math.max(0, Number(rawParsed.azucares_por_100g) || 0),
      sodio_mg_por_100g: Math.max(0, Number(rawParsed.sodio_mg_por_100g) || 0),
      peso_por_unidad_gramos: (rawParsed.peso_por_unidad_gramos !== null && rawParsed.peso_por_unidad_gramos !== undefined && rawParsed.peso_por_unidad_gramos !== '') 
        ? Math.max(0, Number(rawParsed.peso_por_unidad_gramos) || 0) 
        : null,
      peso_por_taza_gramos: (rawParsed.peso_por_taza_gramos !== null && rawParsed.peso_por_taza_gramos !== undefined && rawParsed.peso_por_taza_gramos !== '') 
        ? Math.max(0, Number(rawParsed.peso_por_taza_gramos) || 0) 
        : null,
      peso_por_cucharada_gramos: (rawParsed.peso_por_cucharada_gramos !== null && rawParsed.peso_por_cucharada_gramos !== undefined && rawParsed.peso_por_cucharada_gramos !== '') 
        ? Math.max(0, Number(rawParsed.peso_por_cucharada_gramos) || 0) 
        : null,
      es_vegano: Boolean(rawParsed.es_vegano),
      es_libre_de_gluten: Boolean(rawParsed.es_libre_de_gluten)
    };

    // Safely attempt to log usage without failing the request if schema differs
    try {
      await supabaseServer.from('ai_usage_log').insert({
        user_id: user.id,
        tokens_used: geminiData.usageMetadata?.totalTokenCount || 0
      });
    } catch (logErr) {
      console.warn("Could not log AI usage:", logErr?.message);
    }

    return new Response(JSON.stringify({
      success: true,
      ingredient: nombre,
      data: sanitized
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("Error en autocomplete-ingredient API:", err);
    return new Response(JSON.stringify({ error: err.message || 'Error interno del servidor al procesar la solicitud con IA.' }), { status: 500 });
  }
};
