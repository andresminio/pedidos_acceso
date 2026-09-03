import PanelSolicitudes from "@/components/PanelSolicitudes";
import PanelTabs from "@/components/PanelTabs";
import SyncStatus from "@/components/SyncStatus";

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                className="h-5 w-5"
              >
                <path
                  d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M14 3.5v4h4" strokeLinecap="round" strokeLinejoin="round" />
                <path
                  d="M9 13h6M9 16h6M9 10h2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="text-sm text-slate-400">
                Unidad de Estadística Electoral y Datos Abiertos
              </p>
              <h1 className="text-2xl font-semibold text-white">
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
