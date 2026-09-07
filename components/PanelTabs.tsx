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
    (async () => {
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
    })();
  }, []);

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#12161f] p-1">
      <Tab href="/" activo={activa === "registro"} label="Ingresados" contador={totalRegistro} />
      <Tab
        href="/revision"
        activo={activa === "revision"}
        label="En revisión"
        contador={totalRevision}
      />
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
