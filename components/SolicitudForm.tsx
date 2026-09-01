"use client";

import { useState } from "react";
import type { SolicitudInput } from "@/lib/types";

// Formulario simplificado de carga: solo lo esencial. Año y cuatrimestre
// se calculan solos a partir de la fecha; estado arranca en "Pendiente"
// y el resto (sub-estado, archivo/respuesta, observaciones, f. respuesta)
// se completa después, editando la fila en la tabla.

function cuatrimestreDe(mes: number): 1 | 2 | 3 {
  if (mes <= 4) return 1;
  if (mes <= 8) return 2;
  return 3;
}

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

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const [anioStr, mesStr] = form.fecha.split("-");
    const anio = Number(anioStr);
    const cuatrimestre = cuatrimestreDe(Number(mesStr));

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
    setOpen(false);
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
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Nuevo pedido
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="text-slate-400 hover:text-slate-600"
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
                <Field label="Categoría">
                  <input
                    value={form.categoria}
                    onChange={(e) => update("categoria", e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="Subcategoría">
                  <input
                    value={form.subcategoria}
                    onChange={(e) => update("subcategoria", e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
              <Field label="Solicitud (pegar texto)">
                <textarea
                  required
                  value={form.solicitud}
                  onChange={(e) => update("solicitud", e.target.value)}
                  className="input min-h-[140px]"
                />
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
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
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
      <span className="font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
