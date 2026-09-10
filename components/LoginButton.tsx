"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

function IconoCandado({ abierto }: { abierto: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6">
      <rect x="5" y="11" width="14" height="9" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      {abierto ? (
        <path d="M8 11V8a4 4 0 0 1 7.5-2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

// Botón flotante junto a la campanita de avisos y "¿Cómo funciona esto?":
// login único de UEEDA. Ver los pedidos es público — esto es solo para
// habilitar cargar/editar/vincular/descartar (ver lib/auth.tsx).
export default function LoginButton() {
  const { isLoggedIn, cargando, iniciarSesion, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (cargando) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const mensaje = await iniciarSesion(email, password);
    setEnviando(false);
    if (mensaje) {
      setError("No se pudo iniciar sesión — revisá el email y la contraseña.");
      return;
    }
    setAbierto(false);
    setPassword("");
  }

  function handleClickPill() {
    if (isLoggedIn) {
      if (window.confirm("¿Cerrar sesión? Vas a volver a ver todo en modo solo lectura.")) {
        cerrarSesion();
      }
      return;
    }
    setAbierto(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClickPill}
        className={`group fixed bottom-36 right-5 z-40 flex h-12 w-12 items-center overflow-hidden rounded-full px-2.5 text-white shadow-lg transition-all duration-300 ease-out hover:w-56 hover:px-4 ${
          isLoggedIn
            ? "bg-emerald-700 shadow-emerald-950/40 hover:bg-emerald-600"
            : "bg-slate-700 hover:bg-slate-600"
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
          <IconoCandado abierto={isLoggedIn} />
        </span>
        <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-xs group-hover:opacity-100">
          {isLoggedIn ? "Editando — Salir" : "Ingresá para editar"}
        </span>
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setAbierto(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-slate-800 bg-[#12161f] p-6 shadow-2xl"
          >
            <h2 className="text-lg font-semibold text-white">Ingresar</h2>
            <p className="text-sm text-slate-400">
              Ingresá con el correo institucional de Datos Abiertos para poder editar.
            </p>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Webmail PJN
              <input
                type="email"
                required
                autoFocus
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Contraseña
              <input
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {enviando ? "Ingresando…" : "Ingresar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
