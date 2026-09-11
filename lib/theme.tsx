"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type Tema = "dark" | "light";

interface ThemeContextValue {
  tema: Tema;
  alternarTema: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const CLAVE_STORAGE = "marybot-tema";

// Oscuro por defecto (es el look de siempre del producto) con una versión
// clara opcional. La preferencia se guarda en localStorage por navegador;
// no hay lectura de prefers-color-scheme del sistema porque el default es
// una decisión de producto, no del SO. Ver globals.css para los tokens
// ([data-theme="light"]) — todavía no todos los componentes los usan, se
// está migrando pantalla por pantalla.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("dark");

  useEffect(() => {
    const guardado = window.localStorage.getItem(CLAVE_STORAGE);
    if (guardado === "light" || guardado === "dark") setTema(guardado);
  }, []);

  useEffect(() => {
    if (tema === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    window.localStorage.setItem(CLAVE_STORAGE, tema);
  }, [tema]);

  function alternarTema() {
    setTema((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ tema, alternarTema }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme tiene que usarse dentro de <ThemeProvider>.");
  return ctx;
}
