/* ═══════════════════════════════════════════════════════
   SIIE PWA · sw.js · Service Worker
   Estrategia: Cache First para assets, Network First para API
   ═══════════════════════════════════════════════════════ */

const CACHE_NAME = 'siie-v1.0.0';
const CACHE_STATIC = 'siie-static-v1.0.0';

/* Assets que se cachean en la instalación */
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
];

/* ── INSTALL: cachear assets estáticos ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: limpiar cachés viejos ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: estrategia por tipo de request ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* API de Apps Script → Network First (sin cachear respuestas de API) */
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(networkFirst(request));
    return;
  }

  /* Google Fonts → Cache First */
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  /* Assets estáticos → Cache First */
  if (request.destination === 'document' ||
      request.destination === 'script' ||
      request.destination === 'style') {
    event.respondWith(cacheFirst(request));
    return;
  }

  /* Imágenes → Cache First con fallback */
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  /* Default → Network */
  event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
});

/* ── ESTRATEGIAS ── */

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Sin conexión' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    /* Sin red: devolver respuesta offline genérica para la API */
    return new Response(
      JSON.stringify({ ok: false, error: 'Sin conexión', offline: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/* ── BACKGROUND SYNC (cuando vuelve la conexión) ── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-relevamientos') {
    event.waitUntil(syncRelevamientos());
  }
});

async function syncRelevamientos() {
  /* El sync real se maneja en app.js (syncPendingData).
     Acá solo notificamos a los clientes activos. */
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_AVAILABLE' });
  });
}

/* ── NOTIFICACIONES PUSH (futuro) ── */
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'SIIE', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
  );
});
