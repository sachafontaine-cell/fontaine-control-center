// Keeps the app on the tablet so it opens instantly, even offline. Bump VERSION with app.js.
const VERSION = '0.3.3';
const CACHE = 'fcc-' + VERSION;
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'config.js', 'demo.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/favicon.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' = always take fresh files from GitHub, never the browser's older copy.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// App files: from the tablet first (instant). Google data and weather: always from the network.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true })).then((hit) => hit || fetch(e.request)));
});
