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
