import PanelResumen from "@/components/PanelResumen";
import PanelTabs from "@/components/PanelTabs";
import Onboarding from "@/components/Onboarding";

export default function Resumen() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                className="h-6 w-6"
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
                Estadística Electoral y Datos Abiertos
              </p>
              <h1 className="text-3xl font-semibold text-white">
                Pedidos de Acceso
              </h1>
            </div>
          </div>
          <PanelTabs activa="resumen" />
        </div>
      </header>
      <PanelResumen />
      <Onboarding />
    </main>
  );
}
