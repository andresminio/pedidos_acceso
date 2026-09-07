"use client";

import { useEffect, useState } from "react";

// Botón flotante para activar/desactivar los avisos de Web Push en este
// navegador. Cada navegador/dispositivo se suscribe por separado — activar
// acá no avisa a nadie más, cada compañero tiene que hacerlo en su propia
// PC. Ver app/api/push/subscribe y app/api/push/send.

type Estado = "sin_soporte" | "inactivo" | "activando" | "activo" | "denegado";

// Nota TS: construimos con `new Uint8Array(n)` (no `Uint8Array.from(...)`)
// a propósito — así el array queda respaldado por un ArrayBuffer "normal"
// y no un ArrayBufferLike genérico, que es lo que pide el tipo de
// `applicationServerKey` más abajo (si no, TS 5.7+ tira error de build).
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export default function PushSetup() {
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setEstado("sin_soporte");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("denegado");
      return;
    }
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) setEstado("activo");
    })();
  }, []);

  async function activar() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      alert("Avisos todavía no configurados del lado del servidor.");
      return;
    }
    setEstado("activando");
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado("denegado");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setEstado("activo");
    } catch (e) {
      console.error("No se pudo activar avisos:", e);
      setEstado("inactivo");
    }
  }

  async function desactivar() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setEstado("inactivo");
  }

  if (estado === "sin_soporte" || oculto) return null;

  if (estado === "activo") {
    return (
      <button
        type="button"
        onClick={desactivar}
        title="Click para desactivar los avisos en este navegador"
        className="fixed bottom-5 left-5 z-40 flex items-center gap-1.5 rounded-full border border-emerald-800 bg-emerald-950/60 px-3 py-1.5 text-xs font-medium text-emerald-300 shadow-lg hover:bg-emerald-950"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Avisos activados
      </button>
    );
  }

  if (estado === "denegado") {
    return (
      <button
        type="button"
        onClick={() => setOculto(true)}
        title="Los bloqueaste desde el navegador — se pueden reactivar desde su configuración de notificaciones"
        className="fixed bottom-5 left-5 z-40 rounded-full border border-slate-700 bg-[#12161f] px-3 py-1.5 text-xs text-slate-500 shadow-lg"
      >
        Avisos bloqueados ✕
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={activar}
      disabled={estado === "activando"}
      className="fixed bottom-5 left-5 z-40 rounded-full border border-slate-700 bg-[#12161f] px-3 py-1.5 text-xs font-medium text-slate-300 shadow-lg hover:bg-slate-800 disabled:opacity-50"
    >
      {estado === "activando" ? "Activando…" : "🔔 Activar avisos"}
    </button>
  );
}
