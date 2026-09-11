"use client";

import { useTheme } from "@/lib/theme";

function IconoSol() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconoLuna() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Botón flotante, apilado con el candado/campanita/onboarding (ver
// app/layout.tsx). Oscuro por defecto; alterna a la versión clara y
// guarda la preferencia en localStorage (ver lib/theme.tsx).
export default function ThemeToggle() {
  const { tema, alternarTema } = useTheme();
  const esClaro = tema === "light";

  return (
    <button
      type="button"
      onClick={alternarTema}
      className={`group fixed bottom-20 right-5 z-40 flex h-12 w-12 items-center overflow-hidden rounded-full px-2.5 text-white shadow-lg transition-all duration-300 ease-out hover:w-56 hover:px-4 ${
        esClaro
          ? "bg-amber-500 shadow-amber-950/40 hover:bg-amber-400"
          : "bg-slate-700 hover:bg-slate-600"
      }`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
        {esClaro ? <IconoSol /> : <IconoLuna />}
      </span>
      <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-xs group-hover:opacity-100">
        {esClaro ? "Modo claro" : "Modo oscuro"}
      </span>
    </button>
  );
}
