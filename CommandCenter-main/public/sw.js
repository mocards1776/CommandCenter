/* Sports PWA push worker. Fetch is untouched — newspaper and the app shell stay as they are. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
