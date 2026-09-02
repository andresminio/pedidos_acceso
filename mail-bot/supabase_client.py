"""
Helpers de Supabase: estado de sincronización (último UID procesado),
lectura de pedidos existentes (para el dedupe) y upsert de candidatos.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta

from supabase import Client, create_client

DEDUPE_VENTANA_DIAS = 30  # ventana para considerar "mismo pedido ya cargado"


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]  # anon key, misma que usa el panel (RLS pública)
    return create_client(url, key)


def get_last_uid(client: Client) -> str | None:
    res = client.table("mail_sync_state").select("ultimo_uid").eq("id", 1).execute()
    if res.data:
        return res.data[0].get("ultimo_uid")
    return None


def update_sync_state(client: Client, ultimo_uid: str | None, error: str | None = None) -> None:
    payload = {
        "ultima_corrida_en": datetime.utcnow().isoformat(),
        "ultimo_error": error,
    }
    if ultimo_uid is not None:
        payload["ultimo_uid"] = ultimo_uid
    client.table("mail_sync_state").update(payload).eq("id", 1).execute()


def _normalizar(texto: str | None) -> str:
    return (texto or "").strip().lower()


def ya_esta_cargado(client: Client, nombre_solicitante: str | None, fecha_correo: datetime) -> bool:
    """
    Heurística simple de dedupe: si ya existe en pedidos_solicitudes un
    registro con nombre_solicitante parecido y fecha dentro de la ventana,
    lo consideramos ya cargado y no lo mostramos como candidato nuevo.
    No es un match perfecto — el objetivo es reducir ruido obvio, no
    reemplazar el criterio humano en la ventana de revisión.
    """
    nombre_normalizado = _normalizar(nombre_solicitante)
    if not nombre_normalizado:
        return False

    desde = (fecha_correo - timedelta(days=DEDUPE_VENTANA_DIAS)).date().isoformat()
    hasta = (fecha_correo + timedelta(days=DEDUPE_VENTANA_DIAS)).date().isoformat()

    res = (
        client.table("pedidos_solicitudes")
        .select("id, nombre_solicitante, fecha")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .execute()
    )

    for row in res.data or []:
        if _normalizar(row.get("nombre_solicitante")) == nombre_normalizado:
            return True
    return False


def ya_existe_candidato(client: Client, email_uid: str) -> bool:
    res = (
        client.table("candidatos_correo")
        .select("id")
        .eq("email_uid", email_uid)
        .execute()
    )
    return bool(res.data)


def upsert_candidato(client: Client, candidato: dict) -> None:
    client.table("candidatos_correo").upsert(candidato, on_conflict="email_uid").execute()
