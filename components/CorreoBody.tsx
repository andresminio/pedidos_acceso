"use client";

import { useEffect, useState } from "react";
import { textoCompacto } from "@/lib/texto";

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

const ALTO_COLAPSADO = 128; // px — bastante para ver de qué se trata sin abrir

function iniciales(remitente: string): string {
  const nombre = remitente.split("<")[0].trim() || remitente;
  const partes = nombre.split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const letras = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letras.join("") || "?";
}

// Body de un correo (recibido o vinculado a la línea de tiempo), con
// estilo de burbuja: avatar con las iniciales del remitente + tarjeta con
// el contenido. Si hay HTML original (cuerpo_html) lo renderiza saneado
// con dompurify; si no (correos procesados antes de sumar esa columna, o
// que nunca tuvieron parte HTML), cae al texto plano de siempre, pero sin
// la itálica/celeste de antes. Colapsado por defecto — click para expandir.
export default function CorreoBody({
  remitente,
  etiqueta = "Correo",
  html,
  texto,
}: {
  remitente: string;
  etiqueta?: string;
  html?: string | null;
  texto?: string | null;
}) {
  const [expandido, setExpandido] = useState(false);

  // dompurify necesita el DOM del navegador (no corre en el render de
  // servidor de Next) — se sanea recién al montar, en el cliente. Hasta
  // entonces (y para los correos sin cuerpo_html) se muestra el texto
  // plano, así que server y cliente arrancan mostrando lo mismo y no hay
  // parpadeo de hidratación.
  const [htmlSaneado, setHtmlSaneado] = useState<string | null>(null);
  useEffect(() => {
    let cancelado = false;
    if (html?.trim()) {
      import("dompurify").then(({ default: DOMPurify }) => {
        if (cancelado) return;
        setHtmlSaneado(
          DOMPurify.sanitize(html, {
            ALLOWED_TAGS: TAGS_PERMITIDOS,
            ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
          })
        );
      });
    } else {
      setHtmlSaneado(null);
    }
    return () => {
      cancelado = true;
    };
  }, [html]);

  const textoPlano = !htmlSaneado ? textoCompacto(texto?.trim() || "(sin texto)") : null;

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">
        {iniciales(remitente)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs text-slate-500">{etiqueta}</p>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpandido((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setExpandido((v) => !v);
          }}
          className="relative cursor-pointer overflow-hidden rounded-xl border border-slate-800 bg-[#171c26] px-3.5 py-3 text-sm leading-relaxed text-slate-200 transition-[max-height] duration-200"
          style={{ maxHeight: expandido ? 3000 : ALTO_COLAPSADO }}
        >
          {htmlSaneado ? (
            <div
              className="correo-html"
              dangerouslySetInnerHTML={{ __html: htmlSaneado }}
            />
          ) : (
            <p className="whitespace-pre-line">{textoPlano}</p>
          )}
          {!expandido && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-[#171c26] to-transparent" />
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="mt-1 text-xs font-medium text-blue-400 hover:text-blue-300"
        >
          {expandido ? "Ver menos" : "Ver correo completo"}
        </button>
      </div>
    </div>
  );
}
