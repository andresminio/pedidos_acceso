import Link from "next/link";
import PanelSolicitudes from "@/components/PanelSolicitudes";

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Pedidos de Acceso a la Información Pública
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Registro y seguimiento de solicitudes. Los cambios se sincronizan
            automáticamente con la hoja de cálculo de control.
          </p>
        </div>
        <Link
          href="/revision"
          className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm hover:bg-slate-50"
        >
          Revisión de correo →
        </Link>
      </header>
      <PanelSolicitudes />
    </main>
  );
}
