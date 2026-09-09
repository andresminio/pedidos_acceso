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
import { ESTADOS, SUBESTADOS_CERRADO } from "@/lib/types";
import type { PedidoEvento, Solicitud, SolicitudInput } from "@/lib/types";
import SolicitudForm from "@/components/SolicitudForm";
import SyncStatus from "@/components/SyncStatus";
import IconoIA from "@/components/IconoIA";
import CorreoBody from "@/components/CorreoBody";

const AGREGAR_CATEGORIA = "__agregar_categoria__";

// Etiqueta fija del punto de línea de tiempo que guarda el modelo de
// respuesta generado con IA (y editado a mano después) — se ACTUALIZA en
// el lugar en cada Guardar (no se duplica), y se distingue visualmente de
// los eventos vinculados desde un correo real (ver LineaTiempoPedido).
const ETIQUETA_BORRADOR = "Proyecto de respuesta de UEEDA";

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

// Check dentro de un círculo — distinto del IconoIA (estrella) para no
// confundir "hay correo/IA disponible" con "ya se vinculó una respuesta".
function IconoRespuestaVinculada() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

  // ids de pedidos que tienen un correo importado vinculado (candidatos_correo
  // .pedido_id) — a esos se les puede generar un modelo de respuesta con IA.
  // Se pide aparte (no viene en pedidos_solicitudes) para no consultar
  // candidatos_correo fila por fila en la tabla.
  const [pedidosConCorreo, setPedidosConCorreo] = useState<Set<string>>(new Set());
  // ids de pedidos que ya tienen al menos un evento en su línea de tiempo
  // (pedido_eventos) — para el ícono de "respuesta vinculada" en la lista.
  const [pedidosConRespuesta, setPedidosConRespuesta] = useState<Set<string>>(
    new Set()
  );

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

  const load = useCallback(async (silent = false) => {
    // Igual que en /revision: el refresco automático no debe mostrar el
    // spinner ni desmontar la tabla — eso era lo que hacía "parpadear" la
    // pantalla cada 30s. Solo la carga inicial usa el estado de loading.
    if (!silent) setLoading(true);
    const [{ data, error }, correoRes, eventosRes] = await Promise.all([
      supabase.from("pedidos_solicitudes").select("*").order("fecha", { ascending: false }),
      supabase
        .from("candidatos_correo")
        .select("pedido_id")
        .not("pedido_id", "is", null)
        // Solo el correo original del pedido habilita "Generar respuesta con
        // IA" (necesita ese cuerpo de mail para armar el prompt). Una
        // respuesta vinculada (es_respuesta_pedido = true) no cuenta: un
        // pedido cargado por import masivo puede tener una respuesta
        // vinculada sin tener nunca el correo original, y ahí no hay nada
        // que generar.
        .eq("es_respuesta_pedido", false),
      supabase.from("pedido_eventos").select("pedido_id"),
    ]);
    if (error) {
      setError(error.message);
    } else {
      setRows(data as Solicitud[]);
      setError(null);
    }
    setPedidosConCorreo(
      new Set((correoRes.data ?? []).map((r) => r.pedido_id as string))
    );
    setPedidosConRespuesta(
      new Set((eventosRes.data ?? []).map((r) => r.pedido_id as string))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Se refresca sola cada 30s (mismo criterio que /revision): si alguien
  // más edita un pedido, o el bot vincula una respuesta, se ve sin
  // necesidad de recargar la página a mano. No pisa una fila que estés
  // editando: el formulario de edición guarda su propio estado local al
  // abrirse y no se resetea con cada refresco de fondo.
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
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
                tieneCorreo={pedidosConCorreo.has(row.id) && !pedidosConRespuesta.has(row.id)}
                tieneRespuesta={pedidosConRespuesta.has(row.id)}
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
  tieneCorreo,
  tieneRespuesta,
}: {
  row: Solicitud;
  onUpdate: (id: string, patch: Partial<Solicitud>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  colsVisibles: Set<string>;
  editando: boolean;
  onAbrir: () => void;
  onCerrarEdicion: () => void;
  tieneCorreo: boolean;
  tieneRespuesta: boolean;
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
      <span className="inline-flex max-w-xs items-center gap-1.5" title={row.solicitud}>
        {tieneCorreo && (
          <span
            title="Correo importado vinculado — se puede generar respuesta con IA"
            className="shrink-0 text-slate-400"
          >
            <IconoIA />
          </span>
        )}
        {tieneRespuesta && (
          <span
            title="Tiene eventos en la línea de tiempo"
            className="shrink-0 text-emerald-500"
          >
            <IconoRespuestaVinculada />
          </span>
        )}
        <span className="truncate">{row.solicitud}</span>
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
    id: string;
    cuerpo_resumen: string | null;
    cuerpo_html: string | null;
    cuerpo_editado: string | null;
    asunto: string | null;
    remitente: string;
    destinatario: string | null;
    fecha_correo: string;
  } | null>(null);
  const [generandoRespuesta, setGenerandoRespuesta] = useState(false);
  const [errorRespuestaIA, setErrorRespuestaIA] = useState<string | null>(null);

  // Línea de tiempo del pedido: cada fila de pedido_eventos es un punto
  // (reenvío, respuesta de Nora, repregunta del solicitante, etc.),
  // ordenados por fecha. El punto de "Recepción" no vive acá — se arma
  // directo con row.fecha / row.solicitud / mailOrigen.
  const [eventos, setEventos] = useState<PedidoEvento[]>([]);
  const [desvinculandoId, setDesvinculandoId] = useState<string | null>(null);
  // Punto de la línea de tiempo abierto en el popup ("recepcion" o un
  // evento puntual) — vive acá (no en LineaTiempoPedido) porque el popup
  // del "Proyecto de respuesta de UEEDA" necesita editar respuestaIA, que
  // es estado de este componente.
  const [abierto, setAbierto] = useState<PedidoEvento | "recepcion" | null>(null);
  const [guardandoBorrador, setGuardandoBorrador] = useState(false);

  useEffect(() => {
    // es_respuesta_pedido=false: si este pedido también tiene un correo de
    // RESPUESTA vinculado (ver "Respuestas para vincular"), puede haber dos
    // filas de candidatos_correo con el mismo pedido_id — filtramos para
    // quedarnos solo con el correo original (si no, .maybeSingle() rompe
    // con más de una fila).
    supabase
      .from("candidatos_correo")
      .select("id, cuerpo_resumen, cuerpo_html, cuerpo_editado, asunto, remitente, destinatario, fecha_correo")
      .eq("pedido_id", row.id)
      .eq("es_respuesta_pedido", false)
      .maybeSingle()
      .then(({ data }) => setMailOrigen(data));
  }, [row.id]);

  const cargarEventos = useCallback(async () => {
    const { data } = await supabase
      .from("pedido_eventos")
      .select("*")
      .eq("pedido_id", row.id)
      .order("fecha", { ascending: true });
    setEventos((data as PedidoEvento[]) ?? []);
  }, [row.id]);

  useEffect(() => {
    cargarEventos();
  }, [cargarEventos]);

  // Si está Cerrado, la F. respuesta es obligatoria y no puede ser anterior
  // a la fecha de ingreso (puede ser el mismo día: no tiene sentido
  // responder antes de recibir el pedido, pero sí el mismo día).
  const errorFechaRespuesta =
    estado === "Cerrado"
      ? !fechaRespuesta
        ? "Un pedido Cerrado necesita F. respuesta."
        : fechaRespuesta < fecha
          ? "La F. respuesta no puede ser anterior a la fecha de ingreso."
          : null
      : null;

  // Un pedido Cerrado siempre tiene que decir si se respondió Completo,
  // Parcial o fue Rechazado — si no, queda como "Cerrado sin especificar"
  // en el resumen, que no sirve para nada.
  const errorSubestado =
    estado === "Cerrado" && !subestado ? "Un pedido Cerrado necesita Sub-estado." : null;

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
    if (errorFechaRespuesta || errorSubestado) return;
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
    await guardarEventoBorrador();
    setGuardando(false);
    onCerrar();
  }

  async function guardarEventoBorrador() {
    const eventoBorrador = eventos.find((e) => e.etiqueta === ETIQUETA_BORRADOR);
    const texto = respuestaIA.trim();

    if (!texto) {
      if (eventoBorrador) {
        await supabase.from("pedido_eventos").delete().eq("id", eventoBorrador.id);
      }
      return;
    }

    const hoy = new Date().toISOString().slice(0, 10);
    if (eventoBorrador) {
      await supabase
        .from("pedido_eventos")
        .update({ cuerpo: texto, fecha: hoy })
        .eq("id", eventoBorrador.id);
    } else {
      await supabase.from("pedido_eventos").insert({
        pedido_id: row.id,
        fecha: hoy,
        etiqueta: ETIQUETA_BORRADOR,
        cuerpo: texto,
      });
    }
  }

  // Saca un punto de la línea de tiempo (deshace una vinculación hecha por
  // error): el correo asociado (si lo hay) vuelve a "descartado" — mismo
  // criterio que descartar un candidato a mano — y la fecha_respuesta del
  // pedido se recalcula con lo que quede (la más reciente, o vacía si no
  // queda ningún evento). El estado del pedido NO se toca acá: puede
  // seguir Cerrado aunque se le saque el último evento — el cierre es una
  // decisión aparte (checkbox "Cerrar pedido" al vincular).
  async function handleDesvincularEvento(evento: PedidoEvento) {
    const confirmado = window.confirm(
      `Vas a sacar "${evento.etiqueta}" (${fechaCorta(evento.fecha)}) de la línea de tiempo.`
    );
    if (!confirmado) return;
    setDesvinculandoId(evento.id);

    if (evento.candidato_correo_id) {
      const { error: errCorreo } = await supabase
        .from("candidatos_correo")
        .update({ estado_revision: "descartado", revisado_en: new Date().toISOString() })
        .eq("id", evento.candidato_correo_id);
      if (errCorreo) {
        console.error("No se pudo descartar el correo vinculado:", errCorreo.message);
      }
    }

    const { error } = await supabase.from("pedido_eventos").delete().eq("id", evento.id);
    if (error) {
      console.error("No se pudo desvincular el evento:", error.message);
      setDesvinculandoId(null);
      return;
    }

    const restantes = eventos.filter((e) => e.id !== evento.id);
    // El proyecto de respuesta (borrador) no cuenta como "fecha de
    // respuesta" real — solo los eventos vinculados desde un correo.
    const restantesReales = restantes.filter((e) => e.etiqueta !== ETIQUETA_BORRADOR);
    const nuevaFechaRespuesta = restantesReales.length
      ? restantesReales.reduce((max, e) => (e.fecha > max ? e.fecha : max), restantesReales[0].fecha)
      : null;
    await onUpdate(row.id, { fecha_respuesta: nuevaFechaRespuesta });
    setFechaRespuesta(nuevaFechaRespuesta ?? "");
    setEventos(restantes);
    setDesvinculandoId(null);
  }

  // Renombra el título de un evento de la línea de tiempo (ej. "Respuesta"
  // -> "Respuesta de Nora"). No aplica a "Recepción" (no es un evento real,
  // sale de row.fecha/row.solicitud) ni al borrador de IA (su etiqueta fija
  // — ETIQUETA_BORRADOR — es lo que activa la UI especial del popup).
  async function handleRenombrarEvento(evento: PedidoEvento, nuevaEtiqueta: string) {
    const limpia = nuevaEtiqueta.trim();
    if (!limpia || limpia === evento.etiqueta) return;

    const { error } = await supabase
      .from("pedido_eventos")
      .update({ etiqueta: limpia })
      .eq("id", evento.id);
    if (error) {
      console.error("No se pudo renombrar el evento:", error.message);
      return;
    }
    setEventos((prev) =>
      prev.map((e) => (e.id === evento.id ? { ...e, etiqueta: limpia } : e))
    );
    setAbierto((prev) =>
      prev && prev !== "recepcion" && prev.id === evento.id
        ? { ...prev, etiqueta: limpia }
        : prev
    );
  }

  // Guarda (o borra, si texto es null) la versión editada a mano de "qué
  // mostrar" para el correo abierto en el popup — ver botón "Editar
  // mensaje" en CorreoBody. Nunca toca el correo original; "recepcion" es
  // el correo en candidatos_correo (mailOrigen), cualquier otro caso es un
  // punto de pedido_eventos.
  async function handleGuardarCuerpoEditado(
    destino: PedidoEvento | "recepcion",
    texto: string | null
  ) {
    if (destino === "recepcion") {
      if (!mailOrigen) return;
      const { error } = await supabase
        .from("candidatos_correo")
        .update({ cuerpo_editado: texto })
        .eq("id", mailOrigen.id);
      if (error) {
        console.error("No se pudo guardar la edición del correo:", error.message);
        return;
      }
      setMailOrigen((prev) => (prev ? { ...prev, cuerpo_editado: texto } : prev));
      return;
    }
    const { error } = await supabase
      .from("pedido_eventos")
      .update({ cuerpo_editado: texto })
      .eq("id", destino.id);
    if (error) {
      console.error("No se pudo guardar la edición del evento:", error.message);
      return;
    }
    setEventos((prev) =>
      prev.map((e) => (e.id === destino.id ? { ...e, cuerpo_editado: texto } : e))
    );
    setAbierto((prev) =>
      prev && prev !== "recepcion" && prev.id === destino.id
        ? { ...prev, cuerpo_editado: texto }
        : prev
    );
  }

  // Guarda los cambios hechos al modelo de respuesta desde el popup del
  // punto "Proyecto de respuesta de UEEDA" (textarea + regenerar), sin
  // necesidad de pasar por el botón "Guardar" general del pedido.
  async function handleGuardarBorrador() {
    setGuardandoBorrador(true);
    await onUpdate(row.id, { respuesta_ia_borrador: respuestaIA || null });
    await guardarEventoBorrador();
    await cargarEventos();
    setGuardandoBorrador(false);
    setAbierto(null);
  }

  // Saca el punto "Proyecto de respuesta de UEEDA" de la línea de tiempo
  // desde su propio popup (reutiliza la confirmación y la lógica de
  // handleDesvincularEvento) y limpia el borrador guardado en el pedido.
  async function handleSacarBorrador() {
    if (abierto === "recepcion" || !abierto) return;
    await handleDesvincularEvento(abierto);
    setRespuestaIA("");
    await onUpdate(row.id, { respuesta_ia_borrador: null });
    setAbierto(null);
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
          fecha,
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
              className={`input disabled:cursor-not-allowed disabled:opacity-40 ${
                errorSubestado ? "border-red-600" : ""
              }`}
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
            {errorSubestado && (
              <span className="text-xs text-red-400">{errorSubestado}</span>
            )}
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

        <LineaTiempoPedido row={row} eventos={eventos} onAbrir={setAbierto} />

        {abierto && (
          <PopupEventoPedido
            key={abierto === "recepcion" ? "recepcion" : abierto.id}
            row={row}
            abierto={abierto}
            mailOrigen={mailOrigen}
            respuestaIA={respuestaIA}
            onRespuestaIAChange={setRespuestaIA}
            generandoRespuesta={generandoRespuesta}
            errorRespuestaIA={errorRespuestaIA}
            guardandoBorrador={guardandoBorrador}
            desvinculandoId={desvinculandoId}
            onGenerarRespuesta={handleGenerarRespuesta}
            onGuardarBorrador={handleGuardarBorrador}
            onSacarBorrador={handleSacarBorrador}
            onRenombrar={handleRenombrarEvento}
            onGuardarEdicionCuerpo={(texto) => handleGuardarCuerpoEditado(abierto, texto)}
            onDesvincular={(evento) => {
              handleDesvincularEvento(evento);
              setAbierto(null);
            }}
            onCerrar={() => setAbierto(null)}
          />
        )}

        {/* "Generar respuesta con IA" solo aparece antes de la primera vez
            que se guarda un proyecto — una vez que existe el punto
            "Proyecto de respuesta de UEEDA" en la línea de tiempo, se edita
            desde ahí (popup), no acá abajo. */}
        {mailOrigen && eventos.length === 0 && (
          <div className="mt-3 flex flex-col gap-3">
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
                  {generandoRespuesta ? "Generando…" : "Generar respuesta con IA"}
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
                !!errorFechaRespuesta ||
                !!errorSubestado
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

// Línea de tiempo del pedido: "Recepción" (siempre presente, sale del
// pedido en sí — el mail original si lo hay, si no la solicitud tal como
// quedó cargada) seguida de cada evento vinculado (reenvío, respuesta de
// Nora, repregunta del solicitante, etc.), ordenados por fecha. Click en
// un punto abre el correo completo en un popup.
function LineaTiempoPedido({
  row,
  eventos,
  onAbrir,
}: {
  row: Solicitud;
  eventos: PedidoEvento[];
  onAbrir: (item: PedidoEvento | "recepcion") => void;
}) {
  return (
    <div className="mt-5">
      <p className="mb-3 text-sm text-slate-400">Línea de tiempo</p>
      <div className="flex items-start overflow-x-auto pb-2">
        <PuntoTiempo
          etiqueta="Recepción"
          fecha={row.fecha}
          color="bg-blue-500"
          onClick={() => onAbrir("recepcion")}
        />
        {eventos.map((ev) => (
          <div key={ev.id} className="flex shrink-0 items-start">
            <div className="mt-2.5 h-px w-12 shrink-0 bg-slate-700" />
            <PuntoTiempo
              etiqueta={ev.etiqueta}
              fecha={ev.fecha}
              color={
                ev.etiqueta === ETIQUETA_BORRADOR ? "bg-amber-500" : "bg-emerald-500"
              }
              onClick={() => onAbrir(ev)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Popup de un punto de la línea de tiempo. Para "recepcion" y los eventos
// normales es de solo lectura (con "Desvincular" para sacarlos). Para el
// punto especial "Proyecto de respuesta de UEEDA" es editable: acá vive
// ahora todo lo que antes se mostraba siempre abajo del formulario
// (textarea + "Volver a generar con IA") — una vez guardado el primer
// borrador, se edita solo desde acá.
function PopupEventoPedido({
  row,
  abierto,
  mailOrigen,
  respuestaIA,
  onRespuestaIAChange,
  generandoRespuesta,
  errorRespuestaIA,
  guardandoBorrador,
  desvinculandoId,
  onGenerarRespuesta,
  onGuardarBorrador,
  onSacarBorrador,
  onRenombrar,
  onGuardarEdicionCuerpo,
  onDesvincular,
  onCerrar,
}: {
  row: Solicitud;
  abierto: PedidoEvento | "recepcion";
  mailOrigen: {
    cuerpo_resumen: string | null;
    cuerpo_html: string | null;
    cuerpo_editado: string | null;
    asunto: string | null;
    remitente: string;
    destinatario: string | null;
    fecha_correo: string;
  } | null;
  respuestaIA: string;
  onRespuestaIAChange: (texto: string) => void;
  generandoRespuesta: boolean;
  errorRespuestaIA: string | null;
  guardandoBorrador: boolean;
  desvinculandoId: string | null;
  onGenerarRespuesta: () => void;
  onGuardarBorrador: () => void;
  onSacarBorrador: () => void;
  onRenombrar: (evento: PedidoEvento, nuevaEtiqueta: string) => void;
  onGuardarEdicionCuerpo: (texto: string | null) => void | Promise<void>;
  onDesvincular: (evento: PedidoEvento) => void;
  onCerrar: () => void;
}) {
  const esBorrador = abierto !== "recepcion" && abierto.etiqueta === ETIQUETA_BORRADOR;
  // Solo se puede renombrar un evento real (no "Recepción", que no tiene
  // fila propia en pedido_eventos) y que no sea el borrador de IA (su
  // etiqueta fija identifica esa fila especial en el resto del código).
  const puedeRenombrar = abierto !== "recepcion" && !esBorrador;
  const [editandoEtiqueta, setEditandoEtiqueta] = useState(false);
  const [valorEtiqueta, setValorEtiqueta] = useState(
    abierto === "recepcion" ? "" : abierto.etiqueta
  );

  function guardarEtiqueta() {
    setEditandoEtiqueta(false);
    if (abierto !== "recepcion") onRenombrar(abierto, valorEtiqueta);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCerrar}
    >
      <div
        className="max-h-[80vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-slate-800 bg-[#12161f] p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            {editandoEtiqueta ? (
              <input
                autoFocus
                className="input h-7 w-48 px-1.5 py-0 text-sm font-semibold"
                value={valorEtiqueta}
                onChange={(e) => setValorEtiqueta(e.target.value)}
                onBlur={guardarEtiqueta}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setValorEtiqueta(abierto === "recepcion" ? "" : abierto.etiqueta);
                    setEditandoEtiqueta(false);
                  }
                }}
              />
            ) : (
              <h4
                className={`font-semibold text-white ${puedeRenombrar ? "cursor-text" : ""}`}
                title={puedeRenombrar ? "Doble click para editar el nombre" : undefined}
                onDoubleClick={() => puedeRenombrar && setEditandoEtiqueta(true)}
              >
                {abierto === "recepcion" ? "Recepción" : abierto.etiqueta}
              </h4>
            )}
            <p className="text-xs text-slate-500">
              {fechaCorta(abierto === "recepcion" ? row.fecha : abierto.fecha)}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {esBorrador ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={generandoRespuesta}
                onClick={onGenerarRespuesta}
                className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                <IconoIA />
                {generandoRespuesta ? "Generando…" : "Volver a generar con IA"}
              </button>
              {errorRespuestaIA && (
                <span className="text-xs text-red-400">{errorRespuestaIA}</span>
              )}
            </div>
            <textarea
              className="input min-h-48"
              value={respuestaIA}
              onChange={(e) => onRespuestaIAChange(e.target.value)}
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={guardandoBorrador}
                onClick={onSacarBorrador}
                className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                Sacar de la línea de tiempo
              </button>
              <button
                type="button"
                disabled={guardandoBorrador}
                onClick={onGuardarBorrador}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {guardandoBorrador ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <CorreoBody
              remitente={
                abierto === "recepcion"
                  ? mailOrigen?.remitente || row.nombre_solicitante
                  : abierto.remitente || abierto.etiqueta
              }
              destinatario={
                abierto === "recepcion" ? mailOrigen?.destinatario : abierto.destinatario
              }
              fecha={
                abierto === "recepcion"
                  ? mailOrigen && fechaCorta(mailOrigen.fecha_correo.slice(0, 10))
                  : fechaCorta(abierto.fecha)
              }
              asunto={abierto === "recepcion" ? mailOrigen?.asunto : abierto.asunto}
              html={abierto === "recepcion" ? mailOrigen?.cuerpo_html : abierto.cuerpo_html}
              texto={
                abierto === "recepcion"
                  ? mailOrigen?.cuerpo_resumen || row.solicitud
                  : abierto.cuerpo
              }
              cuerpoEditado={
                abierto === "recepcion" ? mailOrigen?.cuerpo_editado : abierto.cuerpo_editado
              }
              onGuardarEdicion={onGuardarEdicionCuerpo}
            />
            {abierto !== "recepcion" && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={desvinculandoId === abierto.id}
                  onClick={() => onDesvincular(abierto)}
                  className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {desvinculandoId === abierto.id ? "Desvinculando…" : "Desvincular"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PuntoTiempo({
  etiqueta,
  fecha,
  color,
  onClick,
}: {
  etiqueta: string;
  fecha: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 flex-col items-center gap-1.5 px-3"
    >
      <span className={`h-4 w-4 rounded-full ${color}`} />
      <span className="whitespace-nowrap text-xs text-slate-500">
        {fechaCorta(fecha)}
      </span>
      <span
        className="max-w-32 truncate text-xs font-medium text-slate-300"
        title={etiqueta}
      >
        {etiqueta}
      </span>
    </button>
  );
}
