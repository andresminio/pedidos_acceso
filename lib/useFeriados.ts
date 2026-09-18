"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface FeriadoNacional {
  fecha: string; // ISO yyyy-mm-dd
  nombre: string;
}

// Un inhábil cargado a mano siempre es UNO de estos tres tipos — no existe
// una categoría "custom" aparte en el calendario, se pinta con el mismo
// color que su tipo (ver TipoDiaFijo en lib/feriados.ts, que además usa
// "inhabil_judicial" para el 16/11 fijo).
export type TipoInhabil = "feriado" | "feria_judicial" | "inhabil_judicial";

export interface DiaInhabilCustom {
  fecha: string; // ISO yyyy-mm-dd
  motivo: string;
  tipo: TipoInhabil;
}

export interface Feriados {
  cargando: boolean;
  error: string | null;
  feriadosNacionales: FeriadoNacional[];
  inhabilesCustom: DiaInhabilCustom[];
  // Unión de fechas de feriado nacional + inhábil custom — lo que espera
  // esDiaHabil/sumarDiasHabiles/diasHabilesEntre de lib/feriados.ts (los
  // findes, la feria judicial y el 16/11 los evalúan esas funciones solas).
  set: Set<string>;
  // Nombre/motivo de por qué esa fecha puntual es un feriado nacional o un
  // inhábil cargado a mano (no cubre findes/feria/16-11 — para eso ver
  // motivoFijo en lib/feriados.ts). null si esa fecha no está en ninguna
  // de las dos listas.
  motivo: (fechaISO: string) => string | null;
  recargar: () => void;
}

// Cache en memoria (dura mientras el módulo esté cargado en el navegador)
// para no pedirle a /api/feriados/[anio] el mismo año una y otra vez desde
// cada fila/componente que use este hook en la misma sesión de la SPA. La
// ruta ya cachea del lado del servidor (Supabase), pero evitar el viaje de
// red repetido en la misma pantalla es gratis.
const cacheFeriadosPorAnio = new Map<number, Promise<FeriadoNacional[]>>();

function fetchFeriadosDeAnio(anio: number): Promise<FeriadoNacional[]> {
  let promesa = cacheFeriadosPorAnio.get(anio);
  if (!promesa) {
    promesa = fetch(`/api/feriados/${anio}`)
      .then((r) => r.json())
      .then((data) => (Array.isArray(data?.feriados) ? data.feriados : []))
      .catch(() => [] as FeriadoNacional[]);
    cacheFeriadosPorAnio.set(anio, promesa);
  }
  return promesa;
}

// Trae los feriados nacionales de los años pedidos + los inhábiles
// cargados a mano (dias_inhabiles_custom), y arma el Set que necesitan las
// funciones de lib/feriados.ts. `anios` vacío = no trae nada (útil cuando
// el componente todavía no sabe qué años necesita, ej. estado !=
// "Pendiente" en PanelSolicitudes).
export function useFeriados(anios: number[]): Feriados {
  const clave = useMemo(() => [...new Set(anios)].sort().join(","), [anios]);
  const [feriadosNacionales, setFeriadosNacionales] = useState<FeriadoNacional[]>([]);
  const [inhabilesCustom, setInhabilesCustom] = useState<DiaInhabilCustom[]>([]);
  const [cargando, setCargando] = useState(clave.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;
    const aniosPedidos = clave ? clave.split(",").map(Number) : [];

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const [porAnio, resultadoCustom] = await Promise.all([
          Promise.all(aniosPedidos.map(fetchFeriadosDeAnio)),
          supabase.from("dias_inhabiles_custom").select("fecha, motivo, tipo").order("fecha"),
        ]);
        if (cancelado) return;
        setFeriadosNacionales(porAnio.flat());
        if (resultadoCustom.error) {
          setError("No se pudieron cargar los inhábiles cargados a mano.");
        } else {
          setInhabilesCustom(resultadoCustom.data ?? []);
        }
      } catch {
        if (!cancelado) setError("No se pudieron cargar los feriados.");
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [clave, version]);

  const set = useMemo(() => {
    const s = new Set<string>();
    for (const f of feriadosNacionales) s.add(f.fecha);
    for (const d of inhabilesCustom) s.add(d.fecha);
    return s;
  }, [feriadosNacionales, inhabilesCustom]);

  const motivo = useCallback(
    (fechaISO: string): string | null => {
      const nacional = feriadosNacionales.find((f) => f.fecha === fechaISO);
      if (nacional) return nacional.nombre;
      const custom = inhabilesCustom.find((d) => d.fecha === fechaISO);
      if (custom) return custom.motivo;
      return null;
    },
    [feriadosNacionales, inhabilesCustom]
  );

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { cargando, error, feriadosNacionales, inhabilesCustom, set, motivo, recargar };
}
