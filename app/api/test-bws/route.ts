// RUTA DE PRUEBA TEMPORAL — borrar una vez validado que el SDK de
// Bitwarden funciona en Vercel y migrado lib/geminiServer.ts.
//
// Recupera GEMINI_API_KEY desde Bitwarden y devuelve SOLO metadatos
// (largo y los primeros 4 caracteres, que en una API key de Gemini son
// siempre "AIza"), nunca el valor. Sin protección a propósito: no expone
// nada sensible y es temporal.
//
// Uso: GET https://<tu-app>.vercel.app/api/test-bws

import { NextResponse } from "next/server";
import { obtenerSecreto } from "@/lib/bitwardenServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const inicio = Date.now();
  try {
    const key = await obtenerSecreto("GEMINI_API_KEY");
    return NextResponse.json({
      ok: true,
      largo: key.length,
      prefijo: key.slice(0, 4),
      formatoEsperado: key.startsWith("AIza") && key.length === 39,
      ms: Date.now() - inicio,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        ms: Date.now() - inicio,
      },
      { status: 500 }
    );
  }
}
