/* BQ SW v2026-08-26d — push + installable PWA */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "BQ", body: "إشعار جديد", url: "/", tag: "bq", kind: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    try {
      const text = event.data && event.data.text && event.data.text();
      if (text) data.body = text;
    } catch (_) {}
  }
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      let focused = false;
      for (const c of clients) {
        try {
          c.postMessage({ type: "bq-push", ...data });
          if (c.focused) focused = true;
        } catch (_) {}
      }
      if (data.kind === "call" || !focused || clients.length === 0) {
        await self.registration.showNotification(data.title || "BQ", {
          body: data.body || "",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-96.png",
          vibrate: [220, 80, 220, 80, 420],
          requireInteraction: data.kind === "call",
          renotify: true,
          silent: false,
          tag: data.tag || "bq",
          data: { url: data.url || "/" },
          dir: "rtl",
          lang: "ar",
        });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          try {
            client.postMessage({ type: "bq-open", url });
          } catch (_) {}
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
