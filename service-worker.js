const CACHE_NAME = 'rutaflex-v3'; // <-- SUBI LA VERSION CADA VEZ QUE CAMBIES app.js / index.html
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/logo.svg',
  '/favicon.ico',
  '/satellite-dark.png',
  '/manifest.json'
  // OJO: NO cacheamos /app.js aca, ese va siempre a red primero (abajo)
];

self.addEventListener('install', (e) => {
  console.log('[RutaFlex SW] Install v3');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[RutaFlex SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('[RutaFlex SW] Error cacheando shell', err))
  );
  self.skipWaiting(); // activa enseguida el nuevo SW
});

self.addEventListener('activate', (e) => {
  console.log('[RutaFlex SW] Activate v3 - Borrando caches viejos');
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Borra rutaflex-v1, rutaflex-v2 y cualquier viejo
          if (cacheName !== CACHE_NAME && cacheName.startsWith('rutaflex-')) {
            console.log('[RutaFlex SW] Borrando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1. NUNCA cachear las APIs - siempre van a red
  // Si cacheamos /api/destinos o /api/report-error, te llegan datos viejos
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 2. NO cachear Nominatim ni Google - siempre a red
  if (url.hostname.includes('nominatim.openstreetmap.org') || url.hostname.includes('google.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 3. Para app.js e index.html -> NETWORK FIRST
  // Primero intenta bajar el nuevo, si no hay internet usa el cacheado
  // Asi cuando subis un arreglo, al usuario le llega al instante
  if (url.pathname === '/app.js' || url.pathname === '/index.html' || url.pathname === '/') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Guardamos copia nueva en cache para offline
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => {
          // Sin internet -> devolve lo cacheado
          return caches.match(e.request);
        })
    );
    return;
  }

  // 4. Para el resto (css, imagenes, logo) -> CACHE FIRST
  // Esos casi no cambian, ahi si conviene que vaya rapido
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        // Solo cachear si es 200 y mismo origen
        if (response.status === 200 && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Si falla todo, no romper
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Mensaje para forzar update desde la app si hace falta
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
