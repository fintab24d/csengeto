// Egyszerű service worker: az oldal internet nélkül is elindul. Csak a saját fájlokat kezeli;
// az adatbázis- és időjárás-lekérések érintetlenek (az adatokat az alkalmazás maga cache-eli).
const CACHE = 'csengeto-v1'
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/']))); self.skipWaiting() })
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url)
  if (r.method !== 'GET' || u.origin !== location.origin) return
  if (r.mode === 'navigate') {   // oldal: előbb a hálózat (mindig friss verzió), nélküle a tárolt példány
    e.respondWith(fetch(r).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('/', copy)); return res }).catch(() => caches.match('/')))
    return
  }
  // fájlok (kód, képek): azonnal a tárolt példány, a háttérben frissítés
  e.respondWith(caches.match(r).then(hit => {
    const net = fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)) } return res }).catch(() => hit)
    return hit || net
  }))
})
