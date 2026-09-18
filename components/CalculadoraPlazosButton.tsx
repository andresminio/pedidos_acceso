"use client";

import Link from "next/link";

function IconoCalculadora() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6">
      <rect x="5" y="3" width="14" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 7h8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Botón flotante (mismo patrón que LoginButton/PushSetup/ThemeToggle) que
// lleva a /plazos: calculadora de días hábiles/corridos y calendario de
// días inhábiles (fines de semana, feriados nacionales, feria judicial,
// 16/11 y los que se carguen a mano). Ver lib/feriados.ts.
export default function CalculadoraPlazosButton() {
  return (
    <Link
      href="/plazos"
      className="group fixed bottom-[17rem] right-5 z-40 flex h-12 w-12 items-center overflow-hidden rounded-full bg-emerald-700 px-2.5 text-white shadow-lg shadow-emerald-950/40 transition-all duration-300 ease-out hover:w-56 hover:bg-emerald-600 hover:px-4"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
        <IconoCalculadora />
      </span>
      <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-xs group-hover:opacity-100">
        Calculadora de plazos
      </span>
    </Link>
  );
}
