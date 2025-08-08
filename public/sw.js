const CACHE_NAME = 'finance-pwa-v1'
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(ASSETS)
    self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  event.respondWith((async () => {
    try {
      const network = await fetch(req)
      const cache = await caches.open(CACHE_NAME)
      cache.put(req, network.clone())
      return network
    } catch (e) {
      const cached = await caches.match(req)
      if (cached) return cached
      if (req.mode === 'navigate') return caches.match('/')
      throw e
    }
  })())
})
