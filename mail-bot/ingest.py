"""
Ingesta IMAP: trae únicamente los mails nuevos desde el último UID
procesado (guardado en Supabase). No marca nada como leído.
"""

from __future__ import annotations

import email
import imaplib
import os
import re
import ssl
from dataclasses import dataclass
from datetime import datetime
from email.header import decode_header
from email.utils import parsedate_to_datetime

MAX_BODY_CHARS = 4000  # tope para no mandar cuerpos gigantes a Gemini

# Banner que el gateway de seguridad del organismo agrega a los mails
# externos ("Seguridad Informática le informa que este mail... PHISHING...").
# Es ruido institucional, no contenido real del mail — se saca antes de
# guardar y de mandarlo a Gemini. Si en algún momento cambia la redacción
# exacta, ajustar este patrón.
_BANNER_SEGURIDAD_RE = re.compile(
    # [⚠️!\s]* absorbe el ícono ⚠️ (que en realidad son dos
    # caracteres: el símbolo y un "variation selector" invisible pegado)
    # junto con cualquier espacio/! sueltos antes del texto del banner.
    r"[⚠️!\s]*Seguridad Inform[aá]tica le informa.*?elimine el mensaje inmediatamente\.?",
    re.IGNORECASE | re.DOTALL,
)

# Red de seguridad: si quedara algún ⚠️/⚠ suelto (por variantes de redacción
# del banner que el regex de arriba no cubra), lo sacamos igual.
_EMOJI_ALERTA_RE = re.compile(r"[⚠️]+")


def _sacar_banner_seguridad(texto: str) -> str:
    texto = _BANNER_SEGURIDAD_RE.sub("", texto)
    texto = _EMOJI_ALERTA_RE.sub("", texto)
    return texto.strip()


@dataclass
class MailMessage:
    uid: str
    fecha: datetime
    remitente: str
    asunto: str
    cuerpo: str
    tiene_adjuntos: bool


def _decode(value: str | None) -> str:
    if not value:
        return ""
    parts = decode_header(value)
    out = []
    for text, enc in parts:
        if isinstance(text, bytes):
            out.append(text.decode(enc or "utf-8", errors="replace"))
        else:
            out.append(text)
    return "".join(out).strip()


def _extract_body(msg: email.message.Message) -> tuple[str, bool]:
    tiene_adjuntos = False
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_disposition = str(part.get("Content-Disposition") or "")
            if "attachment" in content_disposition:
                tiene_adjuntos = True
                continue
            content_type = part.get_content_type()
            if content_type == "text/plain" and not body:
                try:
                    payload = part.get_payload(decode=True)
                    charset = part.get_content_charset() or "utf-8"
                    body = payload.decode(charset, errors="replace")
                except Exception:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            charset = msg.get_content_charset() or "utf-8"
            body = payload.decode(charset, errors="replace") if payload else ""
        except Exception:
            body = str(msg.get_payload())

    body = _sacar_banner_seguridad(body)
    return body.strip()[:MAX_BODY_CHARS], tiene_adjuntos


def fetch_new_messages(
    host: str,
    port: int,
    user: str,
    password: str,
    last_uid: str | None,
    mailbox: str = "INBOX",
) -> list[MailMessage]:
    """
    Devuelve los mensajes con UID mayor a `last_uid`, ordenados por UID
    ascendente. Si `last_uid` es None, trae solo los últimos 20 (primera
    corrida, para no volcar años de correo histórico de una).
    """
    # El servidor (red interna del organismo) usa un certificado
    # autofirmado. Decisión tomada con el usuario: no verificar el
    # certificado en vez de pinnear uno, porque la conexión ya viaja
    # por una red controlada (VPN/intranet), no por internet abierto.
    # Para volver a exigir verificación (si en algún momento el
    # certificado es válido), setear IMAP_VERIFY_SSL=1.
    if os.environ.get("IMAP_VERIFY_SSL") == "1":
        context = ssl.create_default_context()
    else:
        context = ssl._create_unverified_context()
    messages: list[MailMessage] = []

    with imaplib.IMAP4_SSL(host, port, ssl_context=context) as imap:
        imap.login(user, password)
        imap.select(mailbox, readonly=True)  # nunca marcar como leído

        if last_uid:
            status, data = imap.uid("search", None, f"UID {int(last_uid) + 1}:*")
        else:
            status, data = imap.uid("search", None, "ALL")

        if status != "OK":
            raise RuntimeError(f"Búsqueda IMAP falló: {status}")

        uids = [u.decode() for u in data[0].split()] if data and data[0] else []

        # Primera corrida sin last_uid: limitar a los últimos 20 para no
        # procesar todo el historial de golpe.
        if not last_uid:
            uids = uids[-20:]

        for uid in uids:
            status, msg_data = imap.uid("fetch", uid, "(RFC822)")
            if status != "OK" or not msg_data or msg_data[0] is None:
                continue

            raw = msg_data[0][1]
            msg = email.message_from_bytes(raw)

            fecha_raw = msg.get("Date")
            try:
                fecha = parsedate_to_datetime(fecha_raw) if fecha_raw else datetime.utcnow()
            except Exception:
                fecha = datetime.utcnow()

            body, tiene_adjuntos = _extract_body(msg)

            messages.append(
                MailMessage(
                    uid=uid,
                    fecha=fecha,
                    remitente=_decode(msg.get("From")),
                    asunto=_decode(msg.get("Subject")),
                    cuerpo=body,
                    tiene_adjuntos=tiene_adjuntos,
                )
            )

        imap.logout()

    messages.sort(key=lambda m: int(m.uid))
    return messages
