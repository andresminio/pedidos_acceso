// RUTA DE PRUEBA TEMPORAL — borrar una vez validado que el SDK de
// Bitwarden funciona en Vercel y migrado lib/geminiServer.ts.
//
// Recupera GEMINI_API_KEY desde Bitwarden y devuelve SOLO metadatos
// (largo y los primeros 4 caracteres, que en una API key de Gemini son
// siempre "AIza"), nunca el valor. Protegida con SYNC_WEBHOOK_SECRET,
// mismo criterio que /api/resync-sheets.
//
// Uso: GET https://<tu-app>.vercel.app/api/test-bws?secret=<SYNC_WEBHOOK_SECRET>

import { NextRequest, NextResponse } from "next/server";
import { obtenerSecreto } from "@/lib/bitwardenServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("x-webhook-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.SYNC_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

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
