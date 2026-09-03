"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { TEMAS } from "@/lib/types";
import type { CandidatoCorreo, SolicitudInput } from "@/lib/types";
// El botón "Revisar correo ahora" (BotonRevisarCorreo) quedó descartado:
// se optó por que mail-bot/main.py corra solo, programado cada 2hs con
// el Programador de tareas de Windows, en vez de un watcher escuchando
// todo el tiempo. Ver README, sección 6.

const DESCARTADOS_DIAS = 7;

function anioCuatrimestre(fechaISO: string): { anio: number; cuatrimestre: 1 | 2 | 3 } {
  const d = new Date(fechaISO);
  const mes = d.getMonth() + 1; // 1-12
  const cuatrimestre: 1 | 2 | 3 = mes <= 4 ? 1 : mes <= 8 ? 2 : 3;
  return { anio: d.getFullYear(), cuatrimestre };
}

const MAX_LINEAS_PREVIEW = 4;
const MAX_CHARS_PREVIEW = 240;

// Colapsa 2+ renglones en blanco seguidos a uno solo, para que la firma o
// los espaciados de cada mail no inflen el alto del box sin aportar info.
function textoCompacto(texto: string): string {
  return texto.trim().replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n");
}

function vistaPreview(texto: string): { texto: string; truncado: boolean } {
  const compacto = textoCompacto(texto);
  const lineas = compacto.split("\n");
  let recorte = compacto;
  let truncado = false;

  if (lineas.length > MAX_LINEAS_PREVIEW) {
    recorte = lineas.slice(0, MAX_LINEAS_PREVIEW).join("\n");
    truncado = true;
  }
  if (recorte.length > MAX_CHARS_PREVIEW) {
    recorte = recorte.slice(0, MAX_CHARS_PREVIEW);
    truncado = true;
  }
  return { texto: truncado ? recorte + "…" : recorte, truncado };
}

function fechaCortaHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PanelCandidatos() {
  const [rows, setRows] = useState<CandidatoCorreo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ultimaCorrida, setUltimaCorrida] = useState<string | null>(null);

  const [descartadosSemana, setDescartadosSemana] = useState<number | null>(null);
  const [verDescartados, setVerDescartados] = useState(false);
  const [descartados, setDescartados] = useState<CandidatoCorreo[]>([]);
  const [cargandoDescartados, setCargandoDescartados] = useState(false);

  const desdeIso = useCallback(
    () => new Date(Date.now() - DESCARTADOS_DIAS * 24 * 3_600_000).toISOString(),
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("candidatos_correo")
      .select("*")
      .eq("estado_revision", "pendiente")
      .eq("es_pedido_acceso", true)
      .order("fecha_correo", { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setRows(data as CandidatoCorreo[]);
      setError(null);
    }
    setLoading(false);

    // Estado general: última vez que corrió el bot (independiente de si
    // encontró pedidos o no) — se guarda en mail_sync_state.
    const { data: estado } = await supabase
      .from("mail_sync_state")
      .select("ultima_corrida_en")
      .eq("id", 1)
      .maybeSingle();
    setUltimaCorrida(estado?.ultima_corrida_en ?? null);

    const { count } = await supabase
      .from("candidatos_correo")
      .select("id", { count: "exact", head: true })
      .eq("estado_revision", "descartado")
      .gte("procesado_en", desdeIso());
    setDescartadosSemana(count ?? 0);
  }, [desdeIso]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDescartados = useCallback(async () => {
    setCargandoDescartados(true);
    const { data, error } = await supabase
      .from("candidatos_correo")
      .select("*")
      .eq("estado_revision", "descartado")
      .gte("procesado_en", desdeIso())
      .order("fecha_correo", { ascending: false });
    if (!error) setDescartados((data as CandidatoCorreo[]) ?? []);
    setCargandoDescartados(false);
  }, [desdeIso]);

  async function toggleVerDescartados() {
    const abrir = !verDescartados;
    setVerDescartados(abrir);
    // Siempre se vuelve a pedir al abrir (no cachear): si quedó abierto en
    // una sesión previa y mientras tanto se descartó algo nuevo, la lista
    // vieja quedaría desactualizada aunque el contador de arriba sí se
    // actualice.
    if (abrir) await loadDescartados();
  }

  async function handleDescartar(row: CandidatoCorreo) {
    setBusyId(row.id);
    const { error } = await supabase
      .from("candidatos_correo")
      .update({ estado_revision: "descartado", revisado_en: new Date().toISOString() })
      .eq("id", row.id);
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
    if (verDescartados) await loadDescartados();
  }

  async function handlePasarARevision(row: CandidatoCorreo) {
    setBusyId(row.id);
    const { error } = await supabase
      .from("candidatos_correo")
      .update({
        estado_revision: "pendiente",
        es_pedido_acceso: true,
        revisado_en: null,
      })
      .eq("id", row.id);
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setDescartados((prev) => prev.filter((d) => d.id !== row.id));
    await load();
  }

  async function handleCargar(row: CandidatoCorreo, campos: SolicitudInput) {
    setBusyId(row.id);

    const { data: nuevoPedido, error: errInsert } = await supabase
      .from("pedidos_solicitudes")
      .insert(campos)
      .select("id")
      .single();

    if (errInsert || !nuevoPedido) {
      setBusyId(null);
      setError(errInsert?.message ?? "No se pudo crear el pedido.");
      return;
    }

    const { error: errUpdate } = await supabase
      .from("candidatos_correo")
      .update({
        estado_revision: "aprobado",
        pedido_id: nuevoPedido.id,
        revisado_en: new Date().toISOString(),
      })
      .eq("id", row.id);

    setBusyId(null);
    if (errUpdate) {
      setError(errUpdate.message);
      return;
    }
    await load();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Correos en revisión</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            El bot revisa automáticamente el correo institucional cada 1 hora
            y detecta posibles pedidos de acceso que aún no fueron
            registrados. Revisá los pedidos detectados y decidí qué hacer con
            cada uno.
          </p>
        </div>
        <p className="whitespace-nowrap text-xs text-slate-500">
          {ultimaCorrida ? (
            <>última corrida: {fechaCortaHora(ultimaCorrida)}</>
          ) : (
            "todavía no corrió"
          )}
          {" · "}
          {rows.length} mail{rows.length === 1 ? "" : "s"} nuevo
          {rows.length === 1 ? "" : "s"}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}
      {!loading && rows.length === 0 && (
        <p className="rounded-lg border border-slate-800 bg-[#12161f] px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
          No hay candidatos pendientes de revisión.
        </p>
      )}

      <div className="space-y-4">
        {rows.map((row) => (
          <FilaCandidato
            key={row.id}
            row={row}
            busy={busyId === row.id}
            onDescartar={() => handleDescartar(row)}
            onCargar={(campos) => handleCargar(row, campos)}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4 text-sm">
        <p className="text-slate-500">
          {descartadosSemana ?? "…"} mails descartados en los últimos{" "}
          {DESCARTADOS_DIAS} días.
        </p>
        <button
          type="button"
          onClick={toggleVerDescartados}
          className="whitespace-nowrap font-medium text-blue-400 hover:text-blue-300"
        >
          {verDescartados ? "Ocultar descartados" : "Ver descartados"}
        </button>
      </div>

      {verDescartados && (
        <div className="mt-3 space-y-2">
          {cargandoDescartados && (
            <p className="text-sm text-slate-500">Cargando…</p>
          )}
          {!cargandoDescartados && descartados.length === 0 && (
            <p className="text-sm text-slate-500">
              No hay descartados en los últimos {DESCARTADOS_DIAS} días.
            </p>
          )}
          {descartados.map((d) => (
            <FilaDescartado
              key={d.id}
              row={d}
              busy={busyId === d.id}
              onPasarARevision={() => handlePasarARevision(d)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaCandidato({
  row,
  busy,
  onDescartar,
  onCargar,
}: {
  row: CandidatoCorreo;
  busy: boolean;
  onDescartar: () => void;
  onCargar: (campos: SolicitudInput) => void;
}) {
  const [nombre, setNombre] = useState(row.nombre_solicitante ?? "");
  const [fecha, setFecha] = useState(
    row.fecha_propuesta ?? row.fecha_correo.slice(0, 10)
  );
  const [solicitud, setSolicitud] = useState(row.solicitud_propuesta ?? "");
  const [categoria, setCategoria] = useState(row.categoria_propuesta ?? "");
  const [subcategoria, setSubcategoria] = useState(row.subcategoria_propuesta ?? "");
  const [verCompleto, setVerCompleto] = useState(false);
  const citaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!verCompleto) return;
    function handleClickFuera(e: MouseEvent) {
      if (citaRef.current && !citaRef.current.contains(e.target as Node)) {
        setVerCompleto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, [verCompleto]);

  function submitCargar() {
    const { anio, cuatrimestre } = anioCuatrimestre(fecha);
    onCargar({
      anio,
      cuatrimestre,
      fecha,
      nombre_solicitante: nombre,
      solicitud,
      categoria: categoria || null,
      subcategoria: subcategoria || null,
      nombre_archivo: null,
      estado: "Pendiente",
      subestado: null,
      fecha_respuesta: null,
      observaciones: `Cargado automáticamente desde correo (asunto: "${row.asunto ?? ""}").`,
    });
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-[#12161f] p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          correo · {fechaCortaHora(row.fecha_correo)} · de {row.remitente}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy || !nombre || !solicitud}
            onClick={submitCargar}
            className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Cargar como pedido
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDescartar}
            className="whitespace-nowrap rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Descartar
          </button>
        </div>
      </div>

      <h3 className="mb-1 font-semibold text-white">{row.asunto}</h3>

      {row.confianza_ia && (
        <p className="mb-3 text-xs italic text-slate-500">IA: {row.confianza_ia}</p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Solicitante
          <input
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Categoría
          <select
            className="input"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">—</option>
            {TEMAS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Subcategoría
          <input
            className="input"
            value={subcategoria}
            onChange={(e) => setSubcategoria(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Fecha del mail
          <input
            type="date"
            className="input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
      </div>

      <label className="mb-3 flex flex-col gap-1 text-xs text-slate-500">
        Solicitud
        <textarea
          className="input min-h-16"
          value={solicitud}
          onChange={(e) => setSolicitud(e.target.value)}
        />
      </label>

      {row.cuerpo_resumen &&
        (() => {
          const preview = vistaPreview(row.cuerpo_resumen);
          return (
            <div ref={citaRef} className="flex flex-col gap-1 text-xs text-slate-500">
              Correo recibido
              <blockquote
                onClick={() => {
                  if (window.getSelection()?.toString()) return;
                  if (preview.truncado) setVerCompleto((v) => !v);
                }}
                className={`whitespace-pre-line rounded-md border border-slate-800 bg-[#0e1219] px-3 py-2 text-sm italic text-slate-400 ${
                  preview.truncado ? "cursor-pointer" : ""
                }`}
              >
                {verCompleto ? textoCompacto(row.cuerpo_resumen) : preview.texto}
              </blockquote>
            </div>
          );
        })()}
    </div>
  );
}

function FilaDescartado({
  row,
  busy,
  onPasarARevision,
}: {
  row: CandidatoCorreo;
  busy: boolean;
  onPasarARevision: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expandido) return;
    function handleClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setExpandido(false);
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, [expandido]);

  const tieneCuerpo = !!row.cuerpo_resumen?.trim();

  return (
    <div
      ref={ref}
      className="rounded-md border border-slate-800 bg-[#0e1219] px-3 py-2 text-xs text-slate-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          onClick={() => {
            if (window.getSelection()?.toString()) return;
            if (tieneCuerpo) setExpandido((v) => !v);
          }}
          className={tieneCuerpo ? "cursor-pointer" : ""}
        >
          <span className="text-slate-400">{fechaCortaHora(row.fecha_correo)}</span>{" "}
          · de {row.remitente} — <span className="text-slate-300">{row.asunto}</span>
          {row.confianza_ia && (
            <div className="mt-1 italic text-slate-600">IA: {row.confianza_ia}</div>
          )}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onPasarARevision}
          className="whitespace-nowrap rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Pasar a revisión
        </button>
      </div>
      {expandido && tieneCuerpo && (
        <>
          <p className="mt-2 text-xs text-slate-500">Correo recibido</p>
          <blockquote className="mt-1 whitespace-pre-line rounded-md border border-slate-800 bg-black/20 px-3 py-2 text-sm italic text-slate-400">
            {textoCompacto(row.cuerpo_resumen!)}
          </blockquote>
        </>
      )}
    </div>
  );
}
