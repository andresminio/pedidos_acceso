"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function PanelTabs({ activa }: { activa: "registro" | "revision" }) {
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
          .eq("estado_revision", "pendiente")
          .eq("es_pedido_acceso", true),
      ]);
      setTotalRegistro(registro.count ?? 0);
      setTotalRevision(revision.count ?? 0);
    })();
  }, []);

  return (
    <div className="flex items-center gap-4">
      <Tab href="/" activo={activa === "registro"} label="Registro" contador={totalRegistro} />
      <Tab
        href="/revision"
        activo={activa === "revision"}
        label="Revisión de correo"
        contador={totalRevision}
      />
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
      className={`flex items-center gap-1.5 border-b-2 pb-1 text-sm font-medium transition-colors ${
        activo
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-400 hover:text-slate-600"
      }`}
    >
      {label}
      {contador !== null && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-xs ${
            activo ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          {contador}
        </span>
      )}
    </Link>
  );
}
