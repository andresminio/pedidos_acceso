// Helper server-side para leer secretos desde Bitwarden Secrets Manager
// (proyecto "marybot"), mismo criterio que mail-bot/secrets_loader.py:
// la única credencial que vive en Vercel es BWS_ACCESS_TOKEN; el resto se
// trae de Bitwarden en tiempo de ejecución.
//
// El login y cada secreto se cachean a nivel módulo: mientras la función
// de Vercel siga "caliente" no se vuelve a llamar a Bitwarden. En un
// arranque en frío se hace login una vez y se traen los secretos que se
// pidan.

import { BitwardenClient } from "@bitwarden/sdk-napi";

// IDs de los secretos en Bitwarden — los mismos que SECRET_IDS en
// mail-bot/secrets_loader.py. No son secretos en sí (sin el token no
// sirven para nada).
export const SECRET_IDS = {
  GEMINI_API_KEY: "23219b64-280a-4578-92f9-b4c6011d6afe",
} as const;

type NombreSecreto = keyof typeof SECRET_IDS;

let clientePromise: Promise<BitwardenClient> | null = null;
const cache = new Map<NombreSecreto, string>();

function cliente(): Promise<BitwardenClient> {
  if (!clientePromise) {
    clientePromise = (async () => {
      const token = process.env.BWS_ACCESS_TOKEN;
      if (!token) throw new Error("BWS_ACCESS_TOKEN no configurado en el servidor.");
      const client = new BitwardenClient();
      await client.auth().loginAccessToken(token);
      return client;
    })().catch((err) => {
      // Si el login falla, no dejamos la promesa rota cacheada: el próximo
      // request vuelve a intentar.
      clientePromise = null;
      throw err;
    });
  }
  return clientePromise;
}

export async function obtenerSecreto(nombre: NombreSecreto): Promise<string> {
  const enCache = cache.get(nombre);
  if (enCache) return enCache;

  const client = await cliente();
  const secreto = await client.secrets().get(SECRET_IDS[nombre]);
  const valor = secreto.value.trim();
  if (!valor) throw new Error(`El secreto ${nombre} está vacío en Bitwarden.`);

  cache.set(nombre, valor);
  return valor;
}
