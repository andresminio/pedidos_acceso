import Link from "next/link";
import PanelPlazos from "@/components/PanelPlazos";

export default function Plazos() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-[var(--border)] pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">Estadística Electoral y Datos Abiertos</p>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              Calculadora de plazos
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md border border-[var(--border-2)] px-3 py-1.5 text-sm font-medium text-[var(--muted-2)] hover:bg-[var(--surface-2)]"
          >
            ← Volver
          </Link>
        </div>
      </header>
      <PanelPlazos />
    </main>
  );
}
