import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// Feriados nacionales de Argentina para un año, usados por la calculadora
// de plazos (lib/feriados.ts, lib/useFeriados.ts, /plazos). Fuente
// primaria: la API pública y gratuita de ArgentinaDatos (sin API key, se
// actualiza sola cuando sale un decreto nuevo).
//
// Se cachea en Supabase (feriados_nacionales_cache), como máximo una
// consulta externa por día por año: si ArgentinaDatos falla, no responde a
// tiempo, o el año pedido todavía no está publicado, esta ruta sirve la
// última lista guardada en vez de romper el cálculo de plazos. Recién si
// nunca se pudo traer ese año (primera vez, sin nada guardado) devuelve
// error.
//
// No incluye feria judicial ni el 16/11 — eso son reglas propias del Poder
// Judicial de la Nación, no feriados nacionales, y las maneja aparte
// lib/feriados.ts (feria de invierno hay que actualizarla a mano cada año,
// la fija la Corte Suprema por Acordada).

const UN_DIA_MS = 24 * 60 * 60 * 1000;

interface FeriadoArgentinaDatos {
  fecha: string;
  tipo: string;
  nombre: string;
}

export interface FeriadoNacional {
  fecha: string;
  nombre: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ anio: string }> }
) {
  const { anio: anioStr } = await params;
  const anio = Number(anioStr);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    return NextResponse.json({ error: "Año inválido." }, { status: 400 });
  }

  const { data: cacheado } = await supabase
    .from("feriados_nacionales_cache")
    .select("feriados, actualizado_en")
    .eq("anio", anio)
    .maybeSingle();

  const cacheEsDeHoy =
    !!cacheado &&
    Date.now() - new Date(cacheado.actualizado_en).getTime() < UN_DIA_MS;

  if (cacheEsDeHoy) {
    return NextResponse.json({ anio, feriados: cacheado!.feriados, fuente: "cache" });
  }

  try {
    const resp = await fetch(`https://api.argentinadatos.com/v1/feriados/${anio}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error(`ArgentinaDatos respondió ${resp.status}`);
    const datos: FeriadoArgentinaDatos[] = await resp.json();
    if (!Array.isArray(datos)) throw new Error("Respuesta inesperada de ArgentinaDatos.");

    const feriados: FeriadoNacional[] = datos.map((f) => ({
      fecha: f.fecha,
      nombre: f.nombre,
    }));

    await supabase.from("feriados_nacionales_cache").upsert(
      {
        anio,
        feriados,
        fuente: "api",
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "anio" }
    );

    return NextResponse.json({ anio, feriados, fuente: "api" });
  } catch (e) {
    // Falló la consulta externa (caída, timeout, año sin publicar todavía):
    // si hay algo guardado de una corrida anterior —aunque sea de ayer o de
    // hace una semana— se sirve eso antes que dejar el cálculo sin datos.
    console.error(`No se pudieron traer los feriados de ${anio} desde ArgentinaDatos:`, e);
    if (cacheado) {
      return NextResponse.json({ anio, feriados: cacheado.feriados, fuente: "cache" });
    }
    return NextResponse.json(
      {
        error: `No se pudieron obtener los feriados de ${anio} y todavía no hay ninguno guardado.`,
      },
      { status: 502 }
    );
  }
}
