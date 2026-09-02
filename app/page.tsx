import PanelSolicitudes from "@/components/PanelSolicitudes";
import PanelTabs from "@/components/PanelTabs";
import SyncStatus from "@/components/SyncStatus";

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                className="h-5 w-5"
              >
                <path
                  d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 12l2 2 4-4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Acceso a la información pública · Registro interno
              </p>
              <h1 className="text-2xl font-semibold text-slate-900">
                Pedidos de Acceso
              </h1>
            </div>
          </div>
          <PanelTabs activa="registro" />
        </div>
      </header>
      <div className="mb-3 flex justify-end">
        <SyncStatus />
      </div>
      <PanelSolicitudes />
    </main>
  );
}
