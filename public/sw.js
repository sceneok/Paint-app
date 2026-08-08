/* 현장수첩 오프라인 캐시 — 네트워크 우선, 실패 시 캐시 */
const CACHE = "pj-cache-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) c.put(request, fresh.clone());
        return fresh;
      } catch {
        const hit = await c.match(request, { ignoreSearch: true });
        if (hit) return hit;
        return c.match("./index.html");
      }
    })
  );
});
