"""
Orquestador: corre en cada ejecución del workflow de GitHub Actions.

1. Lee el último UID procesado desde Supabase.
2. Trae mails nuevos por IMAP (sin marcarlos como leídos).
3. Para cada uno: si ya hay un candidato con ese UID, lo salta (idempotencia).
4. Clasifica con Gemini.
5. Si "es_pedido_acceso" y no hay match en pedidos_solicitudes ya cargados,
   lo guarda como candidato "pendiente". Si hay match, lo guarda como
   "ya_cargado" (igual queda registrado, pero no aparece en la cola de
   revisión).
6. Actualiza el último UID SOLO después de procesar (guardar en Supabase)
   cada mail exitosamente — si algo falla a mitad de camino, el próximo
   run retoma desde el último UID que sí se guardó completo. No se pierden
   mails silenciosamente.
"""

from __future__ import annotations

import os
import sys
import traceback
from pathlib import Path

# Windows: cuando la salida va redirigida a un archivo (>> log.txt desde
# el .bat) o corre por el Programador de tareas, Python usa cp1252 en vez
# de UTF-8 y explota con UnicodeEncodeError apenas alguien imprime un
# emoji o tilde. Forzamos UTF-8 en stdout/stderr antes de importar nada
# que pueda imprimir algo.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from secrets_loader import load_secrets

# Trae las 7 variables (IMAP_*, GEMINI_API_KEY, SUPABASE_*) desde
# Bitwarden Secrets Manager (proyecto marybot) e inyecta en os.environ.
load_secrets()

from classify import Clasificacion, classify_mail, remitente_excluido
from ingest import fetch_new_messages
from supabase_client import (
    get_client,
    get_last_uid,
    update_sync_state,
    upsert_candidato,
    ya_esta_cargado,
    ya_existe_candidato,
)


def main() -> int:
    client = get_client()

    imap_host = os.environ["IMAP_HOST"]
    imap_port = int(os.environ.get("IMAP_PORT", "993"))
    imap_user = os.environ["IMAP_USER"]
    imap_pass = os.environ["IMAP_PASS"]

    last_uid = get_last_uid(client)

    try:
        mensajes = fetch_new_messages(
            host=imap_host,
            port=imap_port,
            user=imap_user,
            password=imap_pass,
            last_uid=last_uid,
        )
    except Exception as e:
        error = f"Fallo IMAP: {e}"
        print(error, file=sys.stderr)
        traceback.print_exc()
        update_sync_state(client, ultimo_uid=None, error=error)
        return 1

    print(f"{len(mensajes)} mail(s) nuevo(s) desde UID {last_uid or '(ninguno, primera corrida)'}")

    procesados_ok = 0
    for msg in mensajes:
        try:
            if ya_existe_candidato(client, msg.uid):
                print(f"UID {msg.uid}: ya tiene candidato registrado, salteo clasificación.")
                update_sync_state(client, ultimo_uid=msg.uid)
                procesados_ok += 1
                continue

            patron_excluido = remitente_excluido(msg.remitente)
            if patron_excluido:
                # Filtro barato por remitente/dominio (contexto_clasificacion.md):
                # ni siquiera llamamos a Gemini, ahorra tokens en ruido conocido.
                print(f"UID {msg.uid}: remitente excluido por regla '{patron_excluido}', salteo Gemini.")
                clasif = Clasificacion(
                    es_pedido_acceso=False,
                    es_respuesta_pedido=False,
                    etiqueta_evento=None,
                    confianza_ia=f"Excluido sin llamar a Gemini: remitente coincide con la regla '{patron_excluido}' de contexto_clasificacion.md.",
                    nombre_solicitante=None,
                    solicitud_propuesta=None,
                    categoria_propuesta=None,
                    subcategoria_propuesta=None,
                )
            else:
                clasif = classify_mail(msg.remitente, msg.asunto, msg.cuerpo)

            estado_revision = "pendiente"
            if clasif.es_pedido_acceso and ya_esta_cargado(
                client, clasif.nombre_solicitante, msg.fecha
            ):
                estado_revision = "ya_cargado"
            elif not clasif.es_pedido_acceso and not clasif.es_respuesta_pedido:
                # Igual lo guardamos (para auditoría / no reprocesar) pero
                # nunca va a aparecer en la cola de revisión. Si es una
                # respuesta a vincular, en cambio, sí queda "pendiente"
                # para que aparezca en la cola (aunque no sea un pedido
                # nuevo).
                estado_revision = "descartado"

            candidato = {
                "email_uid": msg.uid,
                "fecha_correo": msg.fecha.isoformat(),
                "remitente": msg.remitente,
                "destinatario": msg.destinatario,
                "asunto": msg.asunto,
                "cuerpo_resumen": msg.cuerpo[:2000],
                "cuerpo_html": msg.cuerpo_html,
                "es_pedido_acceso": clasif.es_pedido_acceso,
                "es_respuesta_pedido": clasif.es_respuesta_pedido,
                "etiqueta_evento": clasif.etiqueta_evento,
                "confianza_ia": clasif.confianza_ia,
                "nombre_solicitante": clasif.nombre_solicitante,
                "fecha_propuesta": msg.fecha.date().isoformat(),
                "solicitud_propuesta": clasif.solicitud_propuesta,
                "categoria_propuesta": clasif.categoria_propuesta,
                "subcategoria_propuesta": clasif.subcategoria_propuesta,
                "estado_revision": estado_revision,
            }

            upsert_candidato(client, candidato)
            update_sync_state(client, ultimo_uid=msg.uid)
            procesados_ok += 1
            print(f"UID {msg.uid}: guardado como '{estado_revision}'.")

        except Exception as e:
            error = f"Fallo procesando UID {msg.uid}: {e}"
            print(error, file=sys.stderr)
            traceback.print_exc()
            # No avanzamos ultimo_uid más allá de acá: el próximo run
            # reintenta este mail (y los siguientes) de nuevo.
            update_sync_state(client, ultimo_uid=None, error=error)
            print(f"Procesados OK antes del error: {procesados_ok}/{len(mensajes)}")
            return 1

    update_sync_state(client, ultimo_uid=last_uid if not mensajes else mensajes[-1].uid, error=None)
    print(f"Listo. {procesados_ok}/{len(mensajes)} procesados sin errores.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
