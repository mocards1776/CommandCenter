/* Sports PWA push worker + Times app-shell / image cache.
   Fetch for Sports APIs is still network-only. Times JS/CSS/fonts and sharp
   edition photos are cached. iOS will not run this while the app is closed. */
const SHELL = "tt-shell-v1";
const IMAGES = "tt-images-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await self.skipWaiting();
      try {
        const res = await fetch("/times-precache.json", { cache: "no-cache" });
        if (!res.ok) return;
        const body = await res.json();
        const files = Array.isArray(body.files) ? body.files.filter((u) => typeof u === "string") : [];
        const cache = await caches.open(SHELL);
        await Promise.all(
          files.map((url) => cache.add(url).catch(() => undefined)),
        );
      } catch {
        /* first visit still works from the network */
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, IMAGES]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("tt-") && !keep.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "tt-precache" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await Promise.all(
        data.urls
          .filter((url) => typeof url === "string" && isShellUrl(new URL(url, self.location.origin)))
          .map((url) => cache.add(url).catch(() => undefined)),
      );
    })(),
  );
});

function vibration(data) {
  if (data.silent === true || !Array.isArray(data.vibrate)) return undefined;
  const pattern = data.vibrate.filter((n) => typeof n === "number" && n >= 0 && n <= 2000).slice(0, 8);
  return pattern.length ? pattern : undefined;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Sports", body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Sports";
  const image = typeof data.image === "string" && data.image ? data.image : undefined;
  const options = {
    body: typeof data.body === "string" ? data.body.slice(0, 700) : "",
    icon: data.icon || "/icon-mlb-192.png",
    badge: data.badge || "/icon-mlb-192.png",
    tag: data.tag || "sports",
    renotify: data.renotify === true,
    silent: data.silent === true,
    timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now(),
    data: {
      url: data.url || "/sports?solo=1",
      sport: data.sport || "",
      gameId: data.gameId || "",
      kind: data.kind || "",
    },
  };
  if (image) options.image = image;
  const vibrate = vibration(data);
  if (vibrate) options.vibrate = vibrate;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/sports?solo=1", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (!client.url.startsWith(self.location.origin)) continue;
        if ("navigate" in client) {
          try {
            await client.navigate(target);
          } catch {
            /* older iOS builds focus without navigating */
          }
        }
        await client.focus();
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

function isShellUrl(url) {
  if (url.origin === self.location.origin) {
    if (url.pathname === "/times-precache.json" || url.pathname === "/times.html") return true;
    if (url.pathname.startsWith("/assets/") && /\.(?:js|css|woff2?)$/i.test(url.pathname)) return true;
    if (url.pathname === "/newspaper" || url.pathname.startsWith("/newspaper/")) return false;
    return false;
  }
  return /fonts\.(?:googleapis|gstatic)\.com$/i.test(url.hostname);
}

function isTimesNavigation(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname === "/newspaper" || url.pathname.startsWith("/newspaper/") || url.pathname === "/times.html")
  );
}

function isEspnThumb(url) {
  if (!/(?:^|\.)a\.espncdn\.com$/i.test(url.hostname) || url.pathname !== "/combiner/i") return false;
  const img = url.searchParams.get("img") || "";
  return (
    /^\/i\/headshots\/[^/]+\/players\/full\/\d+\.png$/i.test(img) || /^\/i\/teamlogos\/.+\.png$/i.test(img)
  );
}

function isSharpImage(url) {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (isEspnThumb(url)) return true;
  if (/[?&](?:resize|w|width)=(\d{1,3})\b/i.test(url.href)) {
    const n = Number(RegExp.$1);
    if (Number.isFinite(n) && n < 800) return false;
  }
  if (/\/resize\/(\d{1,3})(?:x\d+)?(?:\/|$)/i.test(url.pathname)) return false;
  return /\.(?:jpe?g|png|webp|gif|avif)(?:$|\?)/i.test(url.href) ||
    /bloximages|espncdn|mlstatic|cloudinary|imagn|sportshub/i.test(url.href);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  // Printed pages are served from this origin (/times-flat/...), which Vercel
  // caches in front of Storage. Older manifests still point at Supabase.
  if (url.origin === self.location.origin && url.pathname.startsWith("/times-flat/") && /\.webp$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req, IMAGES));
    return;
  }
  if (url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/object/public/times-flat/")) {
    if (req.destination === "image" || /\.webp(?:$|\?)/i.test(url.pathname)) {
      event.respondWith(cacheFirst(req, IMAGES));
    }
    return;
  }
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase.co")) return;

  if (req.mode === "navigate" && isTimesNavigation(url)) {
    event.respondWith(networkFirst(req, SHELL));
    return;
  }
  if (isShellUrl(url)) {
    event.respondWith(staleWhileRevalidate(req, SHELL));
    return;
  }
  if (req.destination === "image" && isSharpImage(url)) {
    event.respondWith(cacheFirst(req, IMAGES));
  }
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error("offline");
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    })
    .catch(() => hit);
  return hit || fetchPromise;
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const fresh = await fetch(req);
  if (fresh && (fresh.ok || fresh.type === "opaque")) cache.put(req, fresh.clone());
  return fresh;
}
