// Colapsa 2+ renglones en blanco seguidos a uno solo, para que la firma o
// los espaciados de cada mail no inflen el alto del box sin aportar info.
// Normalizamos \r\n / \r sueltos a \n primero: muchos mails vienen con
// saltos de línea estilo Windows, y con \r de por medio el patrón de
// líneas en blanco no matcheaba.
//
// Además "desenvolvemos" los saltos de línea sueltos: muchos clientes de
// correo cortan el texto a mano cada ~60-70 caracteres, y con
// whitespace-pre-line eso se veía como un párrafo angosto (con espacio
// libre a la derecha) en vez de aprovechar todo el ancho del cuadro. Un
// \n simple (que no forma parte de un \n\n, o sea no separa párrafos) se
// convierte en un espacio; los párrafos reales (separados por línea en
// blanco) se respetan tal cual.
export function textoCompacto(texto: string): string {
  const normalizado = texto.replace(/\r\n?/g, "\n").trim();
  const sinLineasEnBlancoDeMas = normalizado.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n");
  return sinLineasEnBlancoDeMas.replace(/([^\n])\n(?!\n)/g, "$1 ");
}

// Patrones típicos de donde arranca una cadena de correo reenviada/citada
// dentro del cuerpo de un mail — cada uno debe matchear desde el arranque
// de una línea. No es exhaustivo (hay tantos clientes de correo como
// formatos), pero cubre los casos más comunes en Outlook/webmail en
// español e inglés.
const PATRONES_CADENA: RegExp[] = [
  /^[ \t]*(de|from)[ \t]*:.{0,160}$/im,
  /^[ \t]*el[ \t]+.{0,100}escribi[oó][ \t]*:?[ \t]*$/im,
  /^[ \t]*-{2,}[ \t]*(mensaje original|original message)[ \t]*-{2,}/im,
];

// Mismos patrones que arriba, pero para probar si UN bloque puntual (una
// línea, un <p>/<div> del HTML) arranca directamente con la cadena — lo
// usa CorreoBody para cortar el HTML ya saneado nodo por nodo.
const PATRONES_INICIO_CADENA: RegExp[] = [
  /^(de|from)[ \t]*:/i,
  /^el[ \t]+.{0,100}escribi[oó][ \t]*:?/i,
  /^-{2,}[ \t]*(mensaje original|original message)[ \t]*-{2,}/i,
];

export function esInicioDeCadenaReenviada(textoBloque: string): boolean {
  const limpio = textoBloque.trim();
  if (!limpio) return false;
  return PATRONES_INICIO_CADENA.some((patron) => patron.test(limpio));
}

// Busca dónde arranca la cadena reenviada/citada y devuelve el texto sin
// esa cola — pensado solo para VISUALIZACIÓN (ver CorreoBody): nunca se
// modifica lo que está guardado en la base, esto es puramente qué parte
// mostrar. Si no encuentra ningún patrón, devuelve el texto tal cual.
export function cortarCadenaReenviada(texto: string): string {
  const normalizado = texto.replace(/\r\n?/g, "\n");
  let corte = -1;
  for (const patron of PATRONES_CADENA) {
    const m = normalizado.match(patron);
    if (m && m.index !== undefined && (corte === -1 || m.index < corte)) {
      corte = m.index;
    }
  }
  if (corte <= 0) return texto;
  return normalizado.slice(0, corte).trim();
}
