const CACHE_NAME = "tuner-metronome-v3";
const APP_SHELL = ["./", "./index.html", "./style.css", "./app.js", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png"];
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async path => {
      try { const response = await fetch(path, { cache: "reload" }); if (response.ok) await cache.put(path, response); } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("tuner-metronome-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) { fetch(request).then(response => { if (response && response.ok) cache.put(request, response.clone()); }).catch(() => {}); return cached; }
    try { const response = await fetch(request); if (response && response.ok) cache.put(request, response.clone()); return response; }
    catch (error) {
      if (request.mode === "navigate") return (await cache.match("./index.html")) || new Response("Приложение недоступно офлайн. Откройте его один раз при подключении к интернету.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      throw error;
    }
  })());
});
