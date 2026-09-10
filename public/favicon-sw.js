const CACHE_NAME = 'karmancos-favicons-v1'
const FAVICON_HOSTS = new Set([
  'icons.duckduckgo.com',
  'www.google.com',
])

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('karmancos-favicons-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url)
  if (event.request.destination !== 'image' || !FAVICON_HOSTS.has(requestUrl.hostname)) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) return cached
      try {
        const response = await fetch(event.request)
        if (response.ok || response.type === 'opaque') await cache.put(event.request, response.clone())
        return response
      } catch {
        return cached || Response.error()
      }
    }),
  )
})
