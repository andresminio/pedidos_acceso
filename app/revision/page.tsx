import PanelCandidatos from "@/components/PanelCandidatos";
import PanelTabs from "@/components/PanelTabs";

export default function Revision() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Acceso a la información pública · Registro interno
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Revisión de correo
            </h1>
          </div>
          <PanelTabs activa="revision" />
        </div>
      </header>
      <PanelCandidatos />
    </main>
  );
}
