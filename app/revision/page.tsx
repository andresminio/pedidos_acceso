import Link from "next/link";
import PanelCandidatos from "@/components/PanelCandidatos";

export default function Revision() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← Volver al panel de pedidos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Revisión de candidatos (correo)
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Pedidos de acceso detectados automáticamente en el correo
          institucional que todavía no fueron cargados.
        </p>
      </header>
      <PanelCandidatos />
    </main>
  );
}
