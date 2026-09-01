export type Estado = "Pendiente" | "En trámite" | "Respondido" | "Cerrado";

export const ESTADOS: Estado[] = [
  "Pendiente",
  "En trámite",
  "Respondido",
  "Cerrado",
];

export interface Solicitud {
  id: string;
  anio: number;
  cuatrimestre: 1 | 2 | 3;
  fecha: string; // ISO date (yyyy-mm-dd)
  nombre_solicitante: string;
  solicitud: string;
  categoria: string | null;
  subcategoria: string | null;
  nombre_archivo: string | null;
  estado: string;
  subestado: string | null;
  fecha_respuesta: string | null;
  observaciones: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SolicitudInput = Omit<
  Solicitud,
  "id" | "synced_at" | "created_at" | "updated_at"
>;
