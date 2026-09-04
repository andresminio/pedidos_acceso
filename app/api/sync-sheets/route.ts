import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { supabase } from "@/lib/supabase";
import {
  HEADERS,
  SolicitudRecord,
  toRow,
  getSheetsClient,
  getSheetId,
} from "@/lib/sheetsServer";

export const runtime = "nodejs";

// Inserta encabezados si la hoja está vacía.
async function ensureHeaders(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tab: string
) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A1:A1`,
  });
  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  }
}

// Busca la fila (1-indexed, incluye encabezado) donde columna A === id.
async function findRowIndexById(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tab: string,
  id: string
): Promise<number | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:A`,
  });
  const values = res.data.values ?? [];
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) return i + 1; // 1-indexed
  }
  return null;
}

// Marca "ahora" como la última sincronización exitosa con la hoja. A
// diferencia de la vieja columna synced_at (por fila), esto no depende de
// que exista una fila puntual — sirve igual para create, update y delete.
async function marcarSincronizado() {
  const { error } = await supabase
    .from("sheet_sync_state")
    .update({ ultima_sincronizacion_en: new Date().toISOString() })
    .eq("id", 1);
  if (error) {
    // La hoja ya se actualizó bien; esto solo afecta el indicador visual
    // de "al día", no es motivo para reportar la sync como fallida.
    console.error("No se pudo marcar sheet_sync_state:", error.message);
  }
}

// Inserta una fila nueva justo debajo del encabezado (fila 2), no al
// final. La hoja se mantiene ordenada de más reciente a más antiguo (ver
// /api/resync-sheets), así que un pedido recién creado tiene que entrar
// arriba de todo — `values.append` en cambio siempre agrega al final de
// los datos existentes, sin noción de orden.
async function insertRowAtTop(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tab: string,
  row: string[]
) {
  const sheetId = await getSheetId(sheets, spreadsheetId, tab);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: 1, // 0-indexed: fila 2 (1-indexed), debajo del encabezado
              endIndex: 2,
            },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A2:M2`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

// Borra la fila entera (no solo su contenido), corriendo las de abajo
// para arriba — igual que borrar una fila a mano en Sheets.
async function deleteRow(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tab: string,
  rowIndex1Indexed: number
) {
  const sheetId = await getSheetId(sheets, spreadsheetId, tab);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex1Indexed - 1,
              endIndex: rowIndex1Indexed,
            },
          },
        },
      ],
    },
  });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.SYNC_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tab = process.env.GOOGLE_SHEET_TAB || "Pedidos";
  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "GOOGLE_SHEET_ID no configurado" },
      { status: 500 }
    );
  }

  // Payload esperado: el "record" que manda el Database Webhook de Supabase
  // en INSERT/UPDATE (formato estándar: { type, table, record, old_record }).
  const body = await req.json();
  const record: SolicitudRecord | undefined = body.record;
  if (!record?.id) {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  try {
    const sheets = getSheetsClient();
    await ensureHeaders(sheets, spreadsheetId, tab);

    if (body.type === "DELETE") {
      const rowIndex = await findRowIndexById(sheets, spreadsheetId, tab, record.id);
      if (rowIndex) {
        await deleteRow(sheets, spreadsheetId, tab, rowIndex);
      }
      await marcarSincronizado();
      return NextResponse.json({ ok: true, id: record.id, deleted: !!rowIndex });
    }

    const rowIndex = await findRowIndexById(sheets, spreadsheetId, tab, record.id);
    const row = toRow(record);

    if (rowIndex) {
      // Update idempotente: misma fila, se sobreescribe.
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!A${rowIndex}:M${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });
    } else {
      // Primera vez que se ve este id: entra arriba de todo (fila 2).
      await insertRowAtTop(sheets, spreadsheetId, tab, row);
    }

    await marcarSincronizado();

    return NextResponse.json({ ok: true, id: record.id, updated: !!rowIndex });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
