import PanelSolicitudes from "@/components/PanelSolicitudes";

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Pedidos de Acceso a la Información Pública
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Registro y seguimiento de solicitudes. Los cambios se sincronizan
          automáticamente con la hoja de cálculo de control.
        </p>
      </header>
      <PanelSolicitudes />
    </main>
  );
}
