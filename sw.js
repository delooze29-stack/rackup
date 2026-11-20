// RackUp offline cache. Bump the version when you upload a new index.html if it seems stuck.
const C = 'rackup-v4';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const timeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r('timeout'), ms))]);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // Never touch Firebase traffic: the database handles its own offline queue.
  if (/firestore\.googleapis|identitytoolkit|securetoken|firebaseinstallations/.test(u.host)) return;
  if (u.origin === location.origin) {
    // App files: try the network (3s), fall back to the saved copy when there's no signal.
    e.respondWith(
      timeout(fetch(e.request), 3000)
        .then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  if (/gstatic\.com|fonts\.googleapis\.com/.test(u.host)) {
    // Firebase code + fonts: keep a copy so the app starts offline.
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const cp = res.clone(); caches.open(C).then(c => c.put(e.request, cp)); return res;
      }))
    );
  }
});
