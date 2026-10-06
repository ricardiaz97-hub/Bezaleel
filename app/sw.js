// Keeps Bezaleel working without internet. Bump VERSION when any app file changes.
const VERSION = 'bezaleel-v4';
const SHELL = [
  './', './index.html', './engine.js', './rhythm.js', './person.js',
  './vendor/rnnoise/workletProcessor.js', './vendor/rnnoise/rnnoise.wasm', './vendor/rnnoise/rnnoise_simd.wasm', './manifest.webmanifest', './fonts.css',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
  './fonts/Archivo-normal-400-900-latin-ext.woff2',
  './fonts/Archivo-normal-400-900-latin.woff2',
  './fonts/BebasNeue-normal-400-latin-ext.woff2',
  './fonts/BebasNeue-normal-400-latin.woff2',
  './fonts/Caveat-normal-700-latin-ext.woff2',
  './fonts/Caveat-normal-700-latin.woff2',
  './fonts/JetBrainsMono-normal-400-latin-ext.woff2',
  './fonts/JetBrainsMono-normal-400-latin.woff2',
  './fonts/JetBrainsMono-normal-600-latin-ext.woff2',
  './fonts/JetBrainsMono-normal-600-latin.woff2',
  './fonts/Montserrat-normal-400-latin-ext.woff2',
  './fonts/Montserrat-normal-400-latin.woff2',
  './fonts/Montserrat-normal-600-latin-ext.woff2',
  './fonts/Montserrat-normal-600-latin.woff2',
  './fonts/Montserrat-normal-700-latin-ext.woff2',
  './fonts/Montserrat-normal-700-latin.woff2',
  './fonts/Montserrat-normal-800-latin-ext.woff2',
  './fonts/Montserrat-normal-800-latin.woff2',
  './fonts/Oswald-normal-400-latin-ext.woff2',
  './fonts/Oswald-normal-400-latin.woff2',
  './fonts/Oswald-normal-500-latin-ext.woff2',
  './fonts/Oswald-normal-500-latin.woff2',
  './fonts/Oswald-normal-700-latin-ext.woff2',
  './fonts/Oswald-normal-700-latin.woff2',
  './fonts/PlayfairDisplay-italic-600-latin-ext.woff2',
  './fonts/PlayfairDisplay-italic-600-latin.woff2',
  './fonts/PlayfairDisplay-normal-600-latin-ext.woff2',
  './fonts/PlayfairDisplay-normal-600-latin.woff2',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first for the page so updates arrive; cache first for everything else.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  // The person-detection engine (~12 MB) is cached the first time a project uses it, not at install.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && new URL(req.url).pathname.includes('/vendor/mediapipe/')) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return r;
  })));
});
