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
  "Accesibilidad Electoral",
  "Acompañamiento Cívico",
  "Agrupaciones Políticas",
  "Autoridades de Mesa",
  "Biometría",
  "Boletas de Votación",
  "Candidaturas",
  "Ciudadanía",
  "Contrataciones CNE",
  "Datos Históricos",
  "Electores Privados de Libertad",
  "Electores Residentes en el Exterior",
  "Extranjeros",
  "Geografía Electoral",
  "Información General",
  "Jurisprudencia",
  "Manejo y Seguridad de Datos Informáticos",
  "Normas Electorales",
  "Padrón Electoral",
  "Participación y Ausentismo Electoral",
  "Reclamos y Denuncias",
  "Redes Sociales",
  "Registro de Empresas de Encuestas y Sondeos de Opinión",
  "Resultados Electorales",
  "Voto Joven",
];

// Subcategorías de referencia por categoría — se usan para guiar al
// clasificador de Gemini (mail-bot/classify.py), no como restricción en la
// UI: el campo Subcategoría sigue siendo texto libre en el panel. Una
// categoría sin entrada acá (o con lista vacía) no tiene subcategorías
// típicas definidas todavía.
export const SUBCATEGORIAS: Record<string, string[]> = {
  "Agrupaciones Políticas": [
    "Afiliados",
    "Financiamiento",
    "Agrupaciones políticas y alianzas",
    "Documentación",
    "Candidaturas",
    "Plataformas electorales",
  ],
  Candidaturas: [
    "Elecciones nacionales",
    "Elecciones provinciales",
    "Elecciones municipales",
    "Candidatos",
  ],
  "Datos Históricos": ["Padrones"],
  "Electores Privados de Libertad": [
    "Participación",
    "Información",
    "Composición y/o participación",
  ],
  "Electores Residentes en el Exterior": [
    "Composición",
    "Participación",
    "Composición y/o participación",
  ],
  "Información General": [
    "Elecciones",
    "Elecciones provinciales",
    "Elecciones municipales",
    "CNE",
    "Accesibilidad electoral",
  ],
  Jurisprudencia: ["Secretaría Penal"],
  "Normas Electorales": ["Obligatoriedad del voto"],
  "Padrón Electoral": [
    "Composición",
    "Datos personales",
    "Establecimientos de votación",
    "Padrón electoral histórico",
    "Establecimientos",
  ],
  "Participación y Ausentismo Electoral": ["Participación"],
  "Redes Sociales": ["Auditorías - Control de información"],
  "Resultados Electorales": [
    "Elecciones provinciales",
    "Elecciones nacionales",
    "Elecciones nacionales, provinciales y municipales",
    "Elecciones municipales",
    "Electores residentes en el exterior",
    "Elecciones nacionales y provinciales",
    "Electores privados de libertad",
    "Resultados elecciones provinciales",
    "Elecciones",
    "Resultados",
  ],
  "Voto Joven": ["Participación"],
};

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

// Señal para el botón "Revisar correo ahora" — la levanta el watcher
// que corre en una PC dentro de la red interna (mail-bot/watcher.py).
export type EstadoTrigger = "pendiente" | "procesando" | "completado" | "error";

export interface RevisionTrigger {
  id: string;
  solicitado_en: string;
  estado: EstadoTrigger;
  mensaje: string | null;
  completado_en: string | null;
}
