'use strict';
// Service worker: alles wordt gecachet zodat het spel ook zonder internet werkt.
// Online halen we altijd eerst de nieuwste versie op (network-first), offline komt het uit de cache.
const CACHE = 'poesjepuzzel-v1';
const SHELL = [
  './', './index.html', './style.css', './manifest.json',
  './js/sound.js', './js/levels.js', './js/cat.js', './js/room.js', './js/splash.js', './js/game.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
  );
});
