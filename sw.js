const CACHE = 'vivi-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './store.js',
  './todos.js',
  './calendar.js',
  './app.js',
  './weather.js',
  './notes.js',
  './manifest.json',
  './fonts/great-vibes.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // network-first for pages and scripts so updates reach users; cache fallback offline
  const dest = e.request.destination;
  const networkFirst = e.request.mode === 'navigate' || dest === 'script' || dest === 'style';

  if (networkFirst) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }))
  );
});
