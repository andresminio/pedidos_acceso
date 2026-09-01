import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";

// Columnas en el mismo orden que se escriben en la hoja.
// La columna A es el id (uuid) — clave usada para el upsert idempotente.
const HEADERS = [
  "id",
  "Año",
  "Cuatrimestre",
  "Fecha",
  "Nombre del solicitante",
  "Solicitud",
  "Categoría",
  "Subcategoria",
  "Nombre del archivo/ Respuesta",
  "Estado",
  "Sub-estado",
  "F. respuesta",
  "Observaciones",
];

interface SolicitudRecord {
  id: string;
  anio: number;
  cuatrimestre: number;
  fecha: string;
  nombre_solicitante: string;
  solicitud: string;
  categoria: string | null;
  subcategoria: string | null;
  nombre_archivo: string | null;
  estado: string;
  subestado: string | null;
  fecha_respuesta: string | null;
  observaciones: string | null;
}

function toRow(r: SolicitudRecord): string[] {
  return [
    r.id,
    String(r.anio ?? ""),
    String(r.cuatrimestre ?? ""),
    r.fecha ?? "",
    r.nombre_solicitante ?? "",
    r.solicitud ?? "",
    r.categoria ?? "",
    r.subcategoria ?? "",
    r.nombre_archivo ?? "",
    r.estado ?? "",
    r.subestado ?? "",
    r.fecha_respuesta ?? "",
    r.observaciones ?? "",
  ];
}

function getSheetsClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Faltan credenciales OAuth de Google (GOOGLE_OAUTH_CLIENT_ID / " +
        "GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN)."
    );
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.sheets({ version: "v4", auth });
}

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
      // Append: primera vez que se ve este id.
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${tab}!A:M`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
    }

    return NextResponse.json({ ok: true, id: record.id, updated: !!rowIndex });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
