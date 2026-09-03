import { supabase } from "./supabase";
import { TEMAS } from "./types";

// Categorías = las fijas de TEMAS + las que se hayan agregado a mano
// (guardadas en categorias_custom, compartidas por todos los que usan el
// panel, no solo en el navegador de quien las agregó).
export async function cargarCategorias(): Promise<string[]> {
  const { data } = await supabase
    .from("categorias_custom")
    .select("nombre")
    .order("nombre");
  const extra = (data ?? []).map((r) => r.nombre as string);
  const todas = new Set<string>([...TEMAS, ...extra]);
  return Array.from(todas).sort((a, b) => a.localeCompare(b, "es"));
}

// Guarda una categoría nueva (si no es ya una de las fijas ni ya existía).
export async function agregarCategoria(
  nombre: string
): Promise<{ error?: string }> {
  const limpio = nombre.trim();
  if (!limpio || TEMAS.includes(limpio)) return {};
  const { error } = await supabase
    .from("categorias_custom")
    .upsert({ nombre: limpio }, { onConflict: "nombre", ignoreDuplicates: true });
  if (error) return { error: error.message };
  return {};
}
