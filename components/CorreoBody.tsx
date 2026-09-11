"use client";

import { useEffect, useRef, useState } from "react";
import { textoCompacto, cortarCadenaReenviada, esInicioDeCadenaReenviada } from "@/lib/texto";

// Solo estructura, nada de estilos/colores propios del mail: así el
// contenido siempre hereda bien el tema oscuro del panel en vez de traer
// fondos blancos o texto negro pegado del HTML original.
const TAGS_PERMITIDOS = [
  "p", "br", "a", "strong", "b", "em", "i", "u",
  "ul", "ol", "li",
  "blockquote",
  "span", "div",
  "h1", "h2", "h3", "h4",
  "table", "thead", "tbody", "tr", "td", "th",
];
const ATRIBUTOS_PERMITIDOS = ["href", "target", "rel"];

function iniciales(remitente: string): string {
  const nombre = remitente.split("<")[0].trim() || remitente;
  const partes = nombre.split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const letras = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letras.join("") || "?";
}

// Corta el HTML ya saneado nodo por nodo (a nivel de los hijos directos del
// contenedor): apenas uno arranca con el patrón de cadena reenviada, se
// borra ese nodo y todos los que siguen. Opera sobre un <div> en memoria,
// nunca toca el string original guardado en la base.
function recortarCadenaEnHtml(contenedor: HTMLElement): void {
  for (const nodo of Array.from(contenedor.childNodes)) {
    const texto = nodo.textContent || "";
    if (esInicioDeCadenaReenviada(texto)) {
      let actual: ChildNode | null = nodo;
      while (actual) {
        const siguiente: ChildNode | null = actual.nextSibling;
        contenedor.removeChild(actual);
        actual = siguiente;
      }
      return;
    }
  }
}

function DatoEncabezado({ label, valor }: { label: string; valor: string }) {
  return (
    <p className="truncate">
      <span className="text-[var(--muted-3)]">{label}: </span>
      <span className="text-[var(--muted-2)]">{valor}</span>
    </p>
  );
}

// Body de un correo (recibido o vinculado a la línea de tiempo), con estilo
// de burbuja: avatar con las iniciales del remitente + tarjeta con un
// encabezado tipo mail (De/Para/Fecha/Asunto, para poder ubicar el correo
// original si hace falta) y el contenido.
//
// Si hay HTML original (cuerpo_html) lo renderiza saneado con dompurify; si
// no, cae al texto plano de siempre (sin la itálica/celeste de antes). En
// ambos casos se recorta automáticamente la cadena reenviada/citada (el
// "De: ... Para: ..." de un mail de arriba) — es solo un recorte visual,
// nunca se borra nada de la base. Si alguien guardó una edición manual
// (cuerpoEditado), esa versión pisa el recorte automático.
export default function CorreoBody({
  remitente,
  destinatario,
  fecha,
  asunto,
  etiqueta = "Correo",
  html,
  texto,
  cuerpoEditado,
  onGuardarEdicion,
}: {
  remitente: string;
  destinatario?: string | null;
  fecha?: string | null;
  asunto?: string | null;
  etiqueta?: string;
  html?: string | null;
  texto?: string | null;
  cuerpoEditado?: string | null;
  onGuardarEdicion?: (texto: string | null) => void | Promise<void>;
}) {
  // Estado local de la edición: arranca con lo que venga por props, pero
  // se actualiza al instante al guardar/restaurar sin esperar a que el
  // padre vuelva a pedir los datos (y se resincroniza si el padre sí
  // cambia la prop, ej. después de un refresco).
  const [edicionActual, setEdicionActual] = useState<string | null>(cuerpoEditado ?? null);
  useEffect(() => {
    setEdicionActual(cuerpoEditado ?? null);
  }, [cuerpoEditado]);
  const tieneEdicion = !!edicionActual?.trim();

  // dompurify necesita el DOM del navegador (no corre en el render de
  // servidor de Next) — se sanea recién al montar, en el cliente. Hasta
  // entonces (y para los correos sin cuerpo_html) se muestra el texto
  // plano, así que server y cliente arrancan mostrando lo mismo y no hay
  // parpadeo de hidratación.
  const [htmlSaneado, setHtmlSaneado] = useState<string | null>(null);
  useEffect(() => {
    let cancelado = false;
    if (!tieneEdicion && html?.trim()) {
      import("dompurify").then(({ default: DOMPurify }) => {
        if (cancelado) return;
        const limpio = DOMPurify.sanitize(html, {
          ALLOWED_TAGS: TAGS_PERMITIDOS,
          ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
        });
        // Recorte de la cadena reenviada en el propio DOM saneado.
        const contenedor = document.createElement("div");
        contenedor.innerHTML = limpio;
        recortarCadenaEnHtml(contenedor);
        setHtmlSaneado(contenedor.innerHTML);
      });
    } else {
      setHtmlSaneado(null);
    }
    return () => {
      cancelado = true;
    };
  }, [html, tieneEdicion]);

  const textoRecortado = cortarCadenaReenviada(texto?.trim() || "(sin texto)");
  const textoPlano = textoCompacto(edicionActual?.trim() || textoRecortado);
  const mostrarHtml = !tieneEdicion && !!htmlSaneado;

  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");
  const [guardando, setGuardando] = useState(false);
  const cajaRef = useRef<HTMLDivElement>(null);

  function abrirEditor() {
    setBorrador(edicionActual?.trim() || textoRecortado);
    setEditando(true);
  }

  // Click afuera del cuadro = "me arrepentí": cancela la edición sin
  // guardar, igual que el botón Cancelar.
  useEffect(() => {
    if (!editando) return;
    function handleClickFuera(e: MouseEvent) {
      if (cajaRef.current && !cajaRef.current.contains(e.target as Node)) {
        setEditando(false);
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, [editando]);

  async function guardar() {
    if (!onGuardarEdicion) return;
    const valor = borrador.trim() || null;
    setGuardando(true);
    await onGuardarEdicion(valor);
    setEdicionActual(valor);
    setGuardando(false);
    setEditando(false);
  }

  async function restaurarAutomatico() {
    if (!onGuardarEdicion) return;
    setGuardando(true);
    await onGuardarEdicion(null);
    setEdicionActual(null);
    setGuardando(false);
    setEditando(false);
  }

  const hayEncabezado = !!(destinatario || fecha || asunto);

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-3)] text-xs font-semibold text-[var(--fg-soft)]">
        {iniciales(remitente)}
      </span>
      <div className="min-w-0 flex-1" ref={cajaRef}>
        <p className="mb-1 text-xs text-[var(--muted-3)]">{etiqueta}</p>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3.5 py-3 text-sm leading-relaxed text-[var(--fg-soft)]">
          {hayEncabezado && (
            <div className="mb-2.5 border-b border-[var(--border)] pb-2 text-xs">
              <DatoEncabezado label="De" valor={remitente} />
              {destinatario && <DatoEncabezado label="Para" valor={destinatario} />}
              {fecha && <DatoEncabezado label="Fecha" valor={fecha} />}
              {asunto && <DatoEncabezado label="Asunto" valor={asunto} />}
            </div>
          )}

          {editando ? (
            <textarea
              autoFocus
              className="input min-h-40 max-h-80 w-full overflow-y-auto text-sm"
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
            />
          ) : mostrarHtml ? (
            <div
              className="correo-html max-h-80 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: htmlSaneado! }}
            />
          ) : (
            <p className="max-h-80 overflow-y-auto whitespace-pre-line">{textoPlano}</p>
          )}
        </div>

        {onGuardarEdicion && (
          <div className="mt-1 flex items-center gap-3 text-xs">
            {editando ? (
              <>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={guardar}
                  className="font-medium text-[var(--accent-hover)] hover:text-[var(--accent)] disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setEditando(false)}
                  className="text-[var(--muted-3)] hover:text-[var(--muted-2)]"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={abrirEditor}
                  className="font-medium text-[var(--accent-hover)] hover:text-[var(--accent)]"
                >
                  Editar mensaje
                </button>
                {tieneEdicion && (
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={restaurarAutomatico}
                    className="text-[var(--muted-3)] hover:text-[var(--muted-2)] disabled:opacity-50"
                  >
                    Restaurar corte automático
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
