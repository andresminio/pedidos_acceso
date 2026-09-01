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
