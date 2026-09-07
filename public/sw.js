// Service worker mínimo: solo existe para recibir Web Push y mostrar la
// notificación / actualizar el badge del ícono aunque la app esté cerrada.
// No cachea nada (no es un service worker "offline-first" a propósito, así
// no interfiere con VersionBanner.tsx / la detección de deploys nuevos).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "MaryBot", body: "Hay novedades para revisar." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // payload no era JSON — nos quedamos con el default de arriba.
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: data.url || "/revision" },
      });
      // Badge del ícono (taskbar/dock) aunque no haya ninguna pestaña
      // abierta — soportado en Chromium. Si no está disponible, no hace
      // nada.
      if (self.registration.setAppBadge) {
        try {
          await self.registration.setAppBadge(data.badgeCount ?? 1);
        } catch {
          // sin soporte — ignorar.
        }
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })()
  );
});
