"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400">Cargando…</div>;
  }

  if (!session) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">
          Iniciar sesión
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Ingresá tu email de la oficina y te enviamos un link de acceso.
        </p>
        {sent ? (
          <p className="text-sm text-emerald-600">
            Revisá tu correo y hacé clic en el link para entrar.
          </p>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@institucion.gob"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              Enviar link de acceso
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-3 text-sm text-slate-500">
        <span>{session.user.email}</span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-blue-700 hover:underline"
        >
          Cerrar sesión
        </button>
      </div>
      {children}
    </div>
  );
}
