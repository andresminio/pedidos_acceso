"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useFeriados } from "@/lib/useFeriados";
import {
  diasCalendarioEntre,
  diasHabilesEntre,
  motivoFijo,
  restarDiasHabiles,
  sumarDiasHabiles,
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

// Clasifica una fecha para el color del calendario. El orden importa: un
// inhábil cargado a mano puede caer un feriado nacional también, no
// importa, se muestra el primero que matchee.
type TipoDia =
  | "habil"
  | "finde"
  | "feriado_nacional"
  | "feria_judicial"
  | "empleado_judicial"
  | "custom";

function clasificarDia(
  fechaISO: string,
  esFeriadoNacional: boolean,
  esCustom: boolean
): TipoDia {
  const fijo = motivoFijo(fechaISO);
  if (fijo === "Fin de semana") return "finde";
  if (fijo === "Feria judicial de verano" || fijo === "Feria judicial de invierno")
    return "feria_judicial";
  if (fijo === "Día del Empleado Judicial") return "empleado_judicial";
  if (esCustom) return "custom";
  if (esFeriadoNacional) return "feriado_nacional";
  return "habil";
}

const ESTILO_TIPO: Record<TipoDia, string> = {
  habil: "bg-[var(--card)] text-[var(--foreground)]",
  finde: "bg-[var(--surface-2)] text-[var(--muted)]",
  feriado_nacional: "bg-blue-500/20 text-blue-300",
  feria_judicial: "bg-purple-500/20 text-purple-300",
  empleado_judicial: "bg-amber-500/20 text-amber-300",
  custom: "bg-rose-500/20 text-rose-300",
};

const LEYENDA: { tipo: TipoDia; label: string }[] = [
  { tipo: "finde", label: "Fin de semana" },
  { tipo: "feriado_nacional", label: "Feriado nacional" },
  { tipo: "feria_judicial", label: "Feria judicial" },
  { tipo: "empleado_judicial", label: "16/11 — Día del Empleado Judicial" },
  { tipo: "custom", label: "Inhábil cargado a mano" },
];

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
  const [nuevaFecha, setNuevaFecha] = useState(HOY_ISO());
  const [nuevoMotivo, setNuevoMotivo] = useState("");
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

  async function agregarInhabil(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoMotivo.trim()) return;
    setGuardando(true);
    setErrorAlta(null);
    const { error } = await supabase
      .from("dias_inhabiles_custom")
      .insert({ fecha: nuevaFecha, motivo: nuevoMotivo.trim() });
    setGuardando(false);
    if (error) {
      setErrorAlta(
        error.code === "23505"
          ? "Ya hay un inhábil cargado para esa fecha."
          : "No se pudo guardar: " + error.message
      );
      return;
    }
    setNuevoMotivo("");
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
            Sumar/restar días desde una fecha
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
            const esCustom = feriados.inhabilesCustom.some((d) => d.fecha === fechaISO);
            const tipo = clasificarDia(fechaISO, esNacional, esCustom);
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
      </section>

      {/* Inhábiles cargados a mano */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-lg font-semibold text-[var(--foreground)]">
          Inhábiles cargados a mano
        </h2>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Para paros, asuetos administrativos, feriados provinciales u otra fecha puntual que no
          esté en los feriados nacionales ni en la feria judicial.
        </p>

        {isLoggedIn && (
          <form onSubmit={agregarInhabil} className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              Fecha
              <input
                type="date"
                className="input"
                value={nuevaFecha}
                onChange={(e) => setNuevaFecha(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              Motivo
              <input
                type="text"
                required
                placeholder="ej. Paro judicial"
                className="input w-64"
                value={nuevoMotivo}
                onChange={(e) => setNuevoMotivo(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Agregar"}
            </button>
            {errorAlta && <p className="w-full text-xs text-[var(--danger-text)]">{errorAlta}</p>}
          </form>
        )}

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
                  — {d.motivo}
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
      </section>
    </div>
  );
}
