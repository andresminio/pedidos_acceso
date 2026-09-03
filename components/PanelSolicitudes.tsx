"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import {
  agregarCategoria,
  agruparCategorias,
  cargarCategorias,
  cargarSubcategorias,
} from "@/lib/categorias";
import { anioCuatrimestreDeFecha, fechaCorta } from "@/lib/fechas";
import { textoCompacto } from "@/lib/texto";
import { ESTADOS, SUBESTADOS_CERRADO } from "@/lib/types";
import type { Solicitud, SolicitudInput } from "@/lib/types";
import SolicitudForm from "@/components/SolicitudForm";
import SyncStatus from "@/components/SyncStatus";
import IconoIA from "@/components/IconoIA";

const AGREGAR_CATEGORIA = "__agregar_categoria__";

interface Columna {
  key: string;
  label: string;
}

const COLUMNAS: Columna[] = [
  { key: "anio", label: "Año" },
  { key: "cuatrimestre", label: "Cuat." },
  { key: "fecha", label: "Fecha" },
  { key: "solicitante", label: "Solicitante" },
  { key: "solicitud", label: "Solicitud" },
  { key: "categoria", label: "Categoría" },
  { key: "subcategoria", label: "Subcategoría" },
  { key: "estado", label: "Estado" },
  { key: "subestado", label: "Sub-estado" },
  { key: "fecha_respuesta", label: "F. respuesta" },
  { key: "observaciones", label: "Observaciones" },
];

// Columnas visibles por default (antes de que el usuario las personalice
// con el botón "Columnas", guardado en localStorage). Subcategoría,
// Sub-estado y Observaciones arrancan ocultas.
const COLUMNAS_DEFAULT = [
  "anio",
  "cuatrimestre",
  "fecha",
  "solicitante",
  "solicitud",
  "categoria",
  "estado",
  "fecha_respuesta",
];

const COLUMNAS_STORAGE_KEY = "pedidos_columnas_visibles";

// Comparación case-insensitive porque hay datos viejos cargados con
// "CERRADO"/"PENDIENTE" en mayúscula, además de "Cerrado"/"Pendiente".
function PillEstado({ estado }: { estado: string }) {
  const esCerrado = estado.toLowerCase() === "cerrado";
  const esPendiente = estado.toLowerCase() === "pendiente";
  const clase = esCerrado
    ? "bg-emerald-500/15 text-emerald-400"
    : esPendiente
      ? "bg-amber-500/15 text-amber-400"
      : "bg-slate-700/40 text-slate-300";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${clase}`}>
      {estado}
    </span>
  );
}

export default function PanelSolicitudes() {
  const [rows, setRows] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filtroAnio, setFiltroAnio] = useState<string>("");
  const [filtroCuatrimestre, setFiltroCuatrimestre] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [busqueda, setBusqueda] = useState<string>("");

  // Solo una fila editable a la vez: id de la fila abierta, o null si
  // ninguna. Vive acá (no en cada FilaSolicitud) para poder cerrar
  // cualquier otra fila abierta cuando se abre una nueva.
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [colsVisibles, setColsVisibles] = useState<Set<string>>(
    () => new Set(COLUMNAS_DEFAULT)
  );
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(COLUMNAS_STORAGE_KEY);
      if (guardado) setColsVisibles(new Set(JSON.parse(guardado)));
    } catch {
      // localStorage no disponible o corrupto — seguimos con todas visibles.
    }
  }, []);
  function toggleCol(key: string) {
    setColsVisibles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(
          COLUMNAS_STORAGE_KEY,
          JSON.stringify(Array.from(next))
        );
      } catch {
        // no pasa nada si no se puede persistir
      }
      return next;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pedidos_solicitudes")
      .select("*")
      .order("fecha", { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setRows(data as Solicitud[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(input: SolicitudInput) {
    setSaving(true);
    const { error } = await supabase.from("pedidos_solicitudes").insert({
      ...input,
      categoria: input.categoria || null,
      subcategoria: input.subcategoria || null,
      nombre_archivo: input.nombre_archivo || null,
      subestado: input.subestado || null,
      fecha_respuesta: input.fecha_respuesta || null,
      observaciones: input.observaciones || null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  }

  async function handleUpdate(id: string, patch: Partial<Solicitud>) {
    const { error } = await supabase
      .from("pedidos_solicitudes")
      .update(patch)
      .eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  }

  async function handleDelete(id: string) {
    // Si este pedido vino de un correo importado, antes de borrarlo hay que
    // desvincular ese candidato: si no, el FK deja pedido_id en null pero
    // estado_revision sigue "aprobado" y el correo queda en un limbo (no
    // aparece en revisión ni el bot lo vuelve a traer, porque ya existe un
    // candidato con ese UID). Lo pasamos a "descartado".
    const { error: errCorreo } = await supabase
      .from("candidatos_correo")
      .update({ estado_revision: "descartado", revisado_en: new Date().toISOString() })
      .eq("pedido_id", id);
    if (errCorreo) {
      console.error("No se pudo desvincular el correo del pedido:", errCorreo.message);
    }

    const { error } = await supabase
      .from("pedidos_solicitudes")
      .delete()
      .eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  }

  const filtered = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtroAnio && String(r.anio) !== filtroAnio) return false;
      if (filtroCuatrimestre && String(r.cuatrimestre) !== filtroCuatrimestre)
        return false;
      if (filtroEstado && r.estado !== filtroEstado) return false;
      if (q) {
        const campos = [
          r.nombre_solicitante,
          r.solicitud,
          r.categoria,
          r.subcategoria,
          r.observaciones,
          r.nombre_archivo,
        ];
        const matchea = campos.some((c) => (c ?? "").toLowerCase().includes(q));
        if (!matchea) return false;
      }
      return true;
    });
  }, [rows, filtroAnio, filtroCuatrimestre, filtroEstado, busqueda]);

  const anios = useMemo(
    () => Array.from(new Set(rows.map((r) => r.anio))).sort((a, b) => b - a),
    [rows]
  );


  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SyncStatus />
        <SolicitudForm onSubmit={handleCreate} submitting={saving} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por solicitantes o tema"
            className="input w-full pl-8"
          />
        </div>
        <select
          value={filtroAnio}
          onChange={(e) => setFiltroAnio(e.target.value)}
          className="input"
        >
          <option value="">Todos los años</option>
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={filtroCuatrimestre}
          onChange={(e) => setFiltroCuatrimestre(e.target.value)}
          className="input"
        >
          <option value="">Todos los cuatrimestres</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="input"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <BotonColumnas colsVisibles={colsVisibles} onToggle={toggleCol} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#12161f] shadow-sm">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead>
            <tr className="bg-blue-500/10">
              {COLUMNAS.filter((c) => colsVisibles.has(c.key)).map((c) => (
                <th
                  key={c.key}
                  className="whitespace-nowrap px-3 py-2 text-left font-bold text-slate-300"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading && (
              <tr>
                <td
                  colSpan={colsVisibles.size}
                  className="px-3 py-6 text-center text-slate-400"
                >
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={colsVisibles.size}
                  className="px-3 py-6 text-center text-slate-400"
                >
                  No hay pedidos registrados con estos filtros.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <FilaSolicitud
                key={row.id}
                row={row}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                colsVisibles={colsVisibles}
                editando={row.id === editandoId}
                onAbrir={() => setEditandoId(row.id)}
                onCerrarEdicion={() => setEditandoId(null)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaSolicitud({
  row,
  onUpdate,
  onDelete,
  colsVisibles,
  editando,
  onAbrir,
  onCerrarEdicion,
}: {
  row: Solicitud;
  onUpdate: (id: string, patch: Partial<Solicitud>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  colsVisibles: Set<string>;
  editando: boolean;
  onAbrir: () => void;
  onCerrarEdicion: () => void;
}) {
  const colSpanTotal = colsVisibles.size;

  const celdas: Record<string, ReactNode> = {
    anio: row.anio,
    cuatrimestre: row.cuatrimestre,
    fecha: <span className="whitespace-nowrap">{fechaCorta(row.fecha)}</span>,
    solicitante: (
      <span className="font-medium text-white">{row.nombre_solicitante}</span>
    ),
    solicitud: (
      <span className="block max-w-xs truncate" title={row.solicitud}>
        {row.solicitud}
      </span>
    ),
    categoria: row.categoria,
    subcategoria: row.subcategoria,
    estado: <PillEstado estado={row.estado} />,
    subestado: row.subestado ?? "—",
    fecha_respuesta: (
      <span className="whitespace-nowrap">{fechaCorta(row.fecha_respuesta)}</span>
    ),
    observaciones: (
      <span className="block max-w-xs truncate" title={row.observaciones ?? ""}>
        {row.observaciones}
      </span>
    ),
  };

  return (
    <>
      {!editando && (
        <tr
          onDoubleClick={onAbrir}
          title="Doble click para editar"
          className="cursor-pointer align-top text-slate-300 hover:bg-white/[0.02]"
        >
          {COLUMNAS.filter((c) => colsVisibles.has(c.key)).map((c) => (
            <td key={c.key} className="px-3 py-2">
              {celdas[c.key]}
            </td>
          ))}
        </tr>
      )}
      {editando && (
        <FilaSolicitudEdicion
          row={row}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onCerrar={onCerrarEdicion}
          colSpan={colSpanTotal}
        />
      )}
    </>
  );
}

function FilaSolicitudEdicion({
  row,
  onUpdate,
  onDelete,
  onCerrar,
  colSpan,
}: {
  row: Solicitud;
  onUpdate: (id: string, patch: Partial<Solicitud>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCerrar: () => void;
  colSpan: number;
}) {
  const [nombreSolicitante, setNombreSolicitante] = useState(row.nombre_solicitante);
  const [categoria, setCategoria] = useState(row.categoria ?? "");
  const [nuevaCategoria, setNuevaCategoria] = useState(false);
  const [subcategoria, setSubcategoria] = useState(row.subcategoria ?? "");
  const [fecha, setFecha] = useState(row.fecha);
  const [solicitud, setSolicitud] = useState(row.solicitud);
  const [estado, setEstado] = useState(row.estado);
  const [subestado, setSubestado] = useState(row.subestado ?? "");
  const [fechaRespuesta, setFechaRespuesta] = useState(row.fecha_respuesta ?? "");
  const [observaciones, setObservaciones] = useState(row.observaciones ?? "");
  const [respuestaIA, setRespuestaIA] = useState(row.respuesta_ia_borrador ?? "");
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const filaRef = useRef<HTMLTableRowElement>(null);

  const [categorias, setCategorias] = useState<string[]>([]);
  const [subcategorias, setSubcategorias] = useState<string[]>([]);

  // "Generar modelo de respuesta con IA" solo tiene sentido si este pedido
  // viene de un correo importado (ahí sí tenemos el mail original como
  // contexto). Se busca por candidatos_correo.pedido_id = este pedido.
  const [mailOrigen, setMailOrigen] = useState<{
    cuerpo_resumen: string | null;
    asunto: string | null;
    remitente: string;
  } | null>(null);
  const [generandoRespuesta, setGenerandoRespuesta] = useState(false);
  const [errorRespuestaIA, setErrorRespuestaIA] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("candidatos_correo")
      .select("cuerpo_resumen, asunto, remitente")
      .eq("pedido_id", row.id)
      .maybeSingle()
      .then(({ data }) => setMailOrigen(data));
  }, [row.id]);

  // Si está Cerrado, la F. respuesta es obligatoria y tiene que ser
  // posterior a la fecha de ingreso (no tiene sentido responder antes de
  // recibir el pedido).
  const errorFechaRespuesta =
    estado === "Cerrado"
      ? !fechaRespuesta
        ? "Un pedido Cerrado necesita F. respuesta."
        : fechaRespuesta <= fecha
          ? "La F. respuesta tiene que ser posterior a la fecha de ingreso."
          : null
      : null;

  useEffect(() => {
    cargarCategorias().then(setCategorias);
  }, []);
  useEffect(() => {
    cargarSubcategorias(categoria).then(setSubcategorias);
  }, [categoria]);

  // Click afuera de la fila de edición (incluida la fila original de
  // arriba) la cierra sin guardar, igual que "Cancelar".
  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (filaRef.current && !filaRef.current.contains(e.target as Node)) {
        onCerrar();
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, [onCerrar]);

  function handleCategoriaChange(value: string) {
    if (value === AGREGAR_CATEGORIA) {
      setNuevaCategoria(true);
      setCategoria("");
      return;
    }
    setNuevaCategoria(false);
    setCategoria(value);
  }

  async function confirmarNuevaCategoria(valor: string) {
    const limpio = valor.trim();
    if (!limpio) {
      setNuevaCategoria(false);
      return;
    }
    if (!categorias.includes(limpio)) {
      setCategorias((c) => [...c, limpio].sort((a, b) => a.localeCompare(b, "es")));
    }
    setCategoria(limpio);
    setNuevaCategoria(false);
    const { error } = await agregarCategoria(limpio);
    if (error) console.error("No se pudo guardar la categoría nueva:", error);
  }

  async function handleGuardar() {
    if (errorFechaRespuesta) return;
    setGuardando(true);
    const { anio, cuatrimestre } = anioCuatrimestreDeFecha(fecha);
    await onUpdate(row.id, {
      anio,
      cuatrimestre,
      fecha,
      nombre_solicitante: nombreSolicitante,
      solicitud,
      categoria: categoria || null,
      subcategoria: subcategoria || null,
      estado,
      subestado: estado === "Cerrado" ? subestado || null : null,
      fecha_respuesta: fechaRespuesta || null,
      observaciones: observaciones || null,
      respuesta_ia_borrador: respuestaIA || null,
    });
    setGuardando(false);
    onCerrar();
  }

  async function handleGenerarRespuesta() {
    if (!mailOrigen) return;
    setErrorRespuestaIA(null);
    setGenerandoRespuesta(true);
    try {
      const res = await fetch("/api/generar-respuesta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitud,
          nombre_solicitante: nombreSolicitante,
          categoria,
          estado,
          cuerpo_mail: mailOrigen.cuerpo_resumen,
          asunto: mailOrigen.asunto,
          remitente: mailOrigen.remitente,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.borrador) {
        setErrorRespuestaIA(data.error ?? "No se pudo generar la respuesta.");
        return;
      }
      setRespuestaIA(data.borrador);
    } catch (e) {
      setErrorRespuestaIA(e instanceof Error ? e.message : "Error de red.");
    } finally {
      setGenerandoRespuesta(false);
    }
  }

  async function handleEliminar() {
    const confirmado = window.confirm(
      `¿Eliminar el pedido de "${row.nombre_solicitante}" (${row.solicitud})? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;
    setEliminando(true);
    await onDelete(row.id);
    setEliminando(false);
  }

  return (
    <tr ref={filaRef} className="bg-[#0e1219]">
      <td colSpan={colSpan} className="px-3 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Solicitante
            <input
              className="input"
              value={nombreSolicitante}
              onChange={(e) => setNombreSolicitante(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Categoría
            {nuevaCategoria ? (
              <input
                autoFocus
                placeholder="Nombre de la categoría"
                className="input"
                onBlur={(e) => confirmarNuevaCategoria(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmarNuevaCategoria(e.currentTarget.value);
                  }
                }}
              />
            ) : (
              <select
                className="input"
                value={categoria}
                onChange={(e) => handleCategoriaChange(e.target.value)}
              >
                <option value="">—</option>
                {(() => {
                  const { principales, otras } = agruparCategorias(categorias);
                  return (
                    <>
                      <optgroup label="Principales">
                        {principales.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Otros temas">
                        {otras.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  );
                })()}
                <option value={AGREGAR_CATEGORIA}>+ Agregar categoría</option>
              </select>
            )}
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Subcategoría
            <input
              list={`subcategoria-sugerencias-edicion-${row.id}`}
              className="input"
              value={subcategoria}
              onChange={(e) => setSubcategoria(e.target.value)}
            />
            <datalist id={`subcategoria-sugerencias-edicion-${row.id}`}>
              {subcategorias.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Fecha
            <input
              type="date"
              className="input"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
        </div>

        <label className="mt-3 flex flex-col gap-1 text-xs text-slate-400">
          Solicitud
          <textarea
            className="input min-h-16"
            value={solicitud}
            onChange={(e) => setSolicitud(e.target.value)}
          />
        </label>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Estado
            <select
              className="input"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Sub-estado
            <select
              className="input disabled:cursor-not-allowed disabled:opacity-40"
              value={subestado}
              disabled={estado !== "Cerrado"}
              onChange={(e) => setSubestado(e.target.value)}
            >
              <option value="">—</option>
              {SUBESTADOS_CERRADO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            F. respuesta
            <input
              type="date"
              className={`input ${errorFechaRespuesta ? "border-red-600" : ""}`}
              value={fechaRespuesta}
              onChange={(e) => setFechaRespuesta(e.target.value)}
            />
            {errorFechaRespuesta && (
              <span className="text-xs text-red-400">{errorFechaRespuesta}</span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Observaciones
            <input
              className="input"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </label>
        </div>

        {mailOrigen && (
          <div className="mt-3 flex flex-col gap-3">
            {mailOrigen.cuerpo_resumen && (
              <div className="flex flex-col gap-1 text-xs text-slate-400">
                Correo recibido
                <blockquote className="max-h-48 overflow-y-auto whitespace-pre-line rounded-md border border-slate-800 bg-[#0e1219] px-3 py-2 text-sm italic text-slate-400">
                  {textoCompacto(mailOrigen.cuerpo_resumen)}
                </blockquote>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Modelo de respuesta</span>
                <button
                  type="button"
                  disabled={generandoRespuesta}
                  onClick={handleGenerarRespuesta}
                  className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  <IconoIA />
                  {generandoRespuesta
                    ? "Generando…"
                    : respuestaIA
                      ? "Volver a generar con IA"
                      : "Generar modelo de respuesta con IA"}
                </button>
                {errorRespuestaIA && (
                  <span className="text-xs text-red-400">{errorRespuestaIA}</span>
                )}
              </div>
              {respuestaIA && (
                <textarea
                  className="input min-h-48"
                  value={respuestaIA}
                  onChange={(e) => setRespuestaIA(e.target.value)}
                />
              )}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={guardando || eliminando}
              onClick={onCerrar}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={
                guardando ||
                eliminando ||
                !nombreSolicitante ||
                !solicitud ||
                !!errorFechaRespuesta
              }
              onClick={handleGuardar}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
          <button
            type="button"
            disabled={guardando || eliminando}
            onClick={handleEliminar}
            className="rounded-md border border-red-900/50 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/50 disabled:opacity-50"
          >
            {eliminando ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function BotonColumnas({
  colsVisibles,
  onToggle,
}: {
  colsVisibles: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-[#12161f] px-3 py-1.5 text-sm text-slate-300 shadow-sm hover:bg-slate-800"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          className="h-4 w-4"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16M15 4v16" />
        </svg>
        Columnas
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-700 bg-[#12161f] p-2 shadow-lg">
            {COLUMNAS.map((c) => (
              <label
                key={c.key}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={colsVisibles.has(c.key)}
                  onChange={() => onToggle(c.key)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
