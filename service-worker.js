const CACHE = 'rutaflex-v4.0';
// 👉 CADA VEZ QUE SUBAS UN CAMBIO, CAMBIÁ SOLO ESTO: v3 -> v4 -> v5...
// Así el celu borra la vieja y baja la nueva solo.
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/logo.svg',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES_TO_CACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE ? caches.delete(k) : null)))
    .then(() => self.clients.claim())
    .then(() => {
      // Avisar a la app que hay versión nueva
      return self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'NUEVA_VERSION' }));
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    return;
  }
  // Para index.html y app.js: SIEMPRE intentar bajar lo nuevo primero, si no hay internet usar lo guardado
  // Así el cambio se ve al toque cuando entra de nuevo
  if (event.request.url.includes('/index.html') || event.request.url.endsWith('/') || event.request.url.includes('/app.js')) {
    event.respondWith(
      fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return res;
      }).catch(() => caches.match(event.request).then((res) => res || caches.match('/index.html')))
    );
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((res) => res || caches.match('/index.html')))
  );
});

// Escuchar cuando la app pide actualizar
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
