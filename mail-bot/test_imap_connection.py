#!/usr/bin/env python3
"""
Test standalone de conexión IMAP contra el webmail institucional (Zimbra).
No depende de ninguna librería externa (solo stdlib) y no envía la
contraseña a ningún lado más que al propio servidor IMAP.

Uso:
    python3 test_imap_connection.py

Te va a pedir usuario (mail completo) y contraseña de forma interactiva
(la contraseña no se muestra en pantalla).

Si la cuenta tiene verificación en dos pasos activada, la contraseña
normal NO va a funcionar acá — hace falta generar un código de acceso
para aplicaciones desde la configuración de seguridad de la cuenta, y
usar ese código en vez de la contraseña habitual.

Si querés probar otro host/puerto, pasalos como variables de entorno:

    IMAP_HOST=webmail.pjn.gov.ar IMAP_PORT=993 python3 test_imap_connection.py

Qué hace:
    1. Conecta por SSL al host/puerto indicado.
    2. Hace login.
    3. Lista las carpetas (mailboxes) disponibles.
    4. Selecciona INBOX en modo solo-lectura y muestra cuántos mensajes hay.
    5. Se desconecta. No marca nada como leído, no borra nada.
"""

import getpass
import imaplib
import os
import ssl
import sys

DEFAULT_HOST = "webmail.pjn.gov.ar"
DEFAULT_PORT = 993


def main() -> int:
    host = os.environ.get("IMAP_HOST", DEFAULT_HOST)
    port = int(os.environ.get("IMAP_PORT", DEFAULT_PORT))

    print(f"Probando conexión IMAP a {host}:{port} (SSL)...")

    user = os.environ.get("IMAP_USER") or input("Usuario (mail completo): ").strip()
    password = os.environ.get("IMAP_PASS") or getpass.getpass("Contraseña: ")

    try:
        context = ssl.create_default_context()
        with imaplib.IMAP4_SSL(host, port, ssl_context=context) as imap:
            print("✓ Conexión SSL establecida.")

            imap.login(user, password)
            print("✓ Login exitoso.")

            status, mailboxes = imap.list()
            if status == "OK":
                print(f"✓ Carpetas disponibles ({len(mailboxes)}):")
                for mb in mailboxes[:20]:
                    print(f"    {mb.decode(errors='replace')}")
                if len(mailboxes) > 20:
                    print(f"    ... y {len(mailboxes) - 20} más")
            else:
                print(f"⚠ No se pudo listar carpetas: {status}")

            status, data = imap.select("INBOX", readonly=True)
            if status == "OK":
                total = data[0].decode()
                print(f"✓ INBOX seleccionado en modo solo-lectura. Mensajes: {total}")
            else:
                print(f"⚠ No se pudo seleccionar INBOX: {status}")

            imap.logout()
            print("✓ Logout OK. Todo funcionando.")
            return 0

    except imaplib.IMAP4.error as e:
        print(f"✗ Error IMAP (probablemente usuario/contraseña o host/puerto incorrecto): {e}")
        return 1
    except (OSError, ssl.SSLError) as e:
        print(f"✗ Error de conexión/SSL (revisar host, puerto, o si hace falta VPN/red interna): {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
