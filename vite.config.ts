import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Echte Codezeilen für die Fun Facts, beim Bauen gezählt (TypeScript/React, Server, Android-Plugins)
function countCodeLines(): number {
  const root = path.dirname(new URL(import.meta.url).pathname);
  let total = 0;
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|java)$/.test(e.name) && !e.name.endsWith('.d.ts')) total += fs.readFileSync(p, 'utf8').split('\n').length;
    }
  };
  ['src', 'server', 'android-native'].forEach(d => walk(path.join(root, d)));
  if (fs.existsSync(path.join(root, 'server.ts'))) total += fs.readFileSync(path.join(root, 'server.ts'), 'utf8').split('\n').length;
  return total;
}

export default defineConfig(() => {
  return {
    // Für GitHub Pages wird per VITE_BASE ein Unterpfad gesetzt (z. B. /filament-website-google-ai/).
    base: process.env.VITE_BASE || '/',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __CODE_LINES__: JSON.stringify(countCodeLines())
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: false, // Verwende public/manifest.json
        devOptions: {
          enabled: false,
          type: 'module'
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          // React und weitere Bibliotheken in eigene Dateien: bleiben bei App-Updates im Cache, die App lädt schneller
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
              { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/, priority: 15 },
              { name: 'vendor', test: /node_modules[\\/]/, priority: 10 }
            ]
          }
        }
      }
    }
  };
});
