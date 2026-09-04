import { NextRequest, NextResponse } from "next/server";
import { generarConGemini } from "@/lib/geminiServer";

export const runtime = "nodejs";

// Prompt genérico por ahora — la idea es afinarlo con contexto real de la
// oficina (tono, formato de oficio, aclaraciones legales, etc.) más
// adelante. Esto es la plomería: endpoint + botón funcionando de punta a
// punta con un resultado razonable mientras tanto.
const PROMPT = `Sos un asistente de una oficina pública (Cámara Nacional Electoral) \
que ayuda a redactar un borrador de respuesta a un pedido de acceso a la \
información pública, a partir del mail original que lo generó y de cómo \
quedó cargado el pedido en el sistema de registro.

Devolvé ÚNICAMENTE el texto del borrador de respuesta — sin comillas, sin \
JSON, sin explicaciones ni introducciones. Es un borrador para que un \
agente de la oficina lo revise y complete antes de enviarlo, así que:

- Escribilo en tono formal pero claro, como una respuesta institucional.
- Dirigite a {nombre_solicitante} si el nombre está disponible.
- Hacé referencia concreta a lo que se pidió (usá "{solicitud}" como base).
- Si hace falta información que todavía no tenemos (archivos adjuntos, \
datos específicos, plazos), dejá un placeholder claro entre corchetes, \
por ejemplo "[adjuntar archivo con XYZ]" — no inventes datos que no están \
en el pedido ni en el mail.
- No hace falta firma ni membrete, solo el cuerpo de la respuesta.

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
  } = body ?? {};

  if (!solicitud || !cuerpo_mail) {
    return NextResponse.json(
      { error: "Falta la solicitud o el cuerpo del mail original." },
      { status: 400 }
    );
  }

  const prompt = PROMPT.replace(/\{nombre_solicitante\}/g, nombre_solicitante || "el/la solicitante")
    .replace(/\{solicitud\}/g, String(solicitud).slice(0, 2000))
    .replace(/\{categoria\}/g, categoria || "sin categoría")
    .replace(/\{estado\}/g, estado || "Pendiente")
    .replace(/\{remitente\}/g, remitente || "desconocido")
    .replace(/\{asunto\}/g, asunto || "(sin asunto)")
    .replace(/\{cuerpo_mail\}/g, String(cuerpo_mail).slice(0, 6000));

  const resultado = await generarConGemini(prompt);

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }
  return NextResponse.json({ borrador: resultado.texto });
}
