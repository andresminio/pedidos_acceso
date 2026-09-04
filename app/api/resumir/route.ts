import { NextRequest, NextResponse } from "next/server";
import { generarConGemini } from "@/lib/geminiServer";

export const runtime = "nodejs";

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
  const body = await req.json().catch(() => null);
  const texto: string | undefined = body?.texto;
  if (!texto || !texto.trim()) {
    return NextResponse.json({ error: "Falta el texto a resumir." }, { status: 400 });
  }

  const prompt = PROMPT.replace("{texto}", texto.trim().slice(0, 8000));
  const resultado = await generarConGemini(prompt);

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }
  return NextResponse.json({ resumen: resultado.texto });
}
