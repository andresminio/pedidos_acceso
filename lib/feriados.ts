// Motor de cálculo de días hábiles para el plazo legal de 15 días hábiles
// de un pedido de acceso a la información pública (CNE, Poder Judicial de
// la Nación) — y para la calculadora de plazos (/plazos).
//
// Los feriados nacionales YA NO están hardcodeados acá: se traen de
// ArgentinaDatos vía app/api/feriados/[anio]/route.ts (con cache en
// Supabase, se actualiza sola) — ver lib/useFeriados.ts, el hook que arma
// el Set que reciben las funciones de este archivo. Los "inhábiles
// personalizados" cargados a mano desde /plazos (paros, feriados
// provinciales, etc.) se suman a ese mismo Set.
//
// Lo que SÍ sigue fijo acá, porque ninguna API pública lo tiene (son
// reglas propias del Poder Judicial de la Nación, no feriados
// nacionales): fines de semana, la feria judicial de verano (todo enero)
// y de invierno (fechas que fija la Corte Suprema por Acordada cada año),
// y el 16/11 (Día del Empleado Judicial, Ley 26.674, equiparado a feriado
// obligatorio para todo el Poder Judicial — suspende los plazos
// procesales).
//
// A propósito NO se incluyen los "días no laborables" de comunidades
// religiosas (Ley 27.399, arts. 2 y 3: Pascua Judía, Rosh Hashaná, Iom
// Kipur, Ramadán, etc.) ni el 24/4 (Ley 26.199, día de la comunidad
// armenia): son de uso optativo para quienes pertenecen a esas
// comunidades, no un cierre general de la administración.
//
// ⚠️ MANTENIMIENTO ANUAL — lo único que sigue desactualizándose solo:
// FERIA_INVIERNO. La Corte Suprema fija las fechas exactas por Acordada
// cada año, normalmente en mayo/junio, y no son siempre las mismas dos
// semanas de julio. Buscar "feria judicial de invierno <año> acordada
// Corte Suprema" cuando corresponda y sumar la entrada del año que falte.
// Si un año no está cargado, el cálculo cae a no aplicar el receso de
// invierno para esas fechas puntuales — mejor una aproximación optimista
// (puede marcar como hábil un día que en realidad no lo es) que romper el
// cálculo.

// Feria judicial de invierno: rango [inicio, fin] AAAA-MM-DD, ambas fechas
// inclusive, fijado cada año por Acordada de la CSJN. Siempre son 10 días
// hábiles (2 semanas), pero el arranque varía entre mediados y fines de
// julio según el año (no hay una regla fija como "el enero" de la feria
// de verano) — años recientes, para tener el patrón a la vista:
const FERIA_INVIERNO: Record<number, [string, string]> = {
  2023: ["2023-07-17", "2023-07-28"], // Acordada 17/2023
  2024: ["2024-07-15", "2024-07-26"], // Acordada 16/2024
  2025: ["2025-07-21", "2025-08-01"], // Acordada 9/2025
  2026: ["2026-07-20", "2026-07-31"], // Acordada 11/2026 (CSJN, 2/6/2026)
};

function esFinDeSemana(fechaISO: string): boolean {
  const dia = new Date(fechaISO + "T00:00:00").getDay(); // 0 = domingo, 6 = sábado
  return dia === 0 || dia === 6;
}

// Feria judicial de verano: todo enero, todos los años (práctica estable
// del Poder Judicial de la Nación — no requiere Acordada puntual).
function esFeriaVerano(fechaISO: string): boolean {
  return fechaISO.slice(5, 7) === "01";
}

function esFeriaInvierno(fechaISO: string): boolean {
  const anio = Number(fechaISO.slice(0, 4));
  const rango = FERIA_INVIERNO[anio];
  if (!rango) return false;
  return fechaISO >= rango[0] && fechaISO <= rango[1];
}

// Día del Empleado Judicial (Ley 26.674) — fijo cada 16/11.
function esDiaDelEmpleadoJudicial(fechaISO: string): boolean {
  return fechaISO.slice(5) === "11-16";
}

// Categoría de una regla FIJA (no feriado nacional ni inhábil cargado a
// mano) — la usa /plazos para pintar el calendario. El 16/11 entra en la
// misma categoría "inhabil_judicial" que un inhábil judicial cargado a
// mano (ver TipoInhabil en lib/useFeriados.ts): no hay una categoría
// aparte para "Día del Empleado Judicial".
export type TipoDiaFijo = "finde" | "feria_judicial" | "inhabil_judicial";

export function tipoDiaFijo(fechaISO: string): TipoDiaFijo | null {
  if (esFinDeSemana(fechaISO)) return "finde";
  if (esFeriaVerano(fechaISO) || esFeriaInvierno(fechaISO)) return "feria_judicial";
  if (esDiaDelEmpleadoJudicial(fechaISO)) return "inhabil_judicial";
  return null;
}

// Motivo de por qué una fecha es inhábil por una regla FIJA — para el
// tooltip del calendario de /plazos. Devuelve null si la fecha es hábil
// por estas reglas (puede igual ser inhábil por un feriado nacional o uno
// cargado a mano — ver lib/useFeriados.ts).
export function motivoFijo(fechaISO: string): string | null {
  if (esFinDeSemana(fechaISO)) return "Fin de semana";
  if (esFeriaVerano(fechaISO)) return "Feria judicial de verano";
  if (esFeriaInvierno(fechaISO)) return "Feria judicial de invierno";
  if (esDiaDelEmpleadoJudicial(fechaISO)) return "Inhábil judicial (16/11 — Día del Empleado Judicial)";
  return null;
}

// `feriados`: Set de fechas ISO que son feriado nacional o inhábil
// cargado a mano (lo arma useFeriados con lo que trae la API + Supabase).
export function esDiaHabil(fechaISO: string, feriados: Set<string>): boolean {
  if (esFinDeSemana(fechaISO)) return false;
  if (esFeriaVerano(fechaISO)) return false;
  if (esFeriaInvierno(fechaISO)) return false;
  if (esDiaDelEmpleadoJudicial(fechaISO)) return false;
  if (feriados.has(fechaISO)) return false;
  return true;
}

// Suma "dias" días hábiles a partir de fechaISO (sin contar el propio día
// de inicio) y devuelve la fecha resultante en formato AAAA-MM-DD.
export function sumarDiasHabiles(
  fechaISO: string,
  dias: number,
  feriados: Set<string>
): string {
  const cursor = new Date(fechaISO + "T00:00:00");
  let restantes = dias;
  while (restantes > 0) {
    cursor.setDate(cursor.getDate() + 1);
    const iso = cursor.toISOString().slice(0, 10);
    if (esDiaHabil(iso, feriados)) restantes--;
  }
  return cursor.toISOString().slice(0, 10);
}

// Resta "dias" días hábiles a partir de fechaISO (para calcular "hacia
// atrás" en la calculadora de /plazos, ej. desde una audiencia).
export function restarDiasHabiles(
  fechaISO: string,
  dias: number,
  feriados: Set<string>
): string {
  const cursor = new Date(fechaISO + "T00:00:00");
  let restantes = dias;
  while (restantes > 0) {
    cursor.setDate(cursor.getDate() - 1);
    const iso = cursor.toISOString().slice(0, 10);
    if (esDiaHabil(iso, feriados)) restantes--;
  }
  return cursor.toISOString().slice(0, 10);
}

// Días de calendario (corridos, no hábiles) entre dos fechas ISO — para
// mostrar "tiempo transcurrido" en un pedido ya cerrado.
export function diasCalendarioEntre(desdeISO: string, hastaISO: string): number {
  const desde = new Date(desdeISO + "T00:00:00").getTime();
  const hasta = new Date(hastaISO + "T00:00:00").getTime();
  return Math.round((hasta - desde) / (1000 * 60 * 60 * 24));
}

// Días hábiles entre dos fechas ISO (con signo: negativo si hastaISO es
// anterior a desdeISO) — para mostrar "cuántos días hábiles faltan/pasaron
// del vencimiento", o para el modo "entre dos fechas" de /plazos. No
// cuenta el propio desdeISO.
export function diasHabilesEntre(
  desdeISO: string,
  hastaISO: string,
  feriados: Set<string>
): number {
  if (hastaISO === desdeISO) return 0;
  const signo = hastaISO > desdeISO ? 1 : -1;
  const [inicio, fin] = signo === 1 ? [desdeISO, hastaISO] : [hastaISO, desdeISO];
  const cursor = new Date(inicio + "T00:00:00");
  const finTime = new Date(fin + "T00:00:00").getTime();
  let cuenta = 0;
  while (cursor.getTime() < finTime) {
    cursor.setDate(cursor.getDate() + 1);
    const iso = cursor.toISOString().slice(0, 10);
    if (esDiaHabil(iso, feriados)) cuenta++;
  }
  return cuenta * signo;
}
