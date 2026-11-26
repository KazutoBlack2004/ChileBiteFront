import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import { createClient } from '@supabase/supabase-js';

// Obtenemos las credenciales para la compilación (con fallbacks)
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || 'https://tnzpojvhsxjzfachozid.supabase.co';
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_rJKjnreA7A8lP_zTwgvGxw_FMciqFlo';

let recipeUrls = [];
try {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('core_receta')
    .select('id');
    
  if (error) {
    console.error("Error al obtener recetas para el sitemap:", error.message);
  } else if (data) {
    recipeUrls = data.map(recipe => `https://chilebite.cl/recipes/${recipe.id}`);
  }
} catch (err) {
  console.error("Error al generar las páginas personalizadas para el sitemap:", err);
}

const nodeFetchShimPath = fileURLToPath(new URL('./src/lib/nodeFetchShim.js', import.meta.url));

// https://astro.build/config
export default defineConfig({
  site: 'https://chilebite.cl',
  trailingSlash: 'never',
  adapter: vercel(),
  build: {
    inlineStylesheets: 'always',
  },
  devToolbar: {
    enabled: false
  },

  vite: {
    plugins: [
      tailwindcss(),
      {
        name: 'tfjs-browser-node-fetch-shim',
        enforce: 'pre',
        resolveId(id) {
          if (
            id === 'node-fetch' ||
            id.includes('node-fetch/lib/index')
          ) {
            return nodeFetchShimPath;
          }
        },
      },
    ],
    resolve: {
      alias: {
        'node-fetch': nodeFetchShimPath,
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'framer-motion',
        'dompurify',
        '@heroui/react',
        '@heroui/toast',
        'lucide-react',
        '@supabase/supabase-js',
        'maplibre-gl',
        '@blobatar/react',
        'whatwg-url',
        '@tensorflow/tfjs',
        '@tensorflow-models/mobilenet',
      ],
    },
  },

  integrations: [
    react(),
    sitemap({
      customPages: recipeUrls,
    })
  ]
});