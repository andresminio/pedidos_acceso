"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GOOGLE_SHEET_URL } from "@/lib/constants";

function tiempoRelativo(fecha: Date): string {
  const segundos = Math.floor((Date.now() - fecha.getTime()) / 1000);
  if (segundos < 60) return "hace instantes";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} d`;
}

export default function SyncStatus() {
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null);
  const [cargado, setCargado] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pedidos_solicitudes")
        .select("synced_at")
        .not("synced_at", "is", null)
        .order("synced_at", { ascending: false })
        .limit(1);
      const valor = data?.[0]?.synced_at;
      setUltimaSync(valor ? new Date(valor) : null);
      setCargado(true);
    })();
  }, []);

  // Refresca el texto "hace X min" cada 30s sin volver a pegarle a Supabase.
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="flex items-center gap-1.5 text-xs text-slate-400">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          ultimaSync ? "bg-emerald-500" : "bg-slate-600"
        }`}
      />
      Sincronizado con la{" "}
      <a
        href={GOOGLE_SHEET_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-300 underline decoration-slate-600 underline-offset-2 hover:text-white"
      >
        hoja de cálculo de control
      </a>
      {cargado && ultimaSync && <> · {tiempoRelativo(ultimaSync)}</>}
    </p>
  );
}
