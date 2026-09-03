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
