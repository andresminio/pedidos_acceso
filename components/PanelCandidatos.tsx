"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  agregarCategoria,
  agruparCategorias,
  cargarCategorias,
  cargarSubcategorias,
} from "@/lib/categorias";
import { SUBESTADOS_CERRADO } from "@/lib/types";
import type { CandidatoCorreo, SolicitudInput } from "@/lib/types";
import { textoCompacto } from "@/lib/texto";
import { fechaCorta } from "@/lib/fechas";
import CorreoBody from "@/components/CorreoBody";
import { useAuth } from "@/lib/auth";

// Guarda (o borra, si texto es null) la edición manual de "qué mostrar"
// para un correo — ver botón "Editar mensaje" en CorreoBody. Nunca toca el
// correo original (cuerpo_resumen/cuerpo_html), solo esta columna aparte.
async function guardarCuerpoEditado(id: string, texto: string | null) {
  await supabase.from("candidatos_correo").update({ cuerpo_editado: texto }).eq("id", id);
}

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

// Respaldo por si el correo no tiene etiqueta_evento sugerida por la IA
// (por ejemplo, uno pasado a mano desde "Ver descartados" con "Pasar a
// vincular"): mismo criterio de remitentes fijos que mail-bot/classify.py,
// para no mostrar un genérico "Respuesta" cuando se puede ser específico.
// El email de Nora NO se hardcodea acá a propósito (este componente corre
// en el navegador: cualquier valor literal queda visible en el bundle
// público) — ese caso puntual solo se etiqueta bien vía etiqueta_evento,
// ya resuelto server-side en mail-bot/classify.py con NORA_EMAIL.
function etiquetaSugerida(row: CandidatoCorreo): string {
  if (row.etiqueta_evento) return row.etiqueta_evento;
  const remitente = row.remitente.toLowerCase();
  if (remitente.includes("cnelectoral.psactjudicial@pjn.gov.ar")) return "Respuesta Prosecretaría";
  return "Respuesta";
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

// Una fila de historial de corridas del bot (mail_sync_runs, mail-bot/).
// mail_sync_state sigue existiendo aparte (solo trackea el último UID IMAP
// para el dedupe) — esto es un log, una fila por corrida.
interface CorridaBot {
  id: string;
  corrida_en: string;
  hostname: string | null;
  nuevos_correos: number;
  en_revision: number;
  descartados: number;
  error: string | null;
}

const CORRIDAS_HISTORIAL = 5;

export default function PanelCandidatos() {
  const { isLoggedIn } = useAuth();
  const [rows, setRows] = useState<CandidatoCorreo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ultimasCorridas, setUltimasCorridas] = useState<CorridaBot[]>([]);
  const [verCorridas, setVerCorridas] = useState(false);

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

  const load = useCallback(async (silent = false) => {
    // El refresco automático (cada 30s) no debe mostrar "Cargando…" ni
    // desmontar la lista: eso es lo que hacía que la pantalla "saltara" y
    // reacomodara todo cada tanto. Solo la carga inicial usa el spinner.
    if (!silent) setLoading(true);
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

    // Historial de corridas del bot (independiente de si encontró pedidos
    // o no) — mail_sync_runs tiene una fila por corrida, a diferencia de
    // mail_sync_state que es una sola fila con el último UID IMAP.
    const { data: corridas } = await supabase
      .from("mail_sync_runs")
      .select("id, corrida_en, hostname, nuevos_correos, en_revision, descartados, error")
      .order("corrida_en", { ascending: false })
      .limit(CORRIDAS_HISTORIAL);
    setUltimasCorridas((corridas as CorridaBot[]) ?? []);

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
    const id = setInterval(() => load(true), 30_000);
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
        es_respuesta_pedido: false,
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

  // Para cuando la IA (o un descarte manual) se equivocó y en realidad el
  // correo es una repregunta/respuesta activa sobre un pedido ya cargado:
  // en vez de mandarlo a "Nuevos pedidos de información" (que lo trataría
  // como un pedido nuevo), lo pasa a "Respuestas para vincular".
  async function handlePasarAVincular(row: CandidatoCorreo) {
    setBusyId(row.id);
    const { error } = await supabase
      .from("candidatos_correo")
      .update({
        estado_revision: "pendiente",
        es_pedido_acceso: false,
        es_respuesta_pedido: true,
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
    cerrarPedido: boolean,
    subestado: string
  ) {
    setBusyId(row.id);

    const fechaCorreo = row.fecha_correo.slice(0, 10);

    const { error: errEvento } = await supabase.from("pedido_eventos").insert({
      pedido_id: pedidoId,
      fecha: fechaCorreo,
      etiqueta,
      cuerpo: row.cuerpo_resumen,
      cuerpo_html: row.cuerpo_html,
      remitente: row.remitente,
      destinatario: row.destinatario,
      asunto: row.asunto,
      candidato_correo_id: row.id,
    });

    if (errEvento) {
      setBusyId(null);
      setError(errEvento.message);
      return;
    }

    if (cerrarPedido) {
      // Sub-estado obligatorio al cerrar: si no, queda un "Cerrado sin
      // especificar" que no sirve para el resumen (ver PanelResumen).
      const { error: errPedido } = await supabase
        .from("pedidos_solicitudes")
        .update({ estado: "Cerrado", fecha_respuesta: fechaCorreo, subestado })
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
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          UEEDA_bot analiza automáticamente el correo institucional para
          identificar posibles pedidos de acceso a la información y cerrar
          procesos abiertos. Revisá las sugerencias y confirmá las acciones
          pendientes.
        </p>
        <div className="flex flex-col items-end text-xs text-[var(--muted-3)]">
          {ultimasCorridas.length > 0 && (
            <button
              type="button"
              onClick={() => setVerCorridas((v) => !v)}
              className="mb-0.5 font-medium text-[var(--accent-hover)] hover:text-[var(--accent)]"
            >
              {verCorridas ? "Ocultar últimas corridas" : "Ver últimas corridas"}
            </button>
          )}
          <p className="whitespace-nowrap">
            {ultimasCorridas.length === 0 ? (
              "todavía no corrió"
            ) : (
              <>última corrida: {fechaCortaHora(ultimasCorridas[0].corrida_en)}</>
            )}
          </p>
        </div>
      </div>

      {verCorridas && (
        <div className="-mt-2 mb-4 space-y-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted-3)]">
          {ultimasCorridas.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
              <span className="whitespace-nowrap">
                {fechaCortaHora(c.corrida_en)}
                {c.hostname ? <> · {c.hostname}</> : null}
              </span>
              <span className="whitespace-nowrap">
                {c.error ? (
                  <span className="text-[var(--danger-text)]">error: {c.error}</span>
                ) : (
                  <>
                    nuevos: {c.nuevos_correos}, revisión: {c.en_revision}, descartados:{" "}
                    {c.descartados}
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
        Nuevos pedidos de información
      </h2>

      {error && (
        <div className="mb-4 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-[var(--muted-3)]">Cargando…</p>}
      {!loading && candidatosPedido.length === 0 && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-6 text-center text-sm text-[var(--muted-3)] shadow-sm">
          No hay correos pendientes de revisión.
        </p>
      )}

      <div className="space-y-4">
        {candidatosPedido.map((row) => (
          <FilaCandidato
            key={row.id}
            row={row}
            busy={busyId === row.id}
            puedeEditar={isLoggedIn}
            categorias={categorias}
            onNuevaCategoria={(c) => setCategorias((prev) => [...new Set([...prev, c])].sort((a, b) => a.localeCompare(b, "es")))}
            onDescartar={() => handleDescartar(row)}
            onCargar={(campos) => handleCargar(row, campos)}
          />
        ))}
      </div>

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
          Respuestas para vincular
        </h2>
        {!loading && candidatosRespuesta.length === 0 && (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-6 text-center text-sm text-[var(--muted-3)] shadow-sm">
            No hay respuestas pendientes de vinculación.
          </p>
        )}
        {candidatosRespuesta.length > 0 && (
          <div className="space-y-4">
            {candidatosRespuesta.map((row) => (
              <FilaRespuesta
                key={row.id}
                row={row}
                busy={busyId === row.id}
                puedeEditar={isLoggedIn}
                onDescartar={() => handleDescartar(row)}
                onVincular={(pedidoId, etiqueta, cerrarPedido, subestado) =>
                  handleVincular(row, pedidoId, etiqueta, cerrarPedido, subestado)
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4 text-sm">
        <p className="text-[var(--muted-3)]">
          {descartadosSemana ?? "…"} mails descartados en los últimos{" "}
          {DESCARTADOS_DIAS} días.
        </p>
        <button
          type="button"
          onClick={toggleVerDescartados}
          className="whitespace-nowrap font-medium text-[var(--accent-hover)] hover:text-[var(--accent)]"
        >
          {verDescartados ? "Ocultar descartados" : "Ver descartados"}
        </button>
      </div>

      {verDescartados && (
        <div className="mt-3 space-y-2">
          {cargandoDescartados && (
            <p className="text-sm text-[var(--muted-3)]">Cargando…</p>
          )}
          {!cargandoDescartados && descartados.length === 0 && (
            <p className="text-sm text-[var(--muted-3)]">
              No hay descartados en los últimos {DESCARTADOS_DIAS} días.
            </p>
          )}
          {descartados.map((d) => (
            <FilaDescartado
              key={d.id}
              row={d}
              busy={busyId === d.id}
              puedeEditar={isLoggedIn}
              onPasarARevision={() => handlePasarARevision(d)}
              onPasarAVincular={() => handlePasarAVincular(d)}
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
  puedeEditar,
  categorias,
  onNuevaCategoria,
  onDescartar,
  onCargar,
}: {
  row: CandidatoCorreo;
  busy: boolean;
  puedeEditar: boolean;
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
      observaciones: row.observaciones_propuesta
        ? `${row.observaciones_propuesta} — Cargado automáticamente desde UEEDA_bot`
        : "Cargado automáticamente desde UEEDA_bot",
      respuesta_ia_borrador: null,
      respuesta_texto: null,
    });
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted-3)]">
          correo · {fechaCortaHora(row.fecha_correo)} · de {row.remitente}
        </p>
        {puedeEditar && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy || !nombre || !solicitud || !categoria}
              onClick={submitCargar}
              className="whitespace-nowrap rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              Cargar como pedido
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDescartar}
              className="whitespace-nowrap rounded-md border border-[var(--border-2)] px-3 py-1.5 text-sm text-[var(--muted-2)] hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              Descartar
            </button>
          </div>
        )}
      </div>

      <h3 className="mb-1 font-semibold text-[var(--foreground)]">{row.asunto}</h3>

      {row.confianza_ia && (
        <p className="mb-3 text-xs italic text-[var(--muted-3)]">IA: {row.confianza_ia}</p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-[var(--muted-3)]">
          Solicitante
          {puedeEditar ? (
            <input
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          ) : (
            <p className="text-sm text-[var(--fg-soft)]">{nombre || "—"}</p>
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted-3)]">
          Categoría
          {!puedeEditar ? (
            <p className="text-sm text-[var(--fg-soft)]">{categoria || "—"}</p>
          ) : nuevaCategoria ? (
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
        <label className="flex flex-col gap-1 text-xs text-[var(--muted-3)]">
          Subcategoría
          {puedeEditar ? (
            <>
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
            </>
          ) : (
            <p className="text-sm text-[var(--fg-soft)]">{subcategoria || "—"}</p>
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted-3)]">
          Fecha del mail
          {puedeEditar ? (
            <input
              type="date"
              className="input"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          ) : (
            <p className="text-sm text-[var(--fg-soft)]">{fechaCorta(fecha)}</p>
          )}
        </label>
      </div>

      <label className="mb-3 flex flex-col gap-1 text-xs text-[var(--muted-3)]">
        Solicitud
        {puedeEditar ? (
          <textarea
            className="input min-h-16"
            value={solicitud}
            onChange={(e) => setSolicitud(e.target.value)}
          />
        ) : (
          <p className="whitespace-pre-line text-sm text-[var(--fg-soft)]">{solicitud || "—"}</p>
        )}
      </label>

      {row.cuerpo_resumen && (
        <div ref={citaRef}>
          <CorreoBody
            remitente={row.remitente}
            destinatario={row.destinatario}
            fecha={fechaCortaHora(row.fecha_correo)}
            asunto={row.asunto}
            etiqueta="Correo recibido"
            html={row.cuerpo_html}
            texto={row.cuerpo_resumen}
            cuerpoEditado={row.cuerpo_editado}
            onGuardarEdicion={
              puedeEditar ? (texto) => guardarCuerpoEditado(row.id, texto) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

// revisado_en solo se completa cuando hay una acción humana sobre el
// candidato (descartar a mano, o el cascade al eliminar un pedido). Si el
// bot lo descartó solo al clasificarlo, queda null.
function PillOrigenDescarte({ revisadoEn }: { revisadoEn: string | null }) {
  return revisadoEn ? (
    <span className="rounded-full bg-[var(--surface-3)]/40 px-2 py-0.5 text-[10px] text-[var(--muted-3)]">
      Descartado por el usuario
    </span>
  ) : (
    <span className="rounded-full bg-[var(--surface-3)]/40 px-2 py-0.5 text-[10px] text-[var(--muted-3)]">
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
  puedeEditar,
  onDescartar,
  onVincular,
}: {
  row: CandidatoCorreo;
  busy: boolean;
  puedeEditar: boolean;
  onDescartar: () => void;
  onVincular: (
    pedidoId: string,
    etiqueta: string,
    cerrarPedido: boolean,
    subestado: string
  ) => void;
}) {
  const busqueda = row.nombre_solicitante ?? "";
  const [terminoBusqueda, setTerminoBusqueda] = useState(busqueda);
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<PedidoBusqueda[]>([]);
  const [buscado, setBuscado] = useState(false);
  const [seleccionado, setSeleccionado] = useState<PedidoBusqueda | null>(null);
  // Etiqueta para el punto en la línea de tiempo del pedido — la sugiere
  // la IA (etiqueta_evento) pero se puede corregir antes de confirmar.
  const [etiqueta, setEtiqueta] = useState(etiquetaSugerida(row));
  // Vincular no cierra el pedido por sí solo: un pedido puede tener varios
  // pasos (reenvío, respuesta de Nora, repregunta...) antes del cierre
  // real, así que la decisión de cerrar es explícita acá.
  const [cerrarPedido, setCerrarPedido] = useState(false);
  // Obligatorio si se tilda "Cerrar pedido" — sin esto queda un "Cerrado
  // sin especificar" que no sirve para el resumen (ver PanelResumen).
  const [subestado, setSubestado] = useState("");

  const buscarPedidos = useCallback(async (termino: string) => {
    if (!termino.trim()) return;
    setBuscando(true);
    const { data } = await supabase.rpc("buscar_pedidos_solicitante", {
      termino: termino.trim(),
    });
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

  // Busca sola al aparecer, sin esperar a que alguien apriete "Buscar" —
  // pero solo si la IA propuso un nombre. Si no (ej. un mail interno sin
  // solicitante identificado), no hay con qué buscar automáticamente y
  // queda esperando a que alguien escriba el nombre a mano (ver el input
  // de abajo).
  useEffect(() => {
    if (busqueda.trim()) buscarPedidos(busqueda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autocompletar: busca solo al tipear (debounce de 300ms), como una
  // sugerencia — sin esperar a que apriete "Buscar". Se cancela el
  // resultado anterior si sigue escribiendo antes de que termine.
  useEffect(() => {
    if (!terminoBusqueda.trim() || terminoBusqueda.trim().length < 2) return;
    const id = setTimeout(() => {
      setSeleccionado(null);
      buscarPedidos(terminoBusqueda);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminoBusqueda]);

  function handleBuscarManual() {
    setSeleccionado(null);
    buscarPedidos(terminoBusqueda);
  }

  // Si el pedido elegido ya está cerrado, "Cerrar pedido" es redundante
  // (esto es una repregunta sobre algo ya resuelto) — no tiene sentido
  // ofrecer la opción, así que se oculta y se limpia cualquier selección
  // previa para no arrastrar un cierre que ya no aplica.
  const pedidoYaCerrado = seleccionado?.estado === "Cerrado";
  useEffect(() => {
    if (pedidoYaCerrado) {
      setCerrarPedido(false);
      setSubestado("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoYaCerrado]);

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
    if (cerrarPedido && !subestado) return;
    const etiquetaFinal = etiqueta.trim() || "Respuesta";
    const mensaje = cerrarPedido
      ? `Vas a agregar "${etiquetaFinal}" a la línea de tiempo y cerrar el pedido de "${seleccionado.nombre_solicitante}" (${fechaCorta(seleccionado.fecha)})`
      : `Vas a agregar "${etiquetaFinal}" a la línea de tiempo del pedido de "${seleccionado.nombre_solicitante}" (${fechaCorta(seleccionado.fecha)}), sin cerrarlo`;
    const confirmado = window.confirm(mensaje);
    if (!confirmado) return;
    onVincular(seleccionado.id, etiquetaFinal, cerrarPedido, subestado);
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted-3)]">
          correo · {fechaCortaHora(row.fecha_correo)} · de {row.remitente}
        </p>
      </div>

      <h3 className="mb-1 font-semibold text-[var(--foreground)]">{row.asunto}</h3>
      {row.confianza_ia && (
        <p className="mb-3 text-xs italic text-[var(--muted-3)]">IA: {row.confianza_ia}</p>
      )}

      {tieneCuerpo && (
        <div className="mb-4">
          <CorreoBody
            remitente={row.remitente}
            destinatario={row.destinatario}
            fecha={fechaCortaHora(row.fecha_correo)}
            asunto={row.asunto}
            etiqueta="Correo recibido"
            html={row.cuerpo_html}
            texto={row.cuerpo_resumen}
            cuerpoEditado={row.cuerpo_editado}
            onGuardarEdicion={
              puedeEditar ? (texto) => guardarCuerpoEditado(row.id, texto) : undefined
            }
          />
        </div>
      )}

      {puedeEditar && (
        <>
          <p className="text-xs text-[var(--muted-3)]">
            {buscando ? "Buscando pedido…" : "Pedidos candidatos a vincular"}
          </p>

          <div className="mt-2 flex items-center gap-2">
            <input
              className="input w-64"
              value={terminoBusqueda}
              onChange={(e) => setTerminoBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleBuscarManual();
              }}
              placeholder="Buscar por apellido del solicitante…"
            />
            <button
              type="button"
              onClick={handleBuscarManual}
              disabled={buscando || !terminoBusqueda.trim()}
              className="rounded-md border border-[var(--border-2)] px-3 py-1.5 text-xs font-medium text-[var(--muted-2)] hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              Buscar
            </button>
          </div>

          {buscado && !buscando && resultados.length === 0 && (
            <p className="mt-2 text-xs text-[var(--muted-3)]">
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
                      ? "border-[var(--accent)] bg-[var(--accent-soft-bg)] text-[var(--accent-soft-text)]"
                      : "border-[var(--border)] text-[var(--muted-2)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <span className="font-medium">{p.nombre_solicitante}</span>
                  {" · "}
                  {fechaCorta(p.fecha)} · {p.estado}
                  <span className="block truncate text-[var(--muted-3)]">{p.solicitud}</span>
                </button>
              ))}
            </div>
          )}

          {seleccionado && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-[var(--muted-3)]">
                Etiqueta
                <input
                  className="input w-56"
                  value={etiqueta}
                  onChange={(e) => setEtiqueta(e.target.value)}
                  placeholder="Ej: Respuesta de Nora"
                />
              </label>
              {!pedidoYaCerrado && (
                <button
                  type="button"
                  onClick={() => setCerrarPedido((v) => !v)}
                  aria-pressed={cerrarPedido}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    cerrarPedido
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface-2)] text-[var(--muted)] hover:bg-[var(--surface-3)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      cerrarPedido ? "bg-white" : "bg-[var(--muted-3)]"
                    }`}
                  />
                  Cerrar pedido
                </button>
              )}
              {cerrarPedido && (
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted-3)]">
                  Sub-estado
                  <select
                    className={`input w-auto ${!subestado ? "border-[var(--danger-border)]" : ""}`}
                    value={subestado}
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
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !seleccionado || (cerrarPedido && !subestado)}
              onClick={handleVincularClick}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              Vincular
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleDescartarClick}
              className="whitespace-nowrap rounded-md border border-[var(--border-2)] px-3 py-1.5 text-sm text-[var(--muted-2)] hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              Descartar
            </button>
            {seleccionado && (
              <span className="text-xs text-[var(--muted-3)]">
                Se agrega a la línea de tiempo del pedido de {seleccionado.nombre_solicitante} (
                {fechaCorta(seleccionado.fecha)}){cerrarPedido ? " y lo cierra." : "."}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FilaDescartado({
  row,
  busy,
  puedeEditar,
  onPasarARevision,
  onPasarAVincular,
}: {
  row: CandidatoCorreo;
  busy: boolean;
  puedeEditar: boolean;
  onPasarARevision: () => void;
  onPasarAVincular: () => void;
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
      className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted-3)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          onClick={() => {
            if (window.getSelection()?.toString()) return;
            if (tieneCuerpo) setExpandido((v) => !v);
          }}
          className={tieneCuerpo ? "cursor-pointer" : ""}
        >
          <span className="text-[var(--muted)]">{fechaCortaHora(row.fecha_correo)}</span>{" "}
          · de {row.remitente} — <span className="text-[var(--muted-2)]">{row.asunto}</span>{" "}
          <PillOrigenDescarte revisadoEn={row.revisado_en} />
          {row.confianza_ia && (
            <div className="mt-1 italic text-[var(--muted-3)]">IA: {row.confianza_ia}</div>
          )}
        </div>
        {puedeEditar && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onPasarARevision}
              title="Tratarlo como un pedido de acceso nuevo, todavía no registrado"
              className="whitespace-nowrap rounded-md border border-[var(--border-2)] px-2 py-1 text-xs text-[var(--muted-2)] hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              Pasar a revisión
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onPasarAVincular}
              title='Es una respuesta o repregunta sobre un pedido ya cargado — pasarlo a "Respuestas para vincular"'
              className="whitespace-nowrap rounded-md border border-[var(--border-2)] px-2 py-1 text-xs text-[var(--muted-2)] hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              Pasar a vincular
            </button>
          </div>
        )}
      </div>
      {expandido && tieneCuerpo && (
        <>
          <p className="mt-2 text-xs text-[var(--muted-3)]">Correo recibido</p>
          <blockquote className="mt-1 whitespace-pre-line rounded-md border border-[var(--border)] bg-black/20 px-3 py-2 text-sm italic text-[var(--muted)]">
            {textoCompacto(row.cuerpo_resumen!)}
          </blockquote>
        </>
      )}
    </div>
  );
}
