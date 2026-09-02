"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RevisionTrigger } from "@/lib/types";

const POLL_MS = 3000;

function textoEstado(trigger: RevisionTrigger | null): string {
  if (!trigger) return "";
  switch (trigger.estado) {
    case "pendiente":
      return "Pedido enviado — esperando a que una PC conectada a la red lo tome…";
    case "procesando":
      return "Procesando correo…";
    case "completado":
      return trigger.mensaje ?? "Listo.";
    case "error":
      return `Hubo un error: ${trigger.mensaje ?? "ver la consola del watcher."}`;
  }
}

export default function BotonRevisarCorreo({
  onCompleted,
}: {
  onCompleted: () => void;
}) {
  const [trigger, setTrigger] = useState<RevisionTrigger | null>(null);
  const [enviando, setEnviando] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const detenerPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const consultar = useCallback(
    async (id: string) => {
      const { data } = await supabase
        .from("revision_triggers")
        .select("*")
        .eq("id", id)
        .single();
      if (!data) return;
      const t = data as RevisionTrigger;
      setTrigger(t);
      if (t.estado === "completado" || t.estado === "error") {
        detenerPolling();
        if (t.estado === "completado") onCompleted();
      }
    },
    [detenerPolling, onCompleted]
  );

  useEffect(() => {
    // Al entrar a la página, si hay un pedido reciente sin terminar,
    // lo seguimos mostrando (por si se recargó la página).
    (async () => {
      const { data } = await supabase
        .from("revision_triggers")
        .select("*")
        .in("estado", ["pendiente", "procesando"])
        .order("solicitado_en", { ascending: false })
        .limit(1);
      const pendiente = data?.[0] as RevisionTrigger | undefined;
      if (pendiente) {
        setTrigger(pendiente);
        intervalRef.current = setInterval(() => consultar(pendiente.id), POLL_MS);
      }
    })();
    return () => detenerPolling();
  }, [consultar, detenerPolling]);

  async function handleClick() {
    setEnviando(true);
    const { data, error } = await supabase
      .from("revision_triggers")
      .insert({ estado: "pendiente" })
      .select("*")
      .single();
    setEnviando(false);
    if (error || !data) return;

    const nuevo = data as RevisionTrigger;
    setTrigger(nuevo);
    detenerPolling();
    intervalRef.current = setInterval(() => consultar(nuevo.id), POLL_MS);
  }

  const activo = trigger?.estado === "pendiente" || trigger?.estado === "procesando";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={enviando || activo}
        className="whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {activo ? "Revisando…" : "Revisar correo ahora"}
      </button>
      {trigger && (
        <p
          className={`text-xs ${
            trigger.estado === "error" ? "text-red-600" : "text-slate-500"
          }`}
        >
          {textoEstado(trigger)}
        </p>
      )}
      <p className="text-right text-[11px] text-slate-400">
        Requiere que alguien tenga <code>mail-bot/watcher.py</code> corriendo
        en una PC conectada a la red interna.
      </p>
    </div>
  );
}
