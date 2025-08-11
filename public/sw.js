const CACHE_NAME = 'enriquecer-pwa-v2'
const ASSETS = ['/', '/index.html', '/manifest.webmanifest']
self.addEventListener('install', e=>{ e.waitUntil((async()=>{ const c=await caches.open(CACHE_NAME); await c.addAll(ASSETS); self.skipWaiting() })()) })
self.addEventListener('activate', e=>{ e.waitUntil((async()=>{ const keys=await caches.keys(); await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))); self.clients.claim() })()) })
self.addEventListener('fetch', e=>{ if(e.request.method!=='GET') return; e.respondWith((async()=>{ try{ const net=await fetch(e.request); const c=await caches.open(CACHE_NAME); c.put(e.request, net.clone()); return net } catch(e2){ const cached=await caches.match(e.request); if(cached) return cached; if(e.request.mode==='navigate') return caches.match('/'); throw e2 } })()) })
