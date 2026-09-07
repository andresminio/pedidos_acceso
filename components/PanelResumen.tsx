"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { fechaCorta } from "@/lib/fechas";

interface FilaResumen {
  anio: number;
  cuatrimestre: number;
  fecha: string;
  nombre_solicitante: string;
  solicitud: string;
  categoria: string | null;
  subcategoria: string | null;
  estado: string;
  subestado: string | null;
  fecha_respuesta: string | null;
}

const SIN_CATEGORIA = "Sin categoría";
const CUATRIMESTRES = [1, 2, 3] as const;
const NOMBRE_CUATRIMESTRE: Record<number, string> = {
  1: "1er cuatrimestre",
  2: "2do cuatrimestre",
  3: "3er cuatrimestre",
};

// Mismo criterio case-insensitive que PillEstado (components/PanelSolicitudes):
// hay datos viejos cargados con "CERRADO"/"PENDIENTE" en mayúscula.
function esCerrado(estado: string): boolean {
  return estado.trim().toLowerCase() === "cerrado";
}

export default function PanelResumen() {
  const [rows, setRows] = useState<FilaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hoy = useMemo(() => new Date(), []);
  const [filtroAnio, setFiltroAnio] = useState<number | "todos">(hoy.getFullYear());
  const [filtroCuatrimestre, setFiltroCuatrimestre] = useState<number | "todos">("todos");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pedidos_solicitudes")
      .select(
        "anio, cuatrimestre, fecha, nombre_solicitante, solicitud, categoria, subcategoria, estado, subestado, fecha_respuesta"
      );
    if (error) {
      setError(error.message);
    } else {
      setRows((data as FilaResumen[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Años con datos, más recientes primero. Si el año actual todavía no
  // tiene ningún pedido cargado, lo agregamos igual a la lista para que el
  // filtro no quede vacío el primer día del año.
  const anios = useMemo(() => {
    const set = new Set<number>(rows.map((r) => r.anio));
    set.add(hoy.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [rows, hoy]);

  const rowsDelAnio = useMemo(
    () => (filtroAnio === "todos" ? rows : rows.filter((r) => r.anio === filtroAnio)),
    [rows, filtroAnio]
  );

  const rowsDelPeriodo = useMemo(
    () =>
      filtroCuatrimestre === "todos"
        ? rowsDelAnio
        : rowsDelAnio.filter((r) => r.cuatrimestre === filtroCuatrimestre),
    [rowsDelAnio, filtroCuatrimestre]
  );

  // Contadores del período elegido en el banner.
  const contadores = useMemo(() => {
    const total = rowsDelPeriodo.length;
    const cerrados = rowsDelPeriodo.filter((r) => esCerrado(r.estado)).length;
    return { total, cerrados, pendientes: total - cerrados };
  }, [rowsDelPeriodo]);

  // Tabla por cuatrimestre — SIEMPRE el desglose completo del año elegido
  // (1er/2do/3er), sin importar el cuatrimestre puntual del banner: esta es
  // la base de la Hoja 1 del Excel ("Cantidad de solicitudes recibidas por
  // año") y no cambia según ese filtro.
  const tabla1AnioCompleto = useMemo(() => {
    const filas = CUATRIMESTRES.map((c) => {
      const delCuatrimestre = rowsDelAnio.filter((r) => r.cuatrimestre === c);
      const cerrado = delCuatrimestre.filter((r) => esCerrado(r.estado)).length;
      const total = delCuatrimestre.length;
      return { cuatrimestre: c, cerrado, pendiente: total - cerrado, total };
    }).filter((f) => f.total > 0 || f.cuatrimestre <= 2); // no mostrar 3er vacío si nunca hay datos ahí
    const totales = filas.reduce(
      (acc, f) => ({
        cerrado: acc.cerrado + f.cerrado,
        pendiente: acc.pendiente + f.pendiente,
        total: acc.total + f.total,
      }),
      { cerrado: 0, pendiente: 0, total: 0 }
    );
    return { filas, totales };
  }, [rowsDelAnio]);

  // Versión para la pantalla (tabla debajo del banner): esta sí se recorta
  // al cuatrimestre puntual elegido, porque en pantalla pedimos que todo
  // responda a los filtros. El Excel usa tabla1AnioCompleto en su lugar —
  // son cosas distintas a propósito, no hay que unificarlas.
  const tabla1 = useMemo(() => {
    const filas =
      filtroCuatrimestre === "todos"
        ? tabla1AnioCompleto.filas
        : tabla1AnioCompleto.filas.filter((f) => f.cuatrimestre === filtroCuatrimestre);
    const totales = filas.reduce(
      (acc, f) => ({
        cerrado: acc.cerrado + f.cerrado,
        pendiente: acc.pendiente + f.pendiente,
        total: acc.total + f.total,
      }),
      { cerrado: 0, pendiente: 0, total: 0 }
    );
    return { filas, totales };
  }, [tabla1AnioCompleto, filtroCuatrimestre]);

  // Tabla 2: por estado detallado (subestado si está Cerrado) x cuatrimestre.
  const tabla2 = useMemo(() => {
    const claves = [
      "Cerrado (Completo)",
      "Cerrado (Parcial)",
      "Cerrado (Rechazado)",
      "Cerrado (Sin especificar)",
      "Pendiente",
    ];
    function clave(r: FilaResumen): string {
      if (!esCerrado(r.estado)) return "Pendiente";
      const sub = r.subestado?.trim();
      if (sub === "Completo" || sub === "Parcial" || sub === "Rechazado") {
        return `Cerrado (${sub})`;
      }
      return "Cerrado (Sin especificar)";
    }
    const filas = claves
      .map((k) => {
        const porCuatrimestre = CUATRIMESTRES.map(
          (c) => rowsDelAnio.filter((r) => r.cuatrimestre === c && clave(r) === k).length
        );
        const total = porCuatrimestre.reduce((a, b) => a + b, 0);
        return { estado: k, porCuatrimestre, total };
      })
      .filter((f) => f.total > 0);
    const totalesPorCuatrimestre = CUATRIMESTRES.map((_, i) =>
      filas.reduce((acc, f) => acc + f.porCuatrimestre[i], 0)
    );
    const total = totalesPorCuatrimestre.reduce((a, b) => a + b, 0);
    return { filas, totalesPorCuatrimestre, total };
  }, [rowsDelAnio]);

  // Tabla 3: por categoría x estado, del período elegido (año + cuatrimestre).
  const tabla3 = useMemo(() => {
    const porCategoria = new Map<string, { cerrado: number; pendiente: number }>();
    for (const r of rowsDelPeriodo) {
      const cat = r.categoria?.trim() || SIN_CATEGORIA;
      const actual = porCategoria.get(cat) ?? { cerrado: 0, pendiente: 0 };
      if (esCerrado(r.estado)) actual.cerrado += 1;
      else actual.pendiente += 1;
      porCategoria.set(cat, actual);
    }
    const filas = Array.from(porCategoria.entries())
      .map(([categoria, v]) => ({
        categoria,
        cerrado: v.cerrado,
        pendiente: v.pendiente,
        total: v.cerrado + v.pendiente,
      }))
      .sort((a, b) => b.total - a.total);
    const totales = filas.reduce(
      (acc, f) => ({
        cerrado: acc.cerrado + f.cerrado,
        pendiente: acc.pendiente + f.pendiente,
        total: acc.total + f.total,
      }),
      { cerrado: 0, pendiente: 0, total: 0 }
    );
    return { filas, totales };
  }, [rowsDelPeriodo]);

  // Gráfico en pantalla: totales por tema del período elegido en el banner
  // (año + cuatrimestre) — este sí sigue los filtros.
  const tabla4 = useMemo(() => {
    const porCategoria = new Map<string, number>();
    for (const r of rowsDelPeriodo) {
      const cat = r.categoria?.trim() || SIN_CATEGORIA;
      porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + 1);
    }
    const filas = Array.from(porCategoria.entries())
      .map(([tema, cantidad]) => ({ tema, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
    const total = filas.reduce((acc, f) => acc + f.cantidad, 0);
    return { filas, total };
  }, [rowsDelPeriodo]);

  // Hoja 4 del Excel: totales por tema desde SIEMPRE, sin filtrar por año
  // ni cuatrimestre — a propósito distinto del gráfico de pantalla. Es la
  // única hoja que no depende del banner.
  const totalesTemaHistorico = useMemo(() => {
    const porCategoria = new Map<string, number>();
    for (const r of rows) {
      const cat = r.categoria?.trim() || SIN_CATEGORIA;
      porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + 1);
    }
    const filas = Array.from(porCategoria.entries())
      .map(([tema, cantidad]) => ({ tema, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
    const total = filas.reduce((acc, f) => acc + f.cantidad, 0);
    return { filas, total };
  }, [rows]);

  const maxTema = tabla4.filas[0]?.cantidad ?? 0;

  const etiquetaAnio = filtroAnio === "todos" ? "Todos los años" : `Año ${filtroAnio}`;
  const etiquetaPeriodo =
    filtroCuatrimestre === "todos"
      ? etiquetaAnio
      : filtroAnio === "todos"
        ? `${NOMBRE_CUATRIMESTRE[filtroCuatrimestre]} (todos los años)`
        : `${NOMBRE_CUATRIMESTRE[filtroCuatrimestre]} ${filtroAnio}`;

  function descargarExcel() {
    const wb = XLSX.utils.book_new();

    const hoja1 = [
      [`Cantidad de solicitudes de información recibidas por año — ${etiquetaAnio}`],
      ["Cuatrimestre", "Cerrado", "Pendiente", "Total"],
      ...tabla1AnioCompleto.filas.map((f) => [
        NOMBRE_CUATRIMESTRE[f.cuatrimestre],
        f.cerrado,
        f.pendiente,
        f.total,
      ]),
      [
        "Total",
        tabla1AnioCompleto.totales.cerrado,
        tabla1AnioCompleto.totales.pendiente,
        tabla1AnioCompleto.totales.total,
      ],
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(hoja1),
      "Por cuatrimestre"
    );

    const hoja2 = [
      [`Cantidad según estado de situación — ${etiquetaAnio}`],
      ["Estado", ...CUATRIMESTRES.map((c) => NOMBRE_CUATRIMESTRE[c]), "Total"],
      ...tabla2.filas.map((f) => [f.estado, ...f.porCuatrimestre, f.total]),
      ["Total", ...tabla2.totalesPorCuatrimestre, tabla2.total],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hoja2), "Por estado");

    const hoja3 = [
      [`Solicitudes por tema y estado — ${etiquetaPeriodo}`],
      ["Categoría", "Cerrado", "Pendiente", "Total"],
      ...tabla3.filas.map((f) => [f.categoria, f.cerrado, f.pendiente, f.total]),
      ["Total", tabla3.totales.cerrado, tabla3.totales.pendiente, tabla3.totales.total],
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(hoja3),
      "Por tema (período)"
    );

    const hoja4 = [
      ["Totales por tema — histórico completo (desde el inicio)"],
      ["Tema", "Cantidad"],
      ...totalesTemaHistorico.filas.map((f) => [f.tema, f.cantidad]),
      ["Total", totalesTemaHistorico.total],
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(hoja4),
      "Totales por tema"
    );

    const hoja5 = [
      [`Pedidos — ${etiquetaPeriodo}`],
      [
        "Año",
        "Cuat.",
        "Fecha",
        "Solicitante",
        "Solicitud",
        "Categoría",
        "Subcategoría",
        "Estado",
        "Sub-estado",
        "F. respuesta",
      ],
      ...rowsDelPeriodo
        .slice()
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map((r) => [
          r.anio,
          r.cuatrimestre,
          fechaCorta(r.fecha),
          r.nombre_solicitante,
          r.solicitud,
          r.categoria || SIN_CATEGORIA,
          r.subcategoria || "",
          r.estado,
          r.subestado || "",
          fechaCorta(r.fecha_respuesta),
        ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hoja5), "Pedidos");

    const sufijoAnio = filtroAnio === "todos" ? "todos" : String(filtroAnio);
    const sufijoCuatrimestre =
      filtroCuatrimestre === "todos" ? "completo" : `cuatrimestre_${filtroCuatrimestre}`;
    XLSX.writeFile(wb, `resumen_pedidos_${sufijoAnio}_${sufijoCuatrimestre}.xlsx`);
  }

  return (
    <div>
      {/* Banner con filtros aplicables a toda la hoja */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#12161f] px-4 py-3">
        <h2 className="text-lg font-semibold text-white">Estadísticas</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={filtroAnio}
            onChange={(e) =>
              setFiltroAnio(e.target.value === "todos" ? "todos" : Number(e.target.value))
            }
          >
            <option value="todos">Todos los años</option>
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={filtroCuatrimestre}
            onChange={(e) =>
              setFiltroCuatrimestre(
                e.target.value === "todos" ? "todos" : Number(e.target.value)
              )
            }
          >
            <option value="todos">Todo el año</option>
            {CUATRIMESTRES.map((c) => (
              <option key={c} value={c}>
                {NOMBRE_CUATRIMESTRE[c]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={descargarExcel}
            disabled={loading}
            className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Descargar Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <div className="space-y-8">
          {/* Contadores del período elegido */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TarjetaContador etiqueta="Total" valor={contadores.total} />
            <TarjetaContador
              etiqueta="Cerrados"
              valor={contadores.cerrados}
              color="text-emerald-400"
            />
            <TarjetaContador
              etiqueta="Pendientes"
              valor={contadores.pendientes}
              color="text-amber-400"
            />
          </div>

          {/* Tabla: cantidad por cuatrimestre */}
          <TablaResumen titulo={`Cantidad de solicitudes por cuatrimestre — ${etiquetaPeriodo}`}>
            <thead>
              <tr>
                <Th>Cuatrimestre</Th>
                <Th align="right">Cerrado</Th>
                <Th align="right">Pendiente</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {tabla1.filas.map((f) => (
                <tr key={f.cuatrimestre} className="border-t border-slate-800">
                  <Td>{NOMBRE_CUATRIMESTRE[f.cuatrimestre]}</Td>
                  <Td align="right">{f.cerrado}</Td>
                  <Td align="right">{f.pendiente}</Td>
                  <Td align="right">{f.total}</Td>
                </tr>
              ))}
              <FilaTotal
                etiqueta="Total"
                valores={[tabla1.totales.cerrado, tabla1.totales.pendiente, tabla1.totales.total]}
              />
            </tbody>
          </TablaResumen>

          {/* Gráfico: totales por tema */}
          <div>
            <p className="mb-3 text-sm font-semibold text-white">
              Totales por tema — {etiquetaPeriodo}
            </p>
            <div className="rounded-lg border border-slate-800 bg-[#12161f] p-4">
              <div className="space-y-1.5">
                {tabla4.filas.map((f) => (
                  <div key={f.tema} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-56 shrink-0 truncate text-slate-400 sm:w-64"
                      title={f.tema}
                    >
                      {f.tema}
                    </span>
                    <div className="h-4 flex-1 rounded bg-slate-800">
                      <div
                        className="h-4 rounded bg-blue-600"
                        style={{
                          width: maxTema ? `${(f.cantidad / maxTema) * 100}%` : "0%",
                        }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-slate-300">
                      {f.cantidad}
                    </span>
                  </div>
                ))}
                {tabla4.filas.length === 0 && (
                  <p className="text-sm text-slate-500">Sin datos para este período.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TarjetaContador({
  etiqueta,
  valor,
  color = "text-white",
}: {
  etiqueta: string;
  valor: number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#12161f] px-6 py-5">
      <p className="text-sm text-slate-500">{etiqueta}</p>
      <p className={`text-5xl font-semibold ${color}`}>{valor}</p>
    </div>
  );
}

function TablaResumen({
  titulo,
  children,
}: {
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {titulo && <p className="mb-2 text-sm font-semibold text-white">{titulo}</p>}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#12161f]">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td className={`px-3 py-2 text-slate-300 ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </td>
  );
}

function FilaTotal({ etiqueta, valores }: { etiqueta: string; valores: number[] }) {
  return (
    <tr className="border-t border-slate-700 bg-slate-800/40 font-semibold text-white">
      <Td>{etiqueta}</Td>
      {valores.map((v, i) => (
        <Td key={i} align="right">
          {v}
        </Td>
      ))}
    </tr>
  );
}
