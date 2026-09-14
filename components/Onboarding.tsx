"use client";

import { useState } from "react";
import type { ReactElement } from "react";
import { useAuth } from "@/lib/auth";

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

function IconoReenvio() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-7 w-7">
      <rect x="3" y="6" width="14" height="10" rx="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7.5l7 5 7-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 9.5h2.5M19.5 9.5 17.5 7.5M19.5 9.5 17.5 11.5" strokeLinecap="round" strokeLinejoin="round" />
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

function IconoResumen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-7 w-7">
      <path d="M4 20V4" strokeLinecap="round" />
      <path d="M4 20h16" strokeLinecap="round" />
      <rect x="7" y="13" width="3" height="7" rx="0.6" />
      <rect x="12" y="9" width="3" height="11" rx="0.6" />
      <rect x="17" y="6" width="3" height="14" rx="0.6" />
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

function IconoPropuesta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-7 w-7">
      <rect x="5" y="4" width="14" height="16" rx="2" strokeDasharray="3 2.5" strokeLinecap="round" />
      <path d="M8.5 9.5h7M8.5 13h5" strokeLinecap="round" />
    </svg>
  );
}

function IconoConfirmar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-7 w-7">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 12.5l2 2 3.5-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoCandado() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-7 w-7">
      <rect x="5" y="11" width="14" height="9" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Recorrido para quien YA inició sesión: todos los pasos, con las
// acciones de carga/edición tal como funcionan.
const PASOS_EDICION: Paso[] = [
  {
    titulo: "¿Qué es UEEDA_bot?",
    texto:
      'UEEDA_bot revisa el correo institucional cada cierto tiempo y clasifica automáticamente cada mail en tres categorías: un pedido de acceso nuevo, una respuesta/repregunta sobre un pedido que ya existe, o un mail no relacionado con pedidos de acceso. Nunca carga ni cierra nada por su cuenta — todo pasa por una persona antes de quedar registrado.',
    Icono: IconoBot,
  },
  {
    titulo: "Un asistente que te ayuda a registrar pedidos",
    texto:
      "Acordate que UEEDA_bot facilita el registro, seguimiento y generación de respuesta pero no hace cambios sobre el correo. Tenés que reenviar los mails a Nora y las respuestas al solicitante desde el webmail.",
    Icono: IconoReenvio,
  },
  {
    titulo: "Llega un pedido nuevo, ingresalo",
    texto:
      'Cuando UEEDA_bot detecta un correo que parece un pedido nuevo, aparece en "En revisión" → "Nuevos pedidos de información", con los datos ya propuestos (solicitante, categoría, fecha). Revisalos, corregí lo que haga falta y tocá "Cargar como pedido" — o "Descartar" si en realidad no es un pedido.',
    Icono: IconoBandeja,
  },
  {
    titulo: "Llega una respuesta, revisala",
    texto:
      'Cuando llega la respuesta de Nora, de Prosecretaría, o el solicitante repregunta sobre su pedido, el correo aparece en "Respuestas para vincular". Elegí el pedido correspondiente, ajustá la etiqueta si hace falta, y tocá "Vincular". Si esa respuesta cierra el pedido, tildá "Cerrar pedido" antes de confirmar; si es un paso intermedio (por ejemplo, un reenvío a otra área), dejalo sin tildar.',
    Icono: IconoVincular,
  },
  {
    titulo: "Una línea de tiempo de cada pedido",
    texto:
      'Desde el panel del pedido ingresados podés generar un proyecto de respuesta con IA y ver la línea de tiempo con todos los mails vinculados asociados al pedido, desde la recepción hasta la respuesta final.',
    Icono: IconoLineaTiempo,
  },
  {
    titulo: "La pestaña Resumen",
    texto:
      'En la pestaña "Resumen" podés ver un resumen de la información: contadores, tablas por cuatrimestre y tema, y un Excel descargable con todo.',
    Icono: IconoResumen,
  },
  {
    titulo: "¡Listo!",
    texto:
      'Eso es todo para arrancar. Si algo se descartó por error, desde "Ver descartados" se puede recuperar o pasar directo a "Respuestas para vincular". Y si alguna vez ves todo en modo solo lectura, es porque se cerró la sesión — volvé a entrar con el candado de abajo a la derecha.',
    Icono: IconoListo,
  },
];

// Recorrido para quien NO inició sesión: explica el proceso completo de
// UEEDA_bot paso a paso (de punta a punta), ya que es la versión que va a
// ver la mayor parte de la gente que entra al panel.
const PASOS_VISUALIZACION: Paso[] = [
  {
    titulo: "¿Qué es UEEDA_bot?",
    texto:
      "Es un asistente digital que lee el webmail por nosotros, todo el tiempo, sin cansarse. No decide nada por su cuenta: se limita a ordenar y proponer. La IA genera propuestas y una persona valida las acciones antes de su ejecución.",
    Icono: IconoBot,
  },
  {
    titulo: "Llega un correo",
    texto:
      "El bot revisa la casilla institucional de forma automática, cada cierto tiempo, buscando mensajes nuevos.",
    Icono: IconoBandeja,
  },
  {
    titulo: "Lo lee y lo entiende",
    texto:
      "Con inteligencia artificial, UEEDA_bot analiza el contenido del correo y lo clasifica en tres bandejas: parece un pedido nuevo, parece una respuesta o repregunta sobre un pedido que ya existe, o un mensaje que no parece tener relación con pedidos de acceso.",
    Icono: IconoBot,
  },
  {
    titulo: "Lo deja propuesto, nunca cargado",
    texto:
      "El correo aparece en el panel de revisión con los datos ya completados (quién pregunta, sobre qué tema, de qué fecha). Nada queda registrado todavía.",
    Icono: IconoPropuesta,
  },
  {
    titulo: "Una persona confirma",
    texto:
      "Un integrante del equipo de UEEDA revisa la propuesta, corrige lo que haga falta y confirma: carga el pedido nuevo, o vincula la respuesta con el pedido correspondiente. UEEDA_bot nunca cierra ni carga nada por sí solo.",
    Icono: IconoConfirmar,
  },
  {
    titulo: "Queda todo ordenado",
    texto:
      "Cada pedido guarda su propia línea de tiempo: la recepción, cada respuesta, cada repregunta, cada paso intermedio. Con un click se puede ver el historial completo de cualquier pedido, de punta a punta.",
    Icono: IconoLineaTiempo,
  },
  {
    titulo: "Un panel de resumen",
    texto:
      "Muestra, en cualquier momento, cuántos pedidos hay, cuántos están cerrados, cuántos pendientes, y por qué tema — con un Excel descargable listo para reportar.",
    Icono: IconoResumen,
  },
  {
    titulo: "¿Sos del equipo de UEEDA?",
    texto:
      "Iniciá sesión con el botón del candado (abajo a la derecha) para poder cargar pedidos nuevos, generar respuestas con IA, vincular respuestas o editar cualquier dato.",
    Icono: IconoCandado,
  },
];

type Fase = "cerrado" | "bienvenida" | number; // number = índice en el array de pasos

export default function Onboarding() {
  // Sin auto-apertura: el recorrido solo se abre cuando alguien lo pide
  // desde el botón flotante — nada de popups sorpresa al entrar.
  const [fase, setFase] = useState<Fase>("cerrado");
  const { isLoggedIn } = useAuth();
  const PASOS = isLoggedIn ? PASOS_EDICION : PASOS_VISUALIZACION;

  function cerrar() {
    setFase("cerrado");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setFase("bienvenida")}
        className="group fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center overflow-hidden rounded-full bg-[var(--accent)] px-2.5 text-white shadow-lg shadow-blue-950/40 transition-all duration-300 ease-out hover:w-56 hover:bg-[var(--accent-hover)] hover:px-4"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
          <IconoBot />
        </span>
        <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-xs group-hover:opacity-100">
          ¿Cómo funciona esto?
        </span>
      </button>

      {fase !== "cerrado" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={cerrar}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {fase === "bienvenida" ? (
              <div className="flex flex-col items-center text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg">
                  <IconoBot />
                </span>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  ¿Primera vez por acá?
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Te mostramos en unos pasos qué hace UEEDA_bot, cómo clasifica
                  el correo y cómo proceder en cada pantalla.
                </p>
                <div className="mt-5 flex w-full gap-2">
                  <button
                    type="button"
                    onClick={cerrar}
                    className="flex-1 rounded-md border border-[var(--border-2)] px-3 py-2 text-sm font-medium text-[var(--muted-2)] hover:bg-[var(--surface-2)]"
                  >
                    Ahora no
                  </button>
                  <button
                    type="button"
                    onClick={() => setFase(0)}
                    className="flex-1 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
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
      <h2 className="text-lg font-semibold text-[var(--foreground)]">{paso.titulo}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{paso.texto}</p>

      <div className="mt-5 flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === indice ? "w-5 bg-[var(--accent-hover)]" : "w-1.5 bg-[var(--surface-3)]"
            }`}
          />
        ))}
      </div>

      <div className="mt-5 flex w-full items-center justify-between gap-2">
        <button
          type="button"
          onClick={onCerrar}
          className="text-sm font-medium text-[var(--muted-3)] hover:text-[var(--muted-2)]"
        >
          Saltar
        </button>
        <div className="flex gap-2">
          {indice > 0 && (
            <button
              type="button"
              onClick={onAnterior}
              className="rounded-md border border-[var(--border-2)] px-3 py-1.5 text-sm font-medium text-[var(--muted-2)] hover:bg-[var(--surface-2)]"
            >
              Anterior
            </button>
          )}
          <button
            type="button"
            onClick={esUltimo ? onCerrar : onSiguiente}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            {esUltimo ? "Entendido" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
