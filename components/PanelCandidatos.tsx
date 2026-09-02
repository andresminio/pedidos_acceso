"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { TEMAS } from "@/lib/types";
import type { CandidatoCorreo, SolicitudInput } from "@/lib/types";

function anioCuatrimestre(fechaISO: string): { anio: number; cuatrimestre: 1 | 2 | 3 } {
  const d = new Date(fechaISO);
  const mes = d.getMonth() + 1; // 1-12
  const cuatrimestre: 1 | 2 | 3 = mes <= 4 ? 1 : mes <= 8 ? 2 : 3;
  return { anio: d.getFullYear(), cuatrimestre };
}

export default function PanelCandidatos() {
  const [rows, setRows] = useState<CandidatoCorreo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("candidatos_correo")
      .select("*")
      .eq("estado_revision", "pendiente")
      .eq("es_pedido_acceso", true)
      .order("fecha_correo", { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setRows(data as CandidatoCorreo[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Candidatos a pedido de acceso
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Mails clasificados por IA como posibles pedidos de acceso nuevos.
          Revisá los campos propuestos, corregí lo que haga falta y cargá o
          descartá.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-slate-400">Cargando…</p>}
      {!loading && rows.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400 shadow-sm">
          No hay candidatos pendientes de revisión.
        </p>
      )}

      <div className="space-y-4">
        {rows.map((row) => (
          <FilaCandidato
            key={row.id}
            row={row}
            busy={busyId === row.id}
            onDescartar={() => handleDescartar(row)}
            onCargar={(campos) => handleCargar(row, campos)}
          />
        ))}
      </div>
    </div>
  );
}

function FilaCandidato({
  row,
  busy,
  onDescartar,
  onCargar,
}: {
  row: CandidatoCorreo;
  busy: boolean;
  onDescartar: () => void;
  onCargar: (campos: SolicitudInput) => void;
}) {
  const sugerida = anioCuatrimestre(row.fecha_propuesta ?? row.fecha_correo);

  const [nombre, setNombre] = useState(row.nombre_solicitante ?? "");
  const [fecha, setFecha] = useState(
    row.fecha_propuesta ?? row.fecha_correo.slice(0, 10)
  );
  const [solicitud, setSolicitud] = useState(row.solicitud_propuesta ?? "");
  const [categoria, setCategoria] = useState(row.categoria_propuesta ?? "");
  const [subcategoria, setSubcategoria] = useState(row.subcategoria_propuesta ?? "");

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
      observaciones: `Cargado automáticamente desde correo (asunto: "${row.asunto ?? ""}").`,
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{row.remitente}</p>
          <p className="text-sm text-slate-500">{row.asunto}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {row.urgencia && (
            <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
              Urgencia: {row.urgencia}
            </span>
          )}
          <span className="whitespace-nowrap text-slate-400">
            {new Date(row.fecha_correo).toLocaleString("es-AR")}
          </span>
        </div>
      </div>

      {row.confianza_ia && (
        <p className="mb-3 text-xs italic text-slate-400">
          IA: {row.confianza_ia}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Solicitante
          <input
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Fecha
          <input
            type="date"
            className="input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Categoría
          <select
            className="input"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">—</option>
            {TEMAS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2 lg:col-span-1">
          Subcategoría
          <input
            className="input"
            value={subcategoria}
            onChange={(e) => setSubcategoria(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
          Solicitud
          <textarea
            className="input min-h-16"
            value={solicitud}
            onChange={(e) => setSolicitud(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onDescartar}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Descartar
        </button>
        <button
          type="button"
          disabled={busy || !nombre || !solicitud}
          onClick={submitCargar}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Cargar como pedido
        </button>
      </div>
    </div>
  );
}
