"use client";

import { useState } from "react";
import { ESTADOS } from "@/lib/types";
import type { SolicitudInput } from "@/lib/types";

const empty: SolicitudInput = {
  anio: new Date().getFullYear(),
  cuatrimestre: 1,
  fecha: new Date().toISOString().slice(0, 10),
  nombre_solicitante: "",
  solicitud: "",
  categoria: "",
  subcategoria: "",
  nombre_archivo: "",
  estado: "Pendiente",
  subestado: "",
  fecha_respuesta: "",
  observaciones: "",
};

export default function SolicitudForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (input: SolicitudInput) => Promise<void>;
  submitting: boolean;
}) {
  const [form, setForm] = useState<SolicitudInput>(empty);
  const [open, setOpen] = useState(false);

  function update<K extends keyof SolicitudInput>(key: K, value: SolicitudInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(form);
    setForm(empty);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
      >
        + Nuevo pedido
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
    >
      <Field label="Año">
        <input
          type="number"
          required
          value={form.anio}
          onChange={(e) => update("anio", Number(e.target.value))}
          className="input"
        />
      </Field>
      <Field label="Cuatrimestre">
        <select
          value={form.cuatrimestre}
          onChange={(e) => update("cuatrimestre", Number(e.target.value) as 1 | 2 | 3)}
          className="input"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </Field>
      <Field label="Fecha">
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
      <Field label="Solicitud" full>
        <textarea
          required
          value={form.solicitud}
          onChange={(e) => update("solicitud", e.target.value)}
          className="input min-h-[70px]"
        />
      </Field>
      <Field label="Categoría">
        <input
          value={form.categoria ?? ""}
          onChange={(e) => update("categoria", e.target.value)}
          className="input"
        />
      </Field>
      <Field label="Subcategoría">
        <input
          value={form.subcategoria ?? ""}
          onChange={(e) => update("subcategoria", e.target.value)}
          className="input"
        />
      </Field>
      <Field label="Nombre del archivo / Respuesta">
        <input
          value={form.nombre_archivo ?? ""}
          onChange={(e) => update("nombre_archivo", e.target.value)}
          className="input"
        />
      </Field>
      <Field label="Estado">
        <select
          value={form.estado}
          onChange={(e) => update("estado", e.target.value)}
          className="input"
        >
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Sub-estado">
        <input
          value={form.subestado ?? ""}
          onChange={(e) => update("subestado", e.target.value)}
          className="input"
        />
      </Field>
      <Field label="F. respuesta">
        <input
          type="date"
          value={form.fecha_respuesta ?? ""}
          onChange={(e) => update("fecha_respuesta", e.target.value)}
          className="input"
        />
      </Field>
      <Field label="Observaciones" full>
        <textarea
          value={form.observaciones ?? ""}
          onChange={(e) => update("observaciones", e.target.value)}
          className="input min-h-[70px]"
        />
      </Field>

      <div className="col-span-full flex gap-2">
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
