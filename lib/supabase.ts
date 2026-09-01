import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Definilas en .env.local (ver .env.example)."
  );
}

// Cliente de navegador: usa siempre la anon key. Nunca importar la
// service role key en código que corra en el cliente.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
