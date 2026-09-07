"use client";

import { useState } from "react";
import type { ReactElement } from "react";

// Recorrido guiado (popup, tipo wizard) para compañeros que recién
// arrancan a usar la app. No se abre solo — queda disponible como botón
// flotante abajo a la derecha, en ambas pantallas (Ingresados y En
// revisión), para abrirlo cuando alguien lo necesite.

interface Paso {
  titulo: string;
  texto: string;
  Icono: () => ReactElement;
}

function IconoBot() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-7 w-7">
      <rect x="4" y="8" width="16" height="11" rx="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8V4" strokeLinecap="round" />
      <circle cx="12" cy="3" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="13.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="M9 17h6" strokeLinecap="round" />
      <path d="M2 12h2M20 12h2" strokeLinecap="round" />
    </svg>
  );
}

function IconoBandeja() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-7 w-7">
      <path d="M4 13.5 6.5 5h11L20 13.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4 13.5h4.2a2 2 0 0 1 1.8 1.1v0a2 2 0 0 0 1.8 1.1h.4a2 2 0 0 0 1.8-1.1v0a2 2 0 0 1 1.8-1.1H20V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18v-4.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoVincular() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-7 w-7">
      <path
        d="M9.5 14.5 14.5 9.5"
        strokeLinecap="round"
      />
      <path
        d="M11 7.5 12.4 6a3.2 3.2 0 0 1 4.6 4.6l-1.5 1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 16.5 11.6 18A3.2 3.2 0 0 1 7 13.4l1.5-1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoLineaTiempo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-7 w-7">
      <path d="M4 12h16" strokeLinecap="round" />
      <circle cx="6" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="13" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconoListo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-7 w-7">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PASOS: Paso[] = [
  {
    titulo: "¿Qué es MaryBot?",
    texto:
      'MaryBot revisa el correo institucional cada cierto tiempo y clasifica automáticamente cada mail en una de dos categorías: un pedido de acceso nuevo, o una respuesta/repregunta sobre un pedido que ya existe. Nunca carga ni cierra nada por su cuenta — todo pasa por una persona antes de quedar registrado.',
    Icono: IconoBot,
  },
  {
    titulo: "Escenario 1: llega un pedido nuevo",
    texto:
      'Cuando MaryBot detecta un correo que parece un pedido nuevo, aparece en "En revisión" → "Nuevos pedidos de información", con los datos ya propuestos (solicitante, categoría, fecha). Revisalos, corregí lo que haga falta y tocá "Cargar como pedido" — o "Descartar" si en realidad no es un pedido.',
    Icono: IconoBandeja,
  },
  {
    titulo: "Escenario 2: llega una respuesta o repregunta",
    texto:
      'Cuando llega la respuesta de Nora, de Prosecretaría, o el solicitante repregunta sobre su pedido, el correo aparece en "Respuestas para vincular". Elegí el pedido correspondiente, ajustá la etiqueta si hace falta, y tocá "Vincular". Si esa respuesta cierra el pedido, tildá "Cerrar pedido" antes de confirmar; si es un paso intermedio (por ejemplo, un reenvío a otra área), dejalo sin tildar.',
    Icono: IconoVincular,
  },
  {
    titulo: "La línea de tiempo de cada pedido",
    texto:
      'Cada pedido tiene su propia línea de tiempo: un punto por cada paso (recepción, respuestas, repreguntas, el borrador de respuesta con IA). Click en cualquier punto para ver el correo completo — desde ahí también se puede desvincular si hace falta.',
    Icono: IconoLineaTiempo,
  },
  {
    titulo: "¡Listo!",
    texto:
      'Eso es todo para arrancar. Si algo se descartó por error, desde "Ver descartados" se puede recuperar o pasar directo a "Respuestas para vincular".',
    Icono: IconoListo,
  },
];

type Fase = "cerrado" | "bienvenida" | number; // number = índice en PASOS

export default function Onboarding() {
  // Sin auto-apertura: el recorrido solo se abre cuando alguien lo pide
  // desde el botón flotante — nada de popups sorpresa al entrar.
  const [fase, setFase] = useState<Fase>("cerrado");

  function cerrar() {
    setFase("cerrado");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setFase("bienvenida")}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-950/40 hover:bg-blue-500"
      >
        <IconoBot />
        ¿Cómo funciona esto?
      </button>

      {fase !== "cerrado" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={cerrar}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#12161f] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {fase === "bienvenida" ? (
              <div className="flex flex-col items-center text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg">
                  <IconoBot />
                </span>
                <h2 className="text-lg font-semibold text-white">
                  ¿Primera vez por acá?
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Te mostramos en unos pasos qué hace MaryBot, cómo clasifica
                  el correo y cómo proceder en cada pantalla.
                </p>
                <div className="mt-5 flex w-full gap-2">
                  <button
                    type="button"
                    onClick={cerrar}
                    className="flex-1 rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                  >
                    Ahora no
                  </button>
                  <button
                    type="button"
                    onClick={() => setFase(0)}
                    className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    Empezar el recorrido
                  </button>
                </div>
              </div>
            ) : (
              <PasoRecorrido
                paso={PASOS[fase as number]}
                indice={fase as number}
                total={PASOS.length}
                onAnterior={() => setFase((f) => (f as number) - 1)}
                onSiguiente={() => setFase((f) => (f as number) + 1)}
                onCerrar={cerrar}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PasoRecorrido({
  paso,
  indice,
  total,
  onAnterior,
  onSiguiente,
  onCerrar,
}: {
  paso: Paso;
  indice: number;
  total: number;
  onAnterior: () => void;
  onSiguiente: () => void;
  onCerrar: () => void;
}) {
  const esUltimo = indice === total - 1;
  const { Icono } = paso;

  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg">
        <Icono />
      </span>
      <h2 className="text-lg font-semibold text-white">{paso.titulo}</h2>
      <p className="mt-2 text-sm text-slate-400">{paso.texto}</p>

      <div className="mt-5 flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === indice ? "w-5 bg-blue-500" : "w-1.5 bg-slate-700"
            }`}
          />
        ))}
      </div>

      <div className="mt-5 flex w-full items-center justify-between gap-2">
        <button
          type="button"
          onClick={onCerrar}
          className="text-sm font-medium text-slate-500 hover:text-slate-300"
        >
          Saltar
        </button>
        <div className="flex gap-2">
          {indice > 0 && (
            <button
              type="button"
              onClick={onAnterior}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Anterior
            </button>
          )}
          <button
            type="button"
            onClick={esUltimo ? onCerrar : onSiguiente}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            {esUltimo ? "Entendido" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
