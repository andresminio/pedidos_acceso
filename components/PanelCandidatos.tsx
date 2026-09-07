"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  agregarCategoria,
  agruparCategorias,
  cargarCategorias,
  cargarSubcategorias,
} from "@/lib/categorias";
import type { CandidatoCorreo, SolicitudInput } from "@/lib/types";
import { textoCompacto } from "@/lib/texto";
import { fechaCorta } from "@/lib/fechas";

const AGREGAR_CATEGORIA = "__agregar_categoria__";
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
// Normalizamos \r\n / \r sueltos a \n primero: muchos mails vienen con
// saltos de línea estilo Windows, y con \r de por medio el patrón de
// líneas en blanco no matcheaba.
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

// Cuando Gemini no pudo inferir nombre_solicitante (típicamente porque
// clasificó el mail como que no es un pedido, y ese campo queda null), al
// menos precargamos el nombre del remitente como punto de partida editable
// — por ejemplo si el candidato se pasa a revisión "a mano" después de
// haber sido descartado.
function nombreDeRemitente(remitente: string): string {
  const match = remitente.match(/^"?([^"<]+?)"?\s*<[^>]*>\s*$/);
  if (match && match[1].trim()) return match[1].trim();
  return remitente.replace(/[<>]/g, "").trim();
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

  const [categorias, setCategorias] = useState<string[]>([]);
  useEffect(() => {
    cargarCategorias().then(setCategorias);
  }, []);

  const desdeIso = useCallback(
    () => new Date(Date.now() - DESCARTADOS_DIAS * 24 * 3_600_000).toISOString(),
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    // Sin filtrar por es_pedido_acceso: "pendiente" incluye tanto
    // candidatos a pedido nuevo como respuestas para vincular (se separan
    // más abajo con candidatosPedido/candidatosRespuesta).
    const { data, error } = await supabase
      .from("candidatos_correo")
      .select("*")
      .eq("estado_revision", "pendiente")
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

  // Se refresca sola cada 30s — el bot de correo corre en una PC aparte
  // (Programador de tareas), así que sin esto la página se queda con lo
  // que había al abrirla hasta que alguien la recarga a mano.
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
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

  // Vincula un correo detectado como "respuesta a un pedido" con el pedido
  // elegido a mano: agrega un punto a la línea de tiempo del pedido
  // (pedido_eventos) con la etiqueta que confirmó el usuario. Un pedido
  // puede tener varios eventos (reenvío, respuesta de Nora, repregunta del
  // solicitante, respuesta final...), así que NO se pisa nada acá — cada
  // vinculación es un evento nuevo. Cerrar el pedido es una decisión aparte
  // (checkbox "Cerrar pedido" en FilaRespuesta), no algo automático.
  async function handleVincular(
    row: CandidatoCorreo,
    pedidoId: string,
    etiqueta: string,
    cerrarPedido: boolean
  ) {
    setBusyId(row.id);

    const fechaCorreo = row.fecha_correo.slice(0, 10);

    const { error: errEvento } = await supabase.from("pedido_eventos").insert({
      pedido_id: pedidoId,
      fecha: fechaCorreo,
      etiqueta,
      cuerpo: row.cuerpo_resumen,
      candidato_correo_id: row.id,
    });

    if (errEvento) {
      setBusyId(null);
      setError(errEvento.message);
      return;
    }

    if (cerrarPedido) {
      const { error: errPedido } = await supabase
        .from("pedidos_solicitudes")
        .update({ estado: "Cerrado", fecha_respuesta: fechaCorreo })
        .eq("id", pedidoId);
      if (errPedido) {
        setBusyId(null);
        setError(errPedido.message);
        return;
      }
    }

    const { error: errCandidato } = await supabase
      .from("candidatos_correo")
      .update({
        estado_revision: "aprobado",
        pedido_id: pedidoId,
        revisado_en: new Date().toISOString(),
      })
      .eq("id", row.id);

    setBusyId(null);
    if (errCandidato) {
      setError(errCandidato.message);
      return;
    }
    await load();
  }

  const candidatosPedido = useMemo(
    () => rows.filter((r) => !r.es_respuesta_pedido),
    [rows]
  );
  const candidatosRespuesta = useMemo(
    () => rows.filter((r) => r.es_respuesta_pedido),
    [rows]
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-400">
          MaryBot analiza automáticamente el correo institucional para
          identificar posibles pedidos de acceso a la información y cerrar
          procesos abiertos. Revisá las sugerencias y confirmá las acciones
          pendientes.
        </p>
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

      <h2 className="mb-2 text-lg font-semibold text-white">
        Nuevos pedidos de información
      </h2>

      {error && (
        <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}
      {!loading && candidatosPedido.length === 0 && (
        <p className="rounded-lg border border-slate-800 bg-[#12161f] px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
          No hay correos pendientes de revisión.
        </p>
      )}

      <div className="space-y-4">
        {candidatosPedido.map((row) => (
          <FilaCandidato
            key={row.id}
            row={row}
            busy={busyId === row.id}
            categorias={categorias}
            onNuevaCategoria={(c) => setCategorias((prev) => [...new Set([...prev, c])].sort((a, b) => a.localeCompare(b, "es")))}
            onDescartar={() => handleDescartar(row)}
            onCargar={(campos) => handleCargar(row, campos)}
          />
        ))}
      </div>

      {candidatosRespuesta.length > 0 && (
        <div className="mt-6 border-t border-slate-800 pt-4">
          <h2 className="mb-2 text-lg font-semibold text-white">
            Respuestas para vincular
          </h2>
          <div className="space-y-4">
            {candidatosRespuesta.map((row) => (
              <FilaRespuesta
                key={row.id}
                row={row}
                busy={busyId === row.id}
                onDescartar={() => handleDescartar(row)}
                onVincular={(pedidoId, etiqueta, cerrarPedido) =>
                  handleVincular(row, pedidoId, etiqueta, cerrarPedido)
                }
              />
            ))}
          </div>
        </div>
      )}

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
  categorias,
  onNuevaCategoria,
  onDescartar,
  onCargar,
}: {
  row: CandidatoCorreo;
  busy: boolean;
  categorias: string[];
  onNuevaCategoria: (categoria: string) => void;
  onDescartar: () => void;
  onCargar: (campos: SolicitudInput) => void;
}) {
  const [nombre, setNombre] = useState(
    row.nombre_solicitante ?? nombreDeRemitente(row.remitente)
  );
  const [fecha, setFecha] = useState(
    row.fecha_propuesta ?? row.fecha_correo.slice(0, 10)
  );
  const [solicitud, setSolicitud] = useState(row.solicitud_propuesta ?? "");
  const [categoria, setCategoria] = useState(row.categoria_propuesta ?? "");
  const [nuevaCategoria, setNuevaCategoria] = useState(false);
  const [subcategoria, setSubcategoria] = useState(row.subcategoria_propuesta ?? "");
  const [subcategorias, setSubcategorias] = useState<string[]>([]);
  const [verCompleto, setVerCompleto] = useState(false);
  const citaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cargarSubcategorias(categoria).then(setSubcategorias);
  }, [categoria]);

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
    setCategoria(limpio);
    setNuevaCategoria(false);
    onNuevaCategoria(limpio);
    const { error } = await agregarCategoria(limpio);
    if (error) console.error("No se pudo guardar la categoría nueva:", error);
  }

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
      observaciones: "Cargado automáticamente desde correo",
      respuesta_ia_borrador: null,
      respuesta_texto: null,
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
            disabled={busy || !nombre || !solicitud || !categoria}
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
              <option value="" disabled>
                Elegir categoría…
              </option>
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
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Subcategoría
          <input
            list={`subcategoria-sugerencias-${row.id}`}
            className="input"
            value={subcategoria}
            onChange={(e) => setSubcategoria(e.target.value)}
          />
          <datalist id={`subcategoria-sugerencias-${row.id}`}>
            {subcategorias.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
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

// revisado_en solo se completa cuando hay una acción humana sobre el
// candidato (descartar a mano, o el cascade al eliminar un pedido). Si el
// bot lo descartó solo al clasificarlo, queda null.
function PillOrigenDescarte({ revisadoEn }: { revisadoEn: string | null }) {
  return revisadoEn ? (
    <span className="rounded-full bg-slate-700/40 px-2 py-0.5 text-[10px] text-slate-400">
      Descartado por el usuario
    </span>
  ) : (
    <span className="rounded-full bg-slate-700/20 px-2 py-0.5 text-[10px] text-slate-500">
      Descartado por IA
    </span>
  );
}

interface PedidoBusqueda {
  id: string;
  nombre_solicitante: string;
  fecha: string;
  solicitud: string;
  estado: string;
}

function FilaRespuesta({
  row,
  busy,
  onDescartar,
  onVincular,
}: {
  row: CandidatoCorreo;
  busy: boolean;
  onDescartar: () => void;
  onVincular: (pedidoId: string, etiqueta: string, cerrarPedido: boolean) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const busqueda = row.nombre_solicitante ?? "";
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<PedidoBusqueda[]>([]);
  const [buscado, setBuscado] = useState(false);
  const [seleccionado, setSeleccionado] = useState<PedidoBusqueda | null>(null);
  // Etiqueta para el punto en la línea de tiempo del pedido — la sugiere
  // la IA (etiqueta_evento) pero se puede corregir antes de confirmar.
  const [etiqueta, setEtiqueta] = useState(row.etiqueta_evento ?? "Respuesta");
  // Vincular no cierra el pedido por sí solo: un pedido puede tener varios
  // pasos (reenvío, respuesta de Nora, repregunta...) antes del cierre
  // real, así que la decisión de cerrar es explícita acá.
  const [cerrarPedido, setCerrarPedido] = useState(false);

  const buscarPedidos = useCallback(async (termino: string) => {
    if (!termino.trim()) return;
    setBuscando(true);
    const { data } = await supabase
      .from("pedidos_solicitudes")
      .select("id, nombre_solicitante, fecha, solicitud, estado")
      .ilike("nombre_solicitante", `%${termino.trim()}%`)
      .order("fecha", { ascending: false })
      .limit(8);
    const encontrados = (data as PedidoBusqueda[]) ?? [];
    setResultados(encontrados);
    setBuscando(false);
    setBuscado(true);
    // Preseleccionar el primer resultado: el apellido ya lo detectó la IA
    // (viene del asunto "Re: ... - APELLIDO" de la cadena), así que no
    // tiene sentido pedirle al usuario que busque y elija a mano si ya
    // hay un match — igual confirma con "Vincular y cerrar".
    setSeleccionado((actual) => actual ?? encontrados[0] ?? null);
  }, []);

  // Busca sola al aparecer, sin esperar a que alguien apriete "Buscar".
  useEffect(() => {
    buscarPedidos(busqueda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tieneCuerpo = !!row.cuerpo_resumen?.trim();

  function handleDescartarClick() {
    const confirmado = window.confirm(
      "¿Descartar este correo? No se va a vincular a ningún pedido."
    );
    if (!confirmado) return;
    onDescartar();
  }

  function handleVincularClick() {
    if (!seleccionado) return;
    const etiquetaFinal = etiqueta.trim() || "Respuesta";
    const mensaje = cerrarPedido
      ? `Vas a agregar "${etiquetaFinal}" a la línea de tiempo y cerrar el pedido de "${seleccionado.nombre_solicitante}" (${fechaCorta(seleccionado.fecha)})`
      : `Vas a agregar "${etiquetaFinal}" a la línea de tiempo del pedido de "${seleccionado.nombre_solicitante}" (${fechaCorta(seleccionado.fecha)}), sin cerrarlo`;
    const confirmado = window.confirm(mensaje);
    if (!confirmado) return;
    onVincular(seleccionado.id, etiquetaFinal, cerrarPedido);
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-[#12161f] p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          correo · {fechaCortaHora(row.fecha_correo)} · de {row.remitente}
        </p>
      </div>

      <h3 className="mb-1 font-semibold text-white">{row.asunto}</h3>
      {row.confianza_ia && (
        <p className="mb-3 text-xs italic text-slate-500">IA: {row.confianza_ia}</p>
      )}

      {tieneCuerpo && (
        <div className="mb-4 flex flex-col gap-1 text-xs text-slate-500">
          Correo recibido
          <blockquote
            onClick={() => {
              if (window.getSelection()?.toString()) return;
              setExpandido((v) => !v);
            }}
            className="cursor-pointer whitespace-pre-line rounded-md border border-slate-800 bg-[#0e1219] px-3 py-3 text-sm italic leading-relaxed text-slate-400"
          >
            {expandido
              ? textoCompacto(row.cuerpo_resumen!)
              : textoCompacto(row.cuerpo_resumen!).slice(0, 240)}
            {!expandido && row.cuerpo_resumen!.length > 240 ? "…" : ""}
          </blockquote>
        </div>
      )}

      <p className="text-xs text-slate-500">
        {buscando ? "Buscando pedido…" : "Pedidos candidatos a vincular"}
      </p>

      {buscado && !buscando && resultados.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">
          No se encontraron pedidos de {row.nombre_solicitante ?? "este solicitante"}.
        </p>
      )}

      {resultados.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSeleccionado(p)}
              className={`rounded-md border px-3 py-2 text-left text-xs ${
                seleccionado?.id === p.id
                  ? "border-blue-600 bg-blue-950/30 text-white"
                  : "border-slate-800 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span className="font-medium">{p.nombre_solicitante}</span>
              {" · "}
              {fechaCorta(p.fecha)} · {p.estado}
              <span className="block truncate text-slate-500">{p.solicitud}</span>
            </button>
          ))}
        </div>
      )}

      {seleccionado && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Etiqueta
            <input
              className="input w-56"
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder="Ej: Respuesta de Nora"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={cerrarPedido}
              onChange={(e) => setCerrarPedido(e.target.checked)}
            />
            Cerrar pedido
          </label>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !seleccionado}
          onClick={handleVincularClick}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Vincular
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleDescartarClick}
          className="whitespace-nowrap rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Descartar
        </button>
        {seleccionado && (
          <span className="text-xs text-slate-500">
            Se agrega a la línea de tiempo del pedido de {seleccionado.nombre_solicitante} (
            {fechaCorta(seleccionado.fecha)}){cerrarPedido ? " y lo cierra." : "."}
          </span>
        )}
      </div>
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
          · de {row.remitente} — <span className="text-slate-300">{row.asunto}</span>{" "}
          <PillOrigenDescarte revisadoEn={row.revisado_en} />
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
