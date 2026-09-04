import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { generarConGemini } from "@/lib/geminiServer";
import { fechaCorta } from "@/lib/fechas";

export const runtime = "nodejs";

const CONTEXTO_PATH = path.join(process.cwd(), "docs", "contexto_respuestas_ia.md");

// Se lee en cada request (no se cachea a nivel módulo) — mismo criterio que
// mail-bot/classify.py con contexto_clasificacion.md: es un archivo editable
// a mano, pensado para ir ajustándose sin tocar ni redeployar código.
function leerContexto(): string {
  try {
    const texto = fs.readFileSync(CONTEXTO_PATH, "utf-8").trim();
    return texto || "(sin contexto adicional definido todavía)";
  } catch {
    return "(no se pudo leer docs/contexto_respuestas_ia.md)";
  }
}

function apellidoDe(nombreSolicitante: string | undefined | null): string {
  if (!nombreSolicitante) return "[APELLIDO]";
  const partes = nombreSolicitante.trim().split(/\s+/);
  return partes[partes.length - 1].toUpperCase();
}

const PROMPT = `Sos un asistente de una oficina pública (Cámara Nacional Electoral) \
que ayuda a redactar un borrador de respuesta a un pedido de acceso a la \
información pública, a partir del mail original que lo generó y de cómo \
quedó cargado el pedido en el sistema de registro.

Devolvé ÚNICAMENTE el texto del borrador — sin comillas, sin JSON, sin \
explicaciones ni introducciones. Es un borrador para que un agente de la \
oficina lo revise y complete antes de enviarlo.

El borrador tiene que tener EXACTAMENTE estas tres partes juntas, en este \
orden (no omitas ninguna ni agregues texto antes o después):

1. Una línea "Asunto: ..." con el asunto original del mail seguido de \
" – " y el apellido del solicitante en MAYÚSCULA (ej. "Resultados 2025 – \
BAEZ"). Si el asunto original es muy genérico (ej. "Pedido de \
información"), reemplazalo por una categoría breve que describa el pedido.
2. El siguiente bloque fijo, cambiando solo APELLIDO y la fecha (que ya \
vienen resueltos abajo, usalos tal cual te los paso, no los recalcules):
   Buenos días Nora,
   Te enviamos una propuesta para responder al pedido de {apellido_solicitante} del {fecha_ingreso}
   Quedamos atentos a tus comentarios
   Saludos
   UEEDA
3. El cuerpo de la respuesta dirigido al solicitante: empieza con \
"Estimado/Estimada NOMBRE COMPLETO:", tono institucional formal pero \
claro y directo (no repetir "en relación a su pedido" más de una vez), y \
cierra siempre con estas dos líneas fijas:
   Quedamos a disposición ante cualquier consulta o inquietud.
   Saludos cordiales,
   Unidad de Estadística Electoral y Datos Abiertos
   Cámara Nacional Electoral

Para el cuerpo (parte 3), seguí el tono, la estructura y — muy importante — \
el criterio de qué fuente citar del siguiente material de referencia \
(ejemplos ya enviados, tablas de recursos del repositorio Drive, tablas del \
sitio público de la CNE, y el criterio de prioridad entre sitio público y \
Drive de la sección 6):

--- INICIO MATERIAL DE REFERENCIA ---
{contexto}
--- FIN MATERIAL DE REFERENCIA ---

Reglas duras sobre links y datos:
- Nunca inventes una URL ni adaptes una existente. Usá únicamente links que \
figuren tal cual en el material de referencia de arriba.
- Si el pedido requiere un recurso que no aparece en ese material, dejá un \
placeholder entre corchetes en su lugar (ej. "[link con los datos de XYZ]"), \
igual que en los ejemplos del material de referencia.
- No inventes datos, cifras, ni citas normativas que no estén en el mail, \
en el pedido cargado, o en el material de referencia.

Mail original:
De: {remitente}
Asunto: {asunto}
Cuerpo:
{cuerpo_mail}

Pedido tal como quedó cargado:
Solicitante: {nombre_solicitante}
Solicitud: {solicitud}
Categoría: {categoria}
Estado: {estado}

Datos ya resueltos para usar tal cual en el bloque a Nora:
Apellido del solicitante: {apellido_solicitante}
Fecha de ingreso del pedido: {fecha_ingreso}
`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const {
    solicitud,
    nombre_solicitante,
    categoria,
    estado,
    cuerpo_mail,
    asunto,
    remitente,
    fecha,
  } = body ?? {};

  if (!solicitud || !cuerpo_mail) {
    return NextResponse.json(
      { error: "Falta la solicitud o el cuerpo del mail original." },
      { status: 400 }
    );
  }

  const fechaIngreso = fecha ? fechaCorta(fecha) : "[DD/MM/AAAA]";

  const prompt = PROMPT.replace(/\{nombre_solicitante\}/g, nombre_solicitante || "el/la solicitante")
    .replace(/\{solicitud\}/g, String(solicitud).slice(0, 2000))
    .replace(/\{categoria\}/g, categoria || "sin categoría")
    .replace(/\{estado\}/g, estado || "Pendiente")
    .replace(/\{remitente\}/g, remitente || "desconocido")
    .replace(/\{asunto\}/g, asunto || "(sin asunto)")
    .replace(/\{cuerpo_mail\}/g, String(cuerpo_mail).slice(0, 6000))
    .replace(/\{apellido_solicitante\}/g, apellidoDe(nombre_solicitante))
    .replace(/\{fecha_ingreso\}/g, fechaIngreso)
    .replace(/\{contexto\}/g, leerContexto());

  const resultado = await generarConGemini(prompt);

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }
  return NextResponse.json({ borrador: resultado.texto });
}
