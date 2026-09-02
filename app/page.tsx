import Link from "next/link";
import PanelSolicitudes from "@/components/PanelSolicitudes";

// Misma hoja que apunta GOOGLE_SHEET_ID (ver .env / README) — si algún
// día cambian de hoja de cálculo, actualizar acá también.
const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vAujFNfWhVsPYkTdxJs6qpKN5x9mUy1BS12Ng7-Hgxc/edit?gid=0#gid=0";

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
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
          <Link
            href="/revision"
            className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm hover:bg-slate-50"
          >
            Revisión de correo →
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500 sm:ml-[52px]">
          Registro y seguimiento de solicitudes. Los cambios se sincronizan
          automáticamente con la{" "}
          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            hoja de cálculo de control
          </a>
          .
        </p>
      </header>
      <PanelSolicitudes />
    </main>
  );
}
