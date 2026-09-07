"use client";

import { useState } from "react";

// Explicación de la app para compañeros que recién arrancan a usarla.
// Plegado por defecto (no molesta a quien ya sabe usarla) — un click en
// "¿Cómo funciona esto?" lo despliega. Vive al final de ambas pantallas
// (Ingresados y En revisión), con el mismo contenido en las dos.
export default function Onboarding() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="mt-8 border-t border-slate-800 pt-4">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300"
      >
        <span
          className={`inline-block transition-transform ${abierto ? "rotate-90" : ""}`}
        >
          ▸
        </span>
        ¿Cómo funciona esto?
      </button>

      {abierto && (
        <div className="mt-4 max-w-3xl space-y-5 text-sm text-slate-300">
          <section>
            <h3 className="mb-1 font-semibold text-white">Qué es esta aplicación</h3>
            <p className="text-slate-400">
              Es el registro de pedidos de acceso a la información pública que
              recibe la oficina (UEEDA). Cada pedido queda cargado acá con sus
              datos (solicitante, fecha, categoría, estado) y esta lista se
              sincroniza sola con la planilla de Google Sheets — no hace
              falta cargar nada dos veces.
            </p>
            <p className="mt-2 text-slate-400">
              Además, un bot ("MaryBot") revisa el correo institucional cada
              cierto tiempo y detecta solo dos cosas: pedidos nuevos que
              todavía no están cargados, y respuestas o repreguntas que
              corresponden a un pedido que ya existe. Nunca carga ni cierra
              nada por su cuenta — todo pasa por revisión humana en la
              pestaña "En revisión".
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-white">
              Pantalla "Ingresados"
            </h3>
            <p className="text-slate-400">
              La lista completa de pedidos. Doble click en una fila para
              editarla. Ahí mismo se ve la "línea de tiempo" de cada pedido:
              un punto por cada paso (recepción, respuestas, repreguntas) —
              click en un punto para ver el correo completo. Si el pedido
              vino de un correo importado, aparece un botón para generar un
              borrador de respuesta con IA, que también queda guardado en la
              línea de tiempo como "Proyecto de respuesta de UEEDA".
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-white">
              Pantalla "En revisión"
            </h3>
            <p className="mb-2 text-slate-400">
              Acá aparece lo que detectó MaryBot, en dos grupos:
            </p>
            <ul className="ml-4 list-disc space-y-1.5 text-slate-400">
              <li>
                <span className="text-slate-300">Nuevos pedidos de información:</span>{" "}
                un correo que parece un pedido nuevo. Revisá los datos que
                propone (se pueden corregir) y "Cargar como pedido", o
                "Descartar" si en realidad no es un pedido.
              </li>
              <li>
                <span className="text-slate-300">Respuestas para vincular:</span>{" "}
                un correo que parece ser la respuesta (de Nora, de
                Prosecretaría) o una repregunta del solicitante sobre un
                pedido que ya está cargado. Elegí el pedido correspondiente
                de la lista de candidatos, ajustá la etiqueta si hace falta,
                y "Vincular" — eso agrega el correo a la línea de tiempo del
                pedido. Si esa respuesta cierra el pedido, tildá "Cerrar
                pedido" antes de vincular; si es un paso intermedio (por
                ejemplo, "reenviamos a otra área"), dejalo sin tildar y el
                pedido sigue abierto.
              </li>
            </ul>
            <p className="mt-2 text-slate-400">
              Si algo se descartó por error (o la IA se equivocó), en "Ver
              descartados" se puede volver a mandar a revisión, o pasarlo
              directo a "Respuestas para vincular" si en realidad era una
              respuesta.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-white">En una frase</h3>
            <p className="text-slate-400">
              Llega un pedido → se carga → cuando hay novedades (respuesta,
              repregunta, reenvío) se vinculan a la línea de tiempo del mismo
              pedido → se cierra cuando corresponde. Todo pasa por una
              persona antes de quedar cargado — MaryBot solo sugiere.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
