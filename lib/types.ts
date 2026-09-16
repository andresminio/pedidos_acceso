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
    "Nacionales",
    "Provinciales y Municipales",
    "Electores privados de libertad",
    "Electores residentes en el exterior",
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
  respuesta_ia_borrador: string | null;
  respuesta_texto: string | null;
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
  // Destinatario ("To" del correo) — solo disponible para correos leídos
  // después de sumar esta columna; antes queda en null.
  destinatario: string | null;
  asunto: string | null;
  cuerpo_resumen: string | null;
  // HTML original del correo (si el bot lo pudo capturar) — se sanea con
  // dompurify antes de renderizarlo, ver components/CorreoBody.tsx. Los
  // correos procesados antes de sumar esta columna quedan en null y se
  // muestran con cuerpo_resumen (texto plano) como siempre.
  cuerpo_html: string | null;
  // Versión editada a mano de qué mostrar como cuerpo (ver "Editar
  // mensaje" en CorreoBody) — cuando está presente, pisa el corte
  // automático de la cadena reenviada. El correo original nunca se toca.
  cuerpo_editado: string | null;
  es_pedido_acceso: boolean;
  es_respuesta_pedido: boolean;
  // Sugerencia de la IA sobre qué tipo de evento es este correo dentro del
  // intercambio ("Respuesta de Nora", "Repregunta del solicitante", etc.).
  // Editable a mano al vincular — ver FilaRespuesta en PanelCandidatos.
  etiqueta_evento: string | null;
  urgencia: string | null;
  confianza_ia: string | null;
  nombre_solicitante: string | null;
  fecha_propuesta: string | null; // date ISO
  solicitud_propuesta: string | null;
  categoria_propuesta: string | null;
  subcategoria_propuesta: string | null;
  // Nota que propone la IA para el campo "Observaciones" del pedido al
  // cargarlo — hoy solo se usa para marcar "Reenviado por Consejo
  // Abierto" cuando corresponde (ver mail-bot/classify.py).
  observaciones_propuesta: string | null;
  estado_revision: EstadoRevision;
  pedido_id: string | null;
  revisado_en: string | null;
  procesado_en: string;
  created_at: string;
}

// Un punto en la línea de tiempo de un pedido: recepción, reenvío,
// respuesta de Nora, repregunta del solicitante, etc. El punto de
// "Recepción" en sí no vive acá — se arma directo desde
// pedidos_solicitudes (fecha + solicitud); esta tabla solo guarda los
// eventos posteriores, vinculados desde "Respuestas para vincular".
export interface PedidoEvento {
  id: string;
  pedido_id: string;
  fecha: string; // date ISO (yyyy-mm-dd)
  etiqueta: string;
  cuerpo: string | null;
  cuerpo_html: string | null;
  // Versión editada a mano del cuerpo a mostrar — ver cuerpo_editado en
  // CandidatoCorreo, mismo criterio.
  cuerpo_editado: string | null;
  // Copiados del correo original al vincular (candidatos_correo) para que
  // la línea de tiempo pueda mostrar De/Para/Asunto sin tener que ir a
  // buscar esa fila (que además puede no seguir apuntando a este evento
  // si el correo se descarta/reasigna después). Quedan en null para
  // eventos que no vienen de un correo (ej. el borrador de IA).
  remitente: string | null;
  destinatario: string | null;
  asunto: string | null;
  candidato_correo_id: string | null;
  creado_en: string;
}
