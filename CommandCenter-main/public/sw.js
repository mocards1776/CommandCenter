/* Sports PWA push worker. Fetch is untouched — newspaper and the app shell stay as they are. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Sports", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Sports";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-mlb-192.png",
    badge: data.badge || "/icon-mlb-192.png",
    tag: data.tag || "sports",
    renotify: false,
    data: { url: data.url || "/sports?solo=1" },
  };
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
