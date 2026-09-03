import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_MODEL = "gemini-flash-latest";

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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY no configurado en el servidor." },
      { status: 500 }
    );
  }

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

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const prompt = PROMPT.replace(/\{nombre_solicitante\}/g, nombre_solicitante || "el/la solicitante")
    .replace(/\{solicitud\}/g, String(solicitud).slice(0, 2000))
    .replace(/\{categoria\}/g, categoria || "sin categoría")
    .replace(/\{estado\}/g, estado || "Pendiente")
    .replace(/\{remitente\}/g, remitente || "desconocido")
    .replace(/\{asunto\}/g, asunto || "(sin asunto)")
    .replace(/\{cuerpo_mail\}/g, String(cuerpo_mail).slice(0, 6000));

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Gemini respondió ${res.status}: ${errText}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const borrador: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!borrador) {
      return NextResponse.json(
        { error: "Gemini no devolvió texto." },
        { status: 502 }
      );
    }

    return NextResponse.json({ borrador: borrador.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
