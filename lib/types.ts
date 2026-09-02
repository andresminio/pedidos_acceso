export type Estado = "Pendiente" | "Cerrado";

export const ESTADOS: Estado[] = ["Pendiente", "Cerrado"];

export type SubestadoCerrado = "Completo" | "Parcial" | "Rechazado";

export const SUBESTADOS_CERRADO: SubestadoCerrado[] = [
  "Completo",
  "Parcial",
  "Rechazado",
];

// Lista de temas (categoría) de la oficina. Se puede sumar uno nuevo desde
// el propio formulario de carga ("+ Agregar nuevo tema").
export const TEMAS: string[] = [
  "Resultados electorales",
  "Padrón electoral",
  "Agrupaciones políticas",
  "Voto Joven",
  "Participación y ausentismo electoral",
  "Información general",
  "Candidaturas",
  "Electores Residentes en el exterior",
  "Geografía Electoral",
  "Jurisprudencia",
  "Datos Históricos",
  "Ciudadanía",
  "Boletas de votación",
  "Electores Privados de Libertad",
  "Accesibilidad Electoral",
  "Extranjeros",
  "Autoridades de mesa",
  "Normas electorales",
  "Acompañamiento Cívico",
  "Biometría",
  "Contrataciones CNE",
  "Manejo y seguridad de datos informáticos",
  "Reclamos y Denuncias",
  "Redes sociales",
  "Registro de Empresas de Encuestas y Sondeos de Opinión",
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

// Candidatos detectados por el bot de correo (mail-bot/), pendientes de
// revisión manual antes de convertirse en un pedido real.
export type EstadoRevision =
  | "pendiente"
  | "aprobado"
  | "descartado"
  | "ya_cargado";

export interface CandidatoCorreo {
  id: string;
  email_uid: string;
  fecha_correo: string; // timestamptz ISO
  remitente: string;
  asunto: string | null;
  cuerpo_resumen: string | null;
  es_pedido_acceso: boolean;
  urgencia: string | null;
  confianza_ia: string | null;
  nombre_solicitante: string | null;
  fecha_propuesta: string | null; // date ISO
  solicitud_propuesta: string | null;
  categoria_propuesta: string | null;
  subcategoria_propuesta: string | null;
  estado_revision: EstadoRevision;
  pedido_id: string | null;
  revisado_en: string | null;
  procesado_en: string;
  created_at: string;
}
