"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useFeriados } from "@/lib/useFeriados";
import type { TipoInhabil } from "@/lib/useFeriados";
import {
  diasCalendarioEntre,
  diasHabilesEntre,
  motivoFijo,
  restarDiasHabiles,
  sumarDiasHabiles,
  tipoDiaFijo,
} from "@/lib/feriados";

const HOY_ISO = () => new Date().toISOString().slice(0, 10);

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const NOMBRES_DIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function fechaCorta(fechaISO: string): string {
  const [a, m, d] = fechaISO.split("-");
  return `${d}/${m}/${a}`;
}

// Clasifica una fecha para el color del calendario. Un inhábil cargado a
// mano es siempre uno de los tres tipos de TipoInhabil — no hay una
// categoría "custom" aparte, se pinta con el color de su propio tipo. El
// 16/11 (fijo) entra en "inhabil_judicial", la misma categoría que un
// inhábil judicial cargado a mano.
type TipoDia = "habil" | "finde" | TipoInhabil;

function clasificarDia(
  fechaISO: string,
  esFeriadoNacional: boolean,
  tipoCustom: TipoInhabil | null
): TipoDia {
  const fijo = tipoDiaFijo(fechaISO);
  if (fijo) return fijo;
  if (tipoCustom) return tipoCustom;
  if (esFeriadoNacional) return "feriado";
  return "habil";
}

const ESTILO_TIPO: Record<TipoDia, string> = {
  habil: "bg-[var(--card)] text-[var(--foreground)]",
  finde: "bg-[var(--surface-2)] text-[var(--muted)]",
  feriado: "bg-blue-500/20 text-blue-300",
  feria_judicial: "bg-purple-500/20 text-purple-300",
  inhabil_judicial: "bg-amber-500/20 text-amber-300",
};

const LEYENDA: { tipo: TipoDia; label: string }[] = [
  { tipo: "finde", label: "Fin de semana" },
  { tipo: "feriado", label: "Feriado" },
  { tipo: "feria_judicial", label: "Feria judicial" },
  { tipo: "inhabil_judicial", label: "Inhábil judicial" },
];

const TIPO_LABEL: Record<TipoInhabil, string> = {
  feriado: "Feriado",
  feria_judicial: "Feria judicial",
  inhabil_judicial: "Inhábil judicial",
};

export default function PanelPlazos() {
  const { isLoggedIn } = useAuth();

  // --- Calculadora ---
  const [modo, setModo] = useState<"entre" | "sumar">("sumar");
  const [fechaDesde, setFechaDesde] = useState(HOY_ISO());
  const [fechaHasta, setFechaHasta] = useState(HOY_ISO());
  const [cantidadDias, setCantidadDias] = useState(15);
  const [direccion, setDireccion] = useState<"sumar" | "restar">("sumar");

  // --- Calendario ---
  const hoy = new Date();
  const [mesVisible, setMesVisible] = useState(hoy.getMonth()); // 0-11
  const [anioVisible, setAnioVisible] = useState(hoy.getFullYear());

  // --- Alta de inhábil personalizado ---
  const [modalAbierto, setModalAbierto] = useState(false);
  const [verInhabiles, setVerInhabiles] = useState(false);
  const [esRango, setEsRango] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState(HOY_ISO());
  const [nuevaFechaHasta, setNuevaFechaHasta] = useState(HOY_ISO());
  const [nuevoMotivo, setNuevoMotivo] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<TipoInhabil>("feriado");
  const [guardando, setGuardando] = useState(false);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);

  const aniosNecesarios = useMemo(() => {
    const anios = new Set<number>([anioVisible]);
    anios.add(Number(fechaDesde.slice(0, 4)));
    anios.add(Number(fechaHasta.slice(0, 4)));
    return [...anios];
  }, [anioVisible, fechaDesde, fechaHasta]);

  const feriados = useFeriados(aniosNecesarios);

  const resultadoEntre = useMemo(() => {
    if (modo !== "entre" || feriados.cargando) return null;
    return {
      corridos: diasCalendarioEntre(fechaDesde, fechaHasta),
      habiles: diasHabilesEntre(fechaDesde, fechaHasta, feriados.set),
    };
  }, [modo, fechaDesde, fechaHasta, feriados.cargando, feriados.set]);

  const resultadoSumar = useMemo(() => {
    if (modo !== "sumar" || feriados.cargando) return null;
    const fn = direccion === "sumar" ? sumarDiasHabiles : restarDiasHabiles;
    const resultado = fn(fechaDesde, cantidadDias, feriados.set);
    const diaSemana = NOMBRES_DIA[new Date(resultado + "T00:00:00").getDay()];
    return { resultado, diaSemana };
  }, [modo, fechaDesde, cantidadDias, direccion, feriados.cargando, feriados.set]);

  // Todas las fechas ISO entre desde y hasta, ambas inclusive.
  function fechasEnRango(desdeISO: string, hastaISO: string): string[] {
    const fechas: string[] = [];
    const cursor = new Date(desdeISO + "T00:00:00");
    const fin = new Date(hastaISO + "T00:00:00").getTime();
    while (cursor.getTime() <= fin) {
      fechas.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    return fechas;
  }

  async function agregarInhabil(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoMotivo.trim()) return;
    if (esRango && nuevaFechaHasta < nuevaFecha) {
      setErrorAlta("La fecha \"hasta\" no puede ser anterior a la fecha \"desde\".");
      return;
    }
    const fechas = esRango ? fechasEnRango(nuevaFecha, nuevaFechaHasta) : [nuevaFecha];
    setGuardando(true);
    setErrorAlta(null);
    const motivo = nuevoMotivo.trim();
    // upsert (no insert): así cargar de nuevo un rango que se pisa con algo
    // ya cargado actualiza el motivo/tipo en vez de romper por la fecha
    // duplicada (fecha es la clave primaria de la tabla).
    const { error } = await supabase
      .from("dias_inhabiles_custom")
      .upsert(
        fechas.map((fecha) => ({ fecha, motivo, tipo: nuevoTipo })),
        { onConflict: "fecha" }
      );
    setGuardando(false);
    if (error) {
      setErrorAlta("No se pudo guardar: " + error.message);
      return;
    }
    setNuevoMotivo("");
    setNuevoTipo("feriado");
    setEsRango(false);
    setModalAbierto(false);
    feriados.recargar();
  }

  async function quitarInhabil(fecha: string) {
    if (!window.confirm(`¿Quitar el inhábil del ${fechaCorta(fecha)}?`)) return;
    await supabase.from("dias_inhabiles_custom").delete().eq("fecha", fecha);
    feriados.recargar();
  }

  // --- Grilla del calendario ---
  const primerDiaMes = new Date(anioVisible, mesVisible, 1);
  const diasEnMes = new Date(anioVisible, mesVisible + 1, 0).getDate();
  const offsetInicio = primerDiaMes.getDay(); // 0 = domingo
  const celdas: (string | null)[] = [
    ...Array(offsetInicio).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => {
      const dia = String(i + 1).padStart(2, "0");
      const mes = String(mesVisible + 1).padStart(2, "0");
      return `${anioVisible}-${mes}-${dia}`;
    }),
  ];

  function cambiarMes(delta: number) {
    let m = mesVisible + delta;
    let a = anioVisible;
    if (m < 0) {
      m = 11;
      a -= 1;
    } else if (m > 11) {
      m = 0;
      a += 1;
    }
    setMesVisible(m);
    setAnioVisible(a);
  }

  // Detalle debajo del calendario: un renglón por cada día no hábil del
  // mes visible que tenga un motivo puntual (feriado, feria judicial o
  // inhábil judicial) — los fines de semana comunes no se listan, son
  // obvios y llenarían la lista de ruido.
  const diasDestacados = celdas
    .filter((f): f is string => f !== null)
    .map((fechaISO) => {
      const esNacional = feriados.feriadosNacionales.some((f) => f.fecha === fechaISO);
      const custom = feriados.inhabilesCustom.find((d) => d.fecha === fechaISO);
      const tipo = clasificarDia(fechaISO, esNacional, custom?.tipo ?? null);
      if (tipo === "habil" || tipo === "finde") return null;
      return { fecha: fechaISO, tipo, motivo: feriados.motivo(fechaISO) ?? motivoFijo(fechaISO) ?? "" };
    })
    .filter((d): d is { fecha: string; tipo: TipoInhabil; motivo: string } => d !== null);

  return (
    <div className="flex flex-col gap-6">
      {/* Calculadora */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-lg font-semibold text-[var(--foreground)]">
          Calculadora de días hábiles
        </h2>
        <div className="mb-4 flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1 text-sm">
          <button
            type="button"
            onClick={() => setModo("sumar")}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
              modo === "sumar"
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            Días hábiles desde una fecha
          </button>
          <button
            type="button"
            onClick={() => setModo("entre")}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
              modo === "entre"
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            Contar días entre dos fechas
          </button>
        </div>

        {modo === "sumar" ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              Fecha de partida
              <input
                type="date"
                className="input"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              Días hábiles
              <input
                type="number"
                min={1}
                className="input w-24"
                value={cantidadDias}
                onChange={(e) => setCantidadDias(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              Dirección
              <select
                className="input"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value as "sumar" | "restar")}
              >
                <option value="sumar">Hacia adelante (vencimiento)</option>
                <option value="restar">Hacia atrás (fecha límite previa)</option>
              </select>
            </label>
            <div className="rounded-md bg-[var(--surface-2)] px-4 py-2 text-sm">
              {feriados.cargando || !resultadoSumar ? (
                "Calculando…"
              ) : (
                <>
                  Resultado:{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {resultadoSumar.diaSemana} {fechaCorta(resultadoSumar.resultado)}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              Desde
              <input
                type="date"
                className="input"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              Hasta
              <input
                type="date"
                className="input"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </label>
            <div className="rounded-md bg-[var(--surface-2)] px-4 py-2 text-sm">
              {feriados.cargando || !resultadoEntre ? (
                "Calculando…"
              ) : (
                <>
                  <span className="font-semibold text-[var(--foreground)]">
                    {resultadoEntre.habiles}
                  </span>{" "}
                  día(s) hábil(es) — {resultadoEntre.corridos} corrido(s)
                </>
              )}
            </div>
          </div>
        )}
        {feriados.error && (
          <p className="mt-2 text-xs text-[var(--danger-text)]">{feriados.error}</p>
        )}
      </section>

      {/* Calendario */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {NOMBRES_MES[mesVisible]} {anioVisible}
          </h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => cambiarMes(-1)}
              className="rounded-md border border-[var(--border-2)] px-2.5 py-1 text-sm text-[var(--muted-2)] hover:bg-[var(--surface-2)]"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => cambiarMes(1)}
              className="rounded-md border border-[var(--border-2)] px-2.5 py-1 text-sm text-[var(--muted-2)] hover:bg-[var(--surface-2)]"
            >
              →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {NOMBRES_DIA.map((d) => (
            <div key={d} className="py-1 font-medium text-[var(--muted)]">
              {d}
            </div>
          ))}
          {celdas.map((fechaISO, i) => {
            if (!fechaISO) return <div key={`vacio-${i}`} />;
            const esNacional = feriados.feriadosNacionales.some((f) => f.fecha === fechaISO);
            const custom = feriados.inhabilesCustom.find((d) => d.fecha === fechaISO);
            const tipo = clasificarDia(fechaISO, esNacional, custom?.tipo ?? null);
            const motivo = feriados.motivo(fechaISO) ?? motivoFijo(fechaISO);
            return (
              <div
                key={fechaISO}
                title={motivo ?? undefined}
                className={`flex h-10 flex-col items-center justify-center rounded-md text-sm ${ESTILO_TIPO[tipo]}`}
              >
                {Number(fechaISO.slice(8, 10))}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          {LEYENDA.map(({ tipo, label }) => (
            <span key={tipo} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-sm ${ESTILO_TIPO[tipo]}`} />
              {label}
            </span>
          ))}
        </div>

        {diasDestacados.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 border-t border-[var(--border)] pt-3 text-sm">
            {diasDestacados.map((d) => (
              <li key={d.fecha} className="flex items-start gap-2">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${ESTILO_TIPO[d.tipo]}`} />
                <span>
                  <span className="font-medium text-[var(--foreground)]">
                    {fechaCorta(d.fecha)}
                  </span>{" "}
                  — {d.motivo}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Inhábiles cargados a mano: botón de alta arriba (mismo lugar/estilo
          que "+ Nuevo pedido" en Ingresados) + línea compacta tipo "mails
          descartados" para desplegar la lista, sin panel aparte. */}
      {isLoggedIn && (
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          + Nuevo día inhábil
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-[var(--muted-3)]">
          {feriados.inhabilesCustom.length} inhábil(es) cargado(s) a mano.
        </p>
        <button
          type="button"
          onClick={() => setVerInhabiles((v) => !v)}
          className="whitespace-nowrap font-medium text-[var(--accent-hover)] hover:text-[var(--accent)]"
        >
          {verInhabiles ? "Ocultar inhábiles" : "Ver inhábiles"}
        </button>
      </div>

      {modalAbierto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
            onClick={() => setModalAbierto(false)}
          >
            <div
              className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  Nuevo día inhábil
                </h2>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  aria-label="Cerrar"
                  className="text-[var(--muted-3)] hover:text-[var(--muted-2)]"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={agregarInhabil} className="flex flex-col gap-3">
                <div className={esRango ? "grid grid-cols-2 gap-3" : ""}>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-[var(--muted)]">
                      {esRango ? "Desde" : "Fecha"}
                    </span>
                    <input
                      type="date"
                      className="input"
                      value={nuevaFecha}
                      onChange={(e) => setNuevaFecha(e.target.value)}
                    />
                  </label>
                  {esRango && (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-[var(--muted)]">Hasta</span>
                      <input
                        type="date"
                        className="input"
                        value={nuevaFechaHasta}
                        min={nuevaFecha}
                        onChange={(e) => setNuevaFechaHasta(e.target.value)}
                      />
                    </label>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={esRango}
                    onChange={(e) => {
                      setEsRango(e.target.checked);
                      if (e.target.checked) setNuevaFechaHasta(nuevaFecha);
                    }}
                  />
                  Cargar un rango de fechas (ej. para toda la feria judicial)
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-[var(--muted)]">Tipo</span>
                  <select
                    className="input"
                    value={nuevoTipo}
                    onChange={(e) => setNuevoTipo(e.target.value as TipoInhabil)}
                  >
                    <option value="feriado">Feriado</option>
                    <option value="feria_judicial">Feria judicial</option>
                    <option value="inhabil_judicial">Inhábil judicial</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-[var(--muted)]">Motivo</span>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="ej. Paro judicial"
                    className="input"
                    value={nuevoMotivo}
                    onChange={(e) => setNuevoMotivo(e.target.value)}
                  />
                </label>
                {errorAlta && <p className="text-xs text-[var(--danger-text)]">{errorAlta}</p>}
                <div className="mt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={guardando}
                    className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
                    {guardando ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAbierto(false)}
                    className="rounded-md border border-[var(--border-2)] px-4 py-2 text-sm font-medium text-[var(--muted-2)] hover:bg-[var(--surface-2)]"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {verInhabiles && (
          <div className="mt-1">
            {feriados.inhabilesCustom.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No hay ninguno cargado todavía.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {feriados.inhabilesCustom.map((d) => (
                  <li
                    key={d.fecha}
                    className="flex items-center justify-between rounded-md bg-[var(--surface-2)] px-3 py-1.5 text-sm"
                  >
                    <span>
                      <span className="font-medium text-[var(--foreground)]">
                        {fechaCorta(d.fecha)}
                      </span>{" "}
                      — {d.motivo}{" "}
                      <span className="text-xs text-[var(--muted)]">({TIPO_LABEL[d.tipo]})</span>
                    </span>
                    {isLoggedIn && (
                      <button
                        type="button"
                        onClick={() => quitarInhabil(d.fecha)}
                        className="text-xs text-[var(--danger-text)] hover:underline"
                      >
                        Quitar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      <p className="text-xs text-[var(--muted)]">
        Fuente: Feriados Nacionales{" "}
        <a
          href="https://argentinadatos.com"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-[var(--fg-soft)]"
        >
          ArgentinaDatos
        </a>{" "}
        (api.argentinadatos.com), actualizada diariamente. La feria y los inhábiles judiciales son
        cargados por el usuario.
      </p>
    </div>
  );
}
