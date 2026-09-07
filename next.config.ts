import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// Genera lib/version.json con un buildId único en cada build de
// producción (no en dev ni al arrancar `next start`, para no disparar
// falsos positivos de "nueva versión" con un simple restart sin deploy).
// Lo consume app/api/version/route.ts, que el cliente
// (components/VersionBanner.tsx) chequea periódicamente para ofrecer
// recargar cuando detecta un buildId distinto al que cargó al inicio.
export default async function nextConfig(phase: string): Promise<NextConfig> {
  if (phase === PHASE_PRODUCTION_BUILD) {
    try {
      const buildId = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());
      fs.writeFileSync(
        path.join(process.cwd(), "lib", "version.json"),
        JSON.stringify({ buildId })
      );
    } catch {
      // No debería romper el build si por algún motivo no se puede escribir.
    }
  }

  return {
    reactStrictMode: true,
  };
}
