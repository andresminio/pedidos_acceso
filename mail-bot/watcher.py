"""
NO EN USO — se optó por correr mail-bot/main.py programado cada 2hs con
el Programador de tareas de Windows en vez de este watcher continuo. Ver
README, sección 6. Se deja el código por si en algún momento se prefiere
volver a un modelo "reacciona al toque" en vez de por horario fijo.

Escucha continua del botón "Revisar correo ahora" del panel.

El panel corre en la nube y no tiene acceso a la red interna del
organismo, así que no puede hablarle al webmail directo. En cambio, el
botón deja un pedido en la tabla `revision_triggers` de Supabase, y este
script —corriendo en cualquier PC conectada a esa red, la tuya o la de
un compañero— lo detecta y corre la revisión real.

Dejalo corriendo (podés minimizar la ventana) mientras quieras que el
botón del panel funcione. Cortalo con Ctrl+C cuando no haga falta más.
"""

from __future__ import annotations

import os
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import main as bot
from supabase_client import get_client

POLL_SECONDS = int(os.environ.get("WATCHER_POLL_SECONDS", "15"))


def buscar_trigger_pendiente(client):
    res = (
        client.table("revision_triggers")
        .select("id, solicitado_en")
        .eq("estado", "pendiente")
        .order("solicitado_en", desc=False)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def marcar(client, trigger_id: str, estado: str, mensaje: str | None = None) -> None:
    payload: dict = {"estado": estado}
    if mensaje is not None:
        payload["mensaje"] = mensaje[:500]
    if estado in ("completado", "error"):
        payload["completado_en"] = datetime.now(timezone.utc).isoformat()
    client.table("revision_triggers").update(payload).eq("id", trigger_id).execute()


def run() -> None:
    client = get_client()
    print(f"Escuchando pedidos de revisión cada {POLL_SECONDS}s (Ctrl+C para cortar)...")
    while True:
        try:
            trigger = buscar_trigger_pendiente(client)
            if trigger:
                trigger_id = trigger["id"]
                print(f"Pedido recibido ({trigger_id}). Procesando...")
                marcar(client, trigger_id, "procesando")
                try:
                    codigo = bot.main()
                except Exception as e:
                    traceback.print_exc()
                    marcar(client, trigger_id, "error", f"Excepción: {e}")
                else:
                    if codigo == 0:
                        marcar(client, trigger_id, "completado", "Revisión completada.")
                        print("Listo.")
                    else:
                        marcar(
                            client,
                            trigger_id,
                            "error",
                            "Falló la revisión — ver la consola del watcher para el detalle.",
                        )
        except Exception:
            # Error consultando/actualizando Supabase (ej. sin internet un
            # instante). No cortamos el watcher, seguimos intentando.
            traceback.print_exc()

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("\nCortado.")
