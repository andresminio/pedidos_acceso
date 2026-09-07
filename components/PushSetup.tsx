"use client";

import { useEffect, useState } from "react";

// Botón flotante para activar/desactivar los avisos de Web Push en este
// navegador. Cada navegador/dispositivo se suscribe por separado — activar
// acá no avisa a nadie más, cada compañero tiene que hacerlo en su propia
// PC. Ver app/api/push/subscribe y app/api/push/send.

type Estado = "sin_soporte" | "inactivo" | "activando" | "activo" | "denegado";

function IconoCampana() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-7 w-7">
      <path
        d="M6 10a6 6 0 0 1 12 0c0 3.2 1 4.8 1.8 5.6.4.4.1 1.1-.5 1.1H4.7c-.6 0-.9-.7-.5-1.1C5 14.8 6 13.2 6 10Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 19.5a2.2 2.2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

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
        className="group fixed bottom-20 right-5 z-40 flex h-12 w-12 items-center overflow-hidden rounded-full bg-emerald-700 px-2.5 text-white shadow-lg shadow-emerald-950/40 transition-all duration-300 ease-out hover:w-56 hover:bg-emerald-600 hover:px-4"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
          <IconoCampana />
        </span>
        <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-xs group-hover:opacity-100">
          Avisos activados — desactivar
        </span>
      </button>
    );
  }

  if (estado === "denegado") {
    return (
      <button
        type="button"
        onClick={() => setOculto(true)}
        className="group fixed bottom-20 right-5 z-40 flex h-12 w-12 items-center overflow-hidden rounded-full bg-slate-700 px-2.5 text-white shadow-lg transition-all duration-300 ease-out hover:w-56 hover:bg-slate-600 hover:px-4"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
          <IconoCampana />
        </span>
        <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-xs group-hover:opacity-100">
          Avisos bloqueados — ocultar
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={activar}
      disabled={estado === "activando"}
      className="group fixed bottom-20 right-5 z-40 flex h-12 w-12 items-center overflow-hidden rounded-full bg-blue-600 px-2.5 text-white shadow-lg shadow-blue-950/40 transition-all duration-300 ease-out hover:w-56 hover:bg-blue-500 hover:px-4 disabled:opacity-50"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
        <IconoCampana />
      </span>
      <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-xs group-hover:opacity-100">
        {estado === "activando" ? "Activando…" : "Activar avisos"}
      </span>
    </button>
  );
}
