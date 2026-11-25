const CACHE_NAME = 'varal-iot-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './firebase.js',
  './manifest.json'
];

// Instala o Service Worker e salva os arquivos da interface
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Intercepta requisições (mantendo Firebase e API de clima sempre online)
self.addEventListener('fetch', (event) => {
  if (
    event.request.url.includes('firebaseio.com') ||
    event.request.url.includes('open-meteo.com') ||
    event.request.url.includes('googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});