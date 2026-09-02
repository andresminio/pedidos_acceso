"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ESTADOS, SUBESTADOS_CERRADO } from "@/lib/types";
import type { Solicitud, SolicitudInput } from "@/lib/types";
import SolicitudForm from "@/components/SolicitudForm";

export default function PanelSolicitudes() {
  const [rows, setRows] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filtroAnio, setFiltroAnio] = useState<string>("");
  const [filtroCuatrimestre, setFiltroCuatrimestre] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");

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

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filtroAnio && String(r.anio) !== filtroAnio) return false;
      if (filtroCuatrimestre && String(r.cuatrimestre) !== filtroCuatrimestre)
        return false;
      if (filtroEstado && r.estado !== filtroEstado) return false;
      return true;
    });
  }, [rows, filtroAnio, filtroCuatrimestre, filtroEstado]);

  const anios = useMemo(
    () => Array.from(new Set(rows.map((r) => r.anio))).sort((a, b) => b - a),
    [rows]
  );

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <SolicitudForm onSubmit={handleCreate} submitting={saving} />

      <div className="mb-3 flex flex-wrap gap-3">
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
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Año",
                "Cuat.",
                "Fecha",
                "Solicitante",
                "Solicitud",
                "Categoría",
                "Subcategoría",
                "Archivo/Respuesta",
                "Estado",
                "Sub-estado",
                "F. respuesta",
                "Observaciones",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-slate-400">
                  No hay pedidos registrados con estos filtros.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <FilaSolicitud key={row.id} row={row} onUpdate={handleUpdate} />
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
}: {
  row: Solicitud;
  onUpdate: (id: string, patch: Partial<Solicitud>) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);

  return (
    <>
      <tr className="align-top">
        <td className="px-3 py-2">{row.anio}</td>
        <td className="px-3 py-2">{row.cuatrimestre}</td>
        <td className="px-3 py-2 whitespace-nowrap">{row.fecha}</td>
        <td className="px-3 py-2">{row.nombre_solicitante}</td>
        <td className="max-w-xs truncate px-3 py-2" title={row.solicitud}>
          {row.solicitud}
        </td>
        <td className="px-3 py-2">{row.categoria}</td>
        <td className="px-3 py-2">{row.subcategoria}</td>
        <td className="px-3 py-2">{row.nombre_archivo}</td>
        <td className="px-3 py-2">{row.estado}</td>
        <td className="px-3 py-2">{row.subestado ?? "—"}</td>
        <td className="px-3 py-2 whitespace-nowrap">
          {row.fecha_respuesta ?? "—"}
        </td>
        <td className="max-w-xs truncate px-3 py-2" title={row.observaciones ?? ""}>
          {row.observaciones}
        </td>
        <td className="px-3 py-2">
          {!editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              Editar
            </button>
          )}
        </td>
      </tr>
      {editando && (
        <FilaSolicitudEdicion
          row={row}
          onUpdate={onUpdate}
          onCerrar={() => setEditando(false)}
        />
      )}
    </>
  );
}

function FilaSolicitudEdicion({
  row,
  onUpdate,
  onCerrar,
}: {
  row: Solicitud;
  onUpdate: (id: string, patch: Partial<Solicitud>) => Promise<void>;
  onCerrar: () => void;
}) {
  const [nombreArchivo, setNombreArchivo] = useState(row.nombre_archivo ?? "");
  const [estado, setEstado] = useState(row.estado);
  const [subestado, setSubestado] = useState(row.subestado ?? "");
  const [fechaRespuesta, setFechaRespuesta] = useState(row.fecha_respuesta ?? "");
  const [observaciones, setObservaciones] = useState(row.observaciones ?? "");
  const [guardando, setGuardando] = useState(false);

  async function handleGuardar() {
    setGuardando(true);
    await onUpdate(row.id, {
      nombre_archivo: nombreArchivo || null,
      estado,
      subestado: estado === "Cerrado" ? subestado || null : null,
      fecha_respuesta: fechaRespuesta || null,
      observaciones: observaciones || null,
    });
    setGuardando(false);
    onCerrar();
  }

  return (
    <tr className="bg-slate-50">
      <td colSpan={13} className="px-3 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Archivo/Respuesta
            <input
              className="input"
              value={nombreArchivo}
              onChange={(e) => setNombreArchivo(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
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
          <label className="flex flex-col gap-1 text-xs text-slate-500">
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
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            F. respuesta
            <input
              type="date"
              className="input"
              value={fechaRespuesta}
              onChange={(e) => setFechaRespuesta(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2 lg:col-span-1">
            Observaciones
            <input
              className="input"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            disabled={guardando}
            onClick={onCerrar}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={handleGuardar}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </td>
    </tr>
  );
}
