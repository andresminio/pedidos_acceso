import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { HEADERS, SolicitudRecord, toRow, getSheetsClient } from "@/lib/sheetsServer";

export const runtime = "nodejs";
export const maxDuration = 60;

// Reescribe la hoja entera de una sola vez a partir de Supabase (una
// lectura + una escritura), en vez de una llamada por fila como hace el
// webhook normal (/api/sync-sheets). Pensado para:
//   - arrancar la hoja desde cero,
//   - recuperarse de una carga masiva por SQL que saturó la cuota de
//     lecturas de Sheets (el trigger dispara un webhook por fila insertada).
//
// Se llama a mano (no hay trigger que la dispare sola). Acepta el secret
// por header (igual que /api/sync-sheets) o por query param `?secret=...`
// para poder pegarla directo en el navegador.
export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("x-webhook-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.SYNC_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tab = process.env.GOOGLE_SHEET_TAB || "Pedidos";
  if (!spreadsheetId) {
    return NextResponse.json({ error: "GOOGLE_SHEET_ID no configurado" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("pedidos_solicitudes")
    .select(
      "id, anio, cuatrimestre, fecha, nombre_solicitante, solicitud, categoria, subcategoria, nombre_archivo, estado, subestado, fecha_respuesta, observaciones"
    )
    .order("fecha", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const registros = (data ?? []) as SolicitudRecord[];
  const filas = registros.map(toRow);

  try {
    const sheets = getSheetsClient();

    // Limpia todo el contenido de datos (deja los encabezados) antes de
    // reescribir, para no dejar filas viejas colgadas si algún id ya no
    // existe más en Supabase.
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${tab}!A2:M`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS, ...filas] },
    });

    await supabase
      .from("sheet_sync_state")
      .update({ ultima_sincronizacion_en: new Date().toISOString() })
      .eq("id", 1);

    return NextResponse.json({ ok: true, filas: filas.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
