"use client";

import { useEffect, useRef, useState } from "react";

const INTERVALO_MS = 5 * 60 * 1000; // chequea cada 5 min

export default function VersionBanner() {
  const [hayNueva, setHayNueva] = useState(false);
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

  if (!hayNueva) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-3 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
      Hay una versión nueva
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
      >
        Actualizar
      </button>
    </div>
  );
}
