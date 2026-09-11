"use client";

import { useEffect, useRef, useState } from "react";

const INTERVALO_MS = 5 * 60 * 1000; // chequea cada 5 min

function IconoActualizar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-7 w-7">
      <path
        d="M4 12a8 8 0 0 1 13.66-5.66L20 8.5M20 12a8 8 0 0 1-13.66 5.66L4 15.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 4v4.5h-4.5M4 20v-4.5h4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function VersionBanner() {
  const [hayNueva, setHayNueva] = useState(false);
  const [descartado, setDescartado] = useState(false);
  const buildIdInicial = useRef<string | null>(null);

  useEffect(() => {
    async function chequear() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const buildId: string | undefined = data?.buildId;
        if (!buildId) return;
        if (buildIdInicial.current === null) {
          buildIdInicial.current = buildId;
          return;
        }
        if (buildId !== buildIdInicial.current) setHayNueva(true);
      } catch {
        // Sin red o falla puntual — se reintenta en el próximo intervalo,
        // no hace falta avisar nada.
      }
    }

    chequear();
    const id = setInterval(chequear, INTERVALO_MS);
    return () => clearInterval(id);
  }, []);

  if (!hayNueva || descartado) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center shadow-2xl">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg">
          <IconoActualizar />
        </span>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Hay una versión nueva</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Se actualizó la aplicación. Actualizá la página para tener los últimos cambios.
        </p>
        <div className="mt-5 flex w-full gap-2">
          <button
            type="button"
            onClick={() => setDescartado(true)}
            className="flex-1 rounded-md border border-[var(--border-2)] px-3 py-2 text-sm font-medium text-[var(--muted-2)] hover:bg-[var(--surface-2)]"
          >
            Más tarde
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            Actualizar
          </button>
        </div>
      </div>
    </div>
  );
}
