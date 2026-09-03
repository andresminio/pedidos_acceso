// Cuatrimestre de la CNE: 1 = ene-abr, 2 = may-ago, 3 = sep-dic.
export function cuatrimestreDe(mes: number): 1 | 2 | 3 {
  if (mes <= 4) return 1;
  if (mes <= 8) return 2;
  return 3;
}

export function anioCuatrimestreDeFecha(
  fechaISO: string
): { anio: number; cuatrimestre: 1 | 2 | 3 } {
  const [anioStr, mesStr] = fechaISO.split("-");
  return { anio: Number(anioStr), cuatrimestre: cuatrimestreDe(Number(mesStr)) };
}

// Muestra una fecha guardada como "AAAA-MM-DD" en formato DD/MM/AAAA
// (convención local). El valor guardado y el <input type="date"> siguen
// en ISO — esto es solo para mostrar.
export function fechaCorta(fechaISO: string | null | undefined): string {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  if (!anio || !mes || !dia) return fechaISO;
  return `${dia}/${mes}/${anio}`;
}
