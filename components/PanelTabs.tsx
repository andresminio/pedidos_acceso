"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function PanelTabs({
  activa,
}: {
  activa: "registro" | "revision" | "resumen";
}) {
  const [totalRegistro, setTotalRegistro] = useState<number | null>(null);
  const [totalRevision, setTotalRevision] = useState<number | null>(null);

  useEffect(() => {
    async function cargarContadores() {
      const [registro, revision] = await Promise.all([
        supabase
          .from("pedidos_solicitudes")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("candidatos_correo")
          .select("id", { count: "exact", head: true })
          .eq("estado_revision", "pendiente"),
      ]);
      setTotalRegistro(registro.count ?? 0);
      setTotalRevision(revision.count ?? 0);
    }

    cargarContadores();
    // Refresca cada 60s para que el badge del ícono (ver más abajo) no
    // quede desactualizado mientras la app queda abierta en segundo plano.
    const intervalo = setInterval(cargarContadores, 60_000);
    return () => clearInterval(intervalo);
  }, []);

  // Badge API: muestra la cantidad de pendientes en "En revisión" sobre el
  // ícono de la app (taskbar/dock), cuando está instalada como PWA (ver
  // manifest.json). No tiene efecto visible en un simple acceso directo de
  // navegador — hace falta "Instalar página como aplicación".
  useEffect(() => {
    if (totalRevision === null) return;
    if (!("setAppBadge" in navigator)) return;
    const nav = navigator as Navigator & {
      setAppBadge: (n?: number) => Promise<void>;
      clearAppBadge: () => Promise<void>;
    };
    if (totalRevision > 0) {
      nav.setAppBadge(totalRevision).catch(() => {});
    } else {
      nav.clearAppBadge().catch(() => {});
    }
  }, [totalRevision]);

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#12161f] p-1">
      <Tab
        href="/revision"
        activo={activa === "revision"}
        label="En revisión"
        contador={totalRevision}
      />
      <Tab href="/" activo={activa === "registro"} label="Ingresados" contador={totalRegistro} />
      <Tab href="/resumen" activo={activa === "resumen"} label="Resumen" contador={null} />
    </div>
  );
}

function Tab({
  href,
  activo,
  label,
  contador,
}: {
  href: string;
  activo: boolean;
  label: string;
  contador: number | null;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        activo
          ? "bg-slate-800 text-white shadow-sm"
          : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
      {contador !== null && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
            activo ? "bg-blue-500/20 text-blue-300" : "bg-slate-700 text-slate-400"
          }`}
        >
          {contador}
        </span>
      )}
    </Link>
  );
}
