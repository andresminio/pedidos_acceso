import { supabase } from "./supabase";
import { SUBCATEGORIAS, TEMAS } from "./types";

// Temas de uso más frecuente — van primero y en este orden fijo en los
// selects de categoría, antes del resto (que va alfabético).
export const CATEGORIAS_PRINCIPALES = [
  "Resultados Electorales",
  "Padrón Electoral",
  "Agrupaciones Políticas",
  "Candidaturas",
];

// Separa una lista de categorías en { principales, otras } listas para
// renderizar como dos <optgroup>: "Principales" (orden fijo de arriba) y
// el resto alfabético.
export function agruparCategorias(
  categorias: string[]
): { principales: string[]; otras: string[] } {
  const set = new Set(categorias);
  const principales = CATEGORIAS_PRINCIPALES.filter((c) => set.has(c));
  const otras = categorias
    .filter((c) => !CATEGORIAS_PRINCIPALES.includes(c))
    .sort((a, b) => a.localeCompare(b, "es"));
  return { principales, otras };
}

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

// Subcategorías sugeridas para el campo de texto libre "Subcategoría":
// las de referencia (SUBCATEGORIAS en types.ts) para esa categoría, más
// las que ya se usaron de verdad en pedidos cargados con esa misma
// categoría — así el <datalist> va completando con lo que la oficina
// realmente viene usando, no solo la lista fija.
export async function cargarSubcategorias(categoria: string): Promise<string[]> {
  const referencia = SUBCATEGORIAS[categoria] ?? [];
  if (!categoria) return referencia;
  const { data } = await supabase
    .from("pedidos_solicitudes")
    .select("subcategoria")
    .eq("categoria", categoria)
    .not("subcategoria", "is", null);
  const cargadas = (data ?? [])
    .map((r) => (r.subcategoria as string | null)?.trim())
    .filter((s): s is string => !!s);
  return Array.from(new Set([...referencia, ...cargadas])).sort((a, b) =>
    a.localeCompare(b, "es")
  );
}
