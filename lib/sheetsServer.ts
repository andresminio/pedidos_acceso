// Helpers server-side compartidos por las rutas que hablan con Google
// Sheets (/api/sync-sheets, /api/resync-sheets) — antes duplicados.
import { google } from "googleapis";

// Columnas en el mismo orden que se escriben en la hoja.
// La columna A es el id (uuid) — clave usada para el upsert idempotente.
export const HEADERS = [
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

export interface SolicitudRecord {
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

export function toRow(r: SolicitudRecord): string[] {
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

export function getSheetsClient() {
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

// sheetId (gid) numérico de la pestaña, necesario para batchUpdate.
export async function getSheetId(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tab: string
): Promise<number> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const encontrada = meta.data.sheets?.find((s) => s.properties?.title === tab);
  if (!encontrada || encontrada.properties?.sheetId == null) {
    throw new Error(`No se encontró la pestaña "${tab}" en la hoja.`);
  }
  return encontrada.properties.sheetId;
}
