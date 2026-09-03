// Colapsa 2+ renglones en blanco seguidos a uno solo, para que la firma o
// los espaciados de cada mail no inflen el alto del box sin aportar info.
// Normalizamos \r\n / \r sueltos a \n primero: muchos mails vienen con
// saltos de línea estilo Windows, y con \r de por medio el patrón de
// líneas en blanco no matcheaba.
export function textoCompacto(texto: string): string {
  const normalizado = texto.replace(/\r\n?/g, "\n").trim();
  return normalizado.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n");
}
