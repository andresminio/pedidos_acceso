"use client";

import { useEffect, useState } from "react";
import { agregarCategoria, cargarCategorias, cargarSubcategorias } from "@/lib/categorias";
import { anioCuatrimestreDeFecha } from "@/lib/fechas";
import type { SolicitudInput } from "@/lib/types";

const AGREGAR_NUEVO = "__agregar_nuevo__";

// Formulario simplificado de carga: solo lo esencial. Año y cuatrimestre
// se calculan solos a partir de la fecha; estado arranca en "Pendiente"
// y el resto (sub-estado, observaciones, f. respuesta) se completa
// después, editando la fila en la tabla.

interface FormState {
  fecha: string;
  nombre_solicitante: string;
  categoria: string;
  subcategoria: string;
  solicitud: string;
}

const empty: FormState = {
  fecha: new Date().toISOString().slice(0, 10),
  nombre_solicitante: "",
  categoria: "",
  subcategoria: "",
  solicitud: "",
};

export default function SolicitudForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (input: SolicitudInput) => Promise<void>;
  submitting: boolean;
}) {
  const [form, setForm] = useState<FormState>(empty);
  const [open, setOpen] = useState(false);
  const [temas, setTemas] = useState<string[]>([]);
  const [nuevoTema, setNuevoTema] = useState(false);
  const [subcategorias, setSubcategorias] = useState<string[]>([]);
  const [sintetizando, setSintetizando] = useState(false);
  const [errorSintesis, setErrorSintesis] = useState<string | null>(null);

  useEffect(() => {
    cargarCategorias().then(setTemas);
  }, []);

  // Sugerencias de subcategoría (datalist) según la categoría elegida:
  // combina la lista de referencia con lo que ya se cargó de verdad.
  useEffect(() => {
    cargarSubcategorias(form.categoria).then(setSubcategorias);
  }, [form.categoria]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { anio, cuatrimestre } = anioCuatrimestreDeFecha(form.fecha);

    await onSubmit({
      anio,
      cuatrimestre,
      fecha: form.fecha,
      nombre_solicitante: form.nombre_solicitante,
      solicitud: form.solicitud,
      categoria: form.categoria || null,
      subcategoria: form.subcategoria || null,
      nombre_archivo: null,
      estado: "Pendiente",
      subestado: null,
      fecha_respuesta: null,
      observaciones: null,
    });
    setForm(empty);
    setNuevoTema(false);
    setOpen(false);
  }

  function handleTemaChange(value: string) {
    if (value === AGREGAR_NUEVO) {
      setNuevoTema(true);
      update("categoria", "");
      return;
    }
    setNuevoTema(false);
    update("categoria", value);
  }

  async function handleSintetizar() {
    setErrorSintesis(null);
    setSintetizando(true);
    try {
      const res = await fetch("/api/resumir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: form.solicitud }),
      });
      const data = await res.json();
      if (!res.ok || !data.resumen) {
        setErrorSintesis(data.error ?? "No se pudo sintetizar.");
        return;
      }
      update("solicitud", data.resumen);
    } catch (e) {
      setErrorSintesis(e instanceof Error ? e.message : "Error de red.");
    } finally {
      setSintetizando(false);
    }
  }

  async function confirmarNuevoTema(nombre: string) {
    const limpio = nombre.trim();
    if (!limpio) {
      setNuevoTema(false);
      return;
    }
    if (!temas.includes(limpio)) {
      setTemas((t) => [...t, limpio].sort((a, b) => a.localeCompare(b, "es")));
    }
    update("categoria", limpio);
    setNuevoTema(false);
    const { error } = await agregarCategoria(limpio);
    if (error) console.error("No se pudo guardar la categoría nueva:", error);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mb-4 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
      >
        + Nuevo pedido
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-slate-800 bg-[#12161f] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Nuevo pedido
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Field label="Fecha de ingreso">
                <input
                  type="date"
                  required
                  value={form.fecha}
                  onChange={(e) => update("fecha", e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Nombre del solicitante">
                <input
                  required
                  value={form.nombre_solicitante}
                  onChange={(e) => update("nombre_solicitante", e.target.value)}
                  className="input"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tema">
                  {nuevoTema ? (
                    <input
                      autoFocus
                      placeholder="Nombre del nuevo tema"
                      onBlur={(e) => confirmarNuevoTema(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          confirmarNuevoTema(e.currentTarget.value);
                        }
                      }}
                      className="input"
                    />
                  ) : (
                    <select
                      required
                      value={form.categoria}
                      onChange={(e) => handleTemaChange(e.target.value)}
                      className="input"
                    >
                      <option value="" disabled>
                        Elegir tema…
                      </option>
                      {temas.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      <option value={AGREGAR_NUEVO}>+ Agregar nuevo tema</option>
                    </select>
                  )}
                </Field>
                <Field label="Subcategoría">
                  <input
                    list="subcategoria-sugerencias"
                    value={form.subcategoria}
                    onChange={(e) => update("subcategoria", e.target.value)}
                    className="input"
                  />
                  <datalist id="subcategoria-sugerencias">
                    {subcategorias.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </Field>
              </div>
              <Field label="Solicitud">
                <textarea
                  required
                  value={form.solicitud}
                  onChange={(e) => update("solicitud", e.target.value)}
                  className="input min-h-[140px]"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!form.solicitud.trim() || sintetizando}
                    onClick={handleSintetizar}
                    className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    <IconoIA />
                    {sintetizando ? "Reescribiendo…" : "Reescribir con IA"}
                  </button>
                  {errorSintesis && (
                    <span className="text-xs text-red-400">{errorSintesis}</span>
                  )}
                </div>
              </Field>

              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {submitting ? "Guardando…" : "Guardar pedido"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Estrella de 4 puntas (tipo el ícono de Gemini), no un emoji.
function IconoIA() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M12 2c.5 4.2 1.3 6.9 2.5 8.5C15.7 12.1 18.2 13 22 13.5c-3.8.5-6.3 1.4-7.5 3-1.2 1.6-2 4.3-2.5 8.5-.5-4.2-1.3-6.9-2.5-8.5C8.3 14.9 5.8 14 2 13.5c3.8-.5 6.3-1.4 7.5-3C10.7 8.9 11.5 6.2 12 2z" />
    </svg>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${full ? "col-span-full" : ""}`}>
      <span className="font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}
