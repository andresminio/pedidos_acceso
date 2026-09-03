"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [alDia, setAlDia] = useState(false);
  const [cargado, setCargado] = useState(false);

  const chequear = useCallback(async () => {
    // ultima_sincronizacion_en vive en una tabla aparte (sheet_sync_state),
    // no en una fila puntual de pedidos_solicitudes — así también se
    // actualiza en un DELETE, donde no hay fila que marcar.
    const [syncRes, cambioRes] = await Promise.all([
      supabase
        .from("sheet_sync_state")
        .select("ultima_sincronizacion_en")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("pedidos_solicitudes")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);
    const valorSync = syncRes.data?.ultima_sincronizacion_en;
    const ultimoCambio = cambioRes.data?.[0]?.updated_at;
    const sync = valorSync ? new Date(valorSync) : null;
    setUltimaSync(sync);
    // "Al día" = la hoja refleja el último cambio: o no hay ningún pedido
    // todavía, o el último sync es igual o posterior al último cambio en
    // pedidos_solicitudes. Si hay un cambio más nuevo que el último sync,
    // la hoja está desactualizada (todavía no le llegó esa novedad).
    setAlDia(!ultimoCambio || (sync !== null && sync >= new Date(ultimoCambio)));
    setCargado(true);
  }, []);

  useEffect(() => {
    chequear();
  }, [chequear]);

  // Vuelve a chequear cada 30s — antes solo se pedía una vez al montar, así
  // que si sincronizabas o borrabas algo con la página abierta, el punto
  // se quedaba con el estado viejo hasta recargar.
  useEffect(() => {
    const id = setInterval(chequear, 30_000);
    return () => clearInterval(id);
  }, [chequear]);

  const verde = cargado && alDia;

  return (
    <p className="flex items-center gap-1.5 text-xs text-slate-400">
      <span
        className={`h-1.5 w-1.5 rounded-full ${verde ? "bg-emerald-500" : "bg-slate-600"}`}
      />
      {verde ? "Sincronizado con" : "Pendiente de sincronizar con"}{" "}
      <a
        href={GOOGLE_SHEET_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-300 underline decoration-slate-600 underline-offset-2 hover:text-white"
      >
        UEEDA pedidos de acceso
      </a>
      {cargado && ultimaSync && <> · {tiempoRelativo(ultimaSync)}</>}
    </p>
  );
}
