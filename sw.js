const CACHE_NAME = "oginga-quote-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./sw.js"
];

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

function isStaticAsset(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
      self.registration.navigationPreload ? self.registration.navigationPreload.enable() : Promise.resolve()
    ])
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (isNavigationRequest(event.request)) {
    event.respondWith(
      (async () => {
        try {
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            const cache = await caches.open(CACHE_NAME);
            cache.put("./index.html", preloadResponse.clone());
            return preloadResponse;
          }

          const networkResponse = await fetch(event.request);
          const cache = await caches.open(CACHE_NAME);
          cache.put("./index.html", networkResponse.clone());
          return networkResponse;
        } catch (error) {
          const cachedPage = await caches.match("./index.html");
          return cachedPage || caches.match("./");
        }
      })()
    );
    return;
  }

  if (!isStaticAsset(requestUrl)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        return caches.match("./index.html");
      }
    })()
  );
});
