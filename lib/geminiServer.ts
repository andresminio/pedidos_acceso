// Helper server-side compartido para llamar a la API REST de Gemini con
// fallback de modelos: si un modelo devuelve 503 (saturado) o 429 (límite
// de cuota), se prueba una vez con el siguiente antes de darse por vencido.
// Mismo criterio que mail-bot/classify.py (MODELOS_FALLBACK), pero acá con
// un solo intento por modelo — son endpoints que el usuario espera en
// pantalla (botón "Reescribir/Generar con IA"), no un proceso de fondo.

const MODELOS_FALLBACK = ["gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-2.5-flash"];

function modelosAIntentar(): string[] {
  // Si se fija GEMINI_MODEL a mano en Vercel, se respeta como único modelo,
  // sin rotar a otros — se asume una elección intencional.
  const override = process.env.GEMINI_MODEL;
  return override ? [override] : MODELOS_FALLBACK;
}

// Códigos por los que vale la pena probar otro modelo (saturación/cuota).
// Cualquier otro error (400, 403, etc.) no es cuestión de modelo — se
// devuelve tal cual, sin rotar.
const CODIGOS_REINTENTABLES = new Set([429, 500, 503]);

export async function generarConGemini(
  prompt: string
): Promise<{ texto: string } | { error: string; status: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "GEMINI_API_KEY no configurado en el servidor.", status: 500 };
  }

  const modelos = modelosAIntentar();
  let ultimoError: { error: string; status: number } | null = null;

  for (let i = 0; i < modelos.length; i++) {
    const model = modelos[i];
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        ultimoError = {
          error: `Gemini (${model}) respondió ${res.status}: ${errText}`,
          status: 502,
        };
        if (CODIGOS_REINTENTABLES.has(res.status) && i < modelos.length - 1) {
          continue; // rota al siguiente modelo
        }
        return ultimoError;
      }

      const data = await res.json();
      const texto: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!texto) {
        ultimoError = { error: `Gemini (${model}) no devolvió texto.`, status: 502 };
        if (i < modelos.length - 1) continue;
        return ultimoError;
      }

      return { texto: texto.trim() };
    } catch (err) {
      const message = err instanceof Error ? err.message : "error desconocido";
      ultimoError = { error: message, status: 500 };
      if (i < modelos.length - 1) continue;
      return ultimoError;
    }
  }

  return ultimoError ?? { error: "No se pudo generar contenido con Gemini.", status: 502 };
}
