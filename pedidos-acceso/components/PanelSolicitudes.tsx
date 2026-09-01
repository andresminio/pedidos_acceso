"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ESTADOS } from "@/lib/types";
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
                <td colSpan={12} className="px-3 py-6 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-slate-400">
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
  return (
    <tr className="align-top">
      <td className="px-3 py-2">{row.anio}</td>
      <td className="px-3 py-2">{row.cuatrimestre}</td>
      <td className="px-3 py-2 whitespace-nowrap">{row.fecha}</td>
      <td className="px-3 py-2">{row.nombre_solicitante}</td>
      <td className="max-w-xs px-3 py-2">{row.solicitud}</td>
      <td className="px-3 py-2">{row.categoria}</td>
      <td className="px-3 py-2">{row.subcategoria}</td>
      <td className="px-3 py-2">{row.nombre_archivo}</td>
      <td className="px-3 py-2">
        <select
          value={row.estado}
          onChange={(e) => onUpdate(row.id, { estado: e.target.value })}
          className="input"
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          defaultValue={row.subestado ?? ""}
          onBlur={(e) => onUpdate(row.id, { subestado: e.target.value || null })}
          className="input w-32"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="date"
          defaultValue={row.fecha_respuesta ?? ""}
          onBlur={(e) =>
            onUpdate(row.id, { fecha_respuesta: e.target.value || null })
          }
          className="input"
        />
      </td>
      <td className="max-w-xs px-3 py-2">
        <input
          defaultValue={row.observaciones ?? ""}
          onBlur={(e) =>
            onUpdate(row.id, { observaciones: e.target.value || null })
          }
          className="input w-40"
        />
      </td>
    </tr>
  );
}
