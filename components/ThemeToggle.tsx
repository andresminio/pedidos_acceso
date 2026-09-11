"use client";

import { useTheme } from "@/lib/theme";

function IconoSol() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-4 w-4">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-4 w-4">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Selector de tema, pensado para ir arriba de la pantalla (junto a
// PanelTabs), no como pill flotante — a diferencia del candado/campanita,
// esto no es una acción de usuario sino una preferencia de visualización.
export default function ThemeToggle() {
  const { tema, alternarTema } = useTheme();
  const esClaro = tema === "light";

  return (
    <button
      type="button"
      onClick={alternarTema}
      title={esClaro ? "Pasar a tema oscuro" : "Pasar a tema claro"}
      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
    >
      {esClaro ? <IconoSol /> : <IconoLuna />}
      {esClaro ? "Claro" : "Oscuro"}
    </button>
  );
}
