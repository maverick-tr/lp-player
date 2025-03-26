const CACHE_NAME = 'luxson-ai-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/luxson-logo.png',
  // Add other static assets here
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
}); 