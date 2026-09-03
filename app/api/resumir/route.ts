import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_MODEL = "gemini-flash-latest";

// Mismo criterio de estilo que mail-bot/classify.py para "solicitud_propuesta":
// directo al grano, sin frases de relleno tipo "Se solicita información sobre".
const PROMPT = `Sos un asistente de una oficina pública (Cámara Nacional Electoral) \
que ayuda a redactar en limpio el resumen de un pedido de acceso a la \
información pública, a partir del texto original (mail, nota, oficio, etc.) \
que te pasan.

Devolvé ÚNICAMENTE el texto del resumen — sin comillas, sin JSON, sin \
explicaciones ni introducciones.

Reglas:
- Andá directo al grano, sin frases de relleno. NUNCA arranques con "Se \
solicita información sobre", "El remitente pide", "Solicita acceso a" ni \
nada equivalente — esa parte ya se sabe, no hace falta repetirla. Empezá \
directo por el objeto concreto del pedido.
- Si son varios puntos, listalos separados por comas o "y", igual de directo.
- Breve: como máximo 2-3 oraciones.

Texto original:
{texto}
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
  const texto: string | undefined = body?.texto;
  if (!texto || !texto.trim()) {
    return NextResponse.json({ error: "Falta el texto a resumir." }, { status: 400 });
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const prompt = PROMPT.replace("{texto}", texto.trim().slice(0, 8000));

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
    const resumen: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resumen) {
      return NextResponse.json(
        { error: "Gemini no devolvió texto." },
        { status: 502 }
      );
    }

    return NextResponse.json({ resumen: resumen.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
