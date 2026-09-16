import os
from bitwarden_sdk import BitwardenClient, ClientSettings

# IDs de los secretos en Bitwarden Secrets Manager (proyecto marybot).
# Se completan una vez creado cada secreto en el dashboard de Secrets Manager.
SECRET_IDS = {
    "IMAP_HOST": "8143734b-7f4d-450a-bb71-b4c6011e072f",
    "IMAP_PORT": "82229d8e-63c2-4c47-814d-b4c6011e16ac",
    "IMAP_USER": "b35071ce-d445-425c-853c-b4c6011dc925",
    "IMAP_PASS": "f98976fb-a002-4745-9a25-b4c6011d3d9d",
    "GEMINI_API_KEY": "23219b64-280a-4578-92f9-b4c6011d6afe",
    "SUPABASE_URL": "4e9d73af-aff8-41e3-9954-b4c6011e2e1e",
    "SUPABASE_KEY": "ae49f23b-bc48-41f2-adfb-b4c6011d80f0",
    # Emails para etiquetar mejor ciertas respuestas en la línea de tiempo
    # de cada pedido (ver classify.py) — nombrados EMAIL_* en el dashboard
    # de Bitwarden, pero acá la clave es el nombre de la env var que lee
    # classify.py, no el nombre del secreto en Bitwarden.
    "NORA_EMAIL": "21472a68-17f6-44db-b8fb-b4c700d0cdcf",
    "PROSECRETARIA_EMAIL": "3e01bdc4-b4e3-4801-94d0-b4c700d14940",
    "SECRETARIA_ACTUACION_ELECTORAL_EMAIL": "4a56cc21-63d5-417d-b5b8-b4c700d10c8f",
    "CONSEJO_ABIERTO_EMAIL": "e81a7741-4511-487d-8f33-b4c700d1b8c4",
}


def load_secrets() -> None:
    """
    Recupera los secretos del mail-bot desde Bitwarden Secrets Manager
    y los inyecta en os.environ, para que el resto del código (classify.py,
    ingest.py, supabase_client.py) siga leyendo os.environ.get(...) sin
    cambios.
    """
    token = os.environ.get("BWS_ACCESS_TOKEN")
    if not token:
        raise PermissionError("Acceso denegado: Computadora no validada.")

    client = BitwardenClient(ClientSettings())
    client.auth().login_access_token(token)

    for env_name, secret_id in SECRET_IDS.items():
        if not secret_id:
            # Todavía no se creó/completó este secreto (ver TODO arriba) —
            # no rompemos el arranque del bot por esto, la variable
            # simplemente queda sin setear.
            print(f"AVISO: {env_name} no tiene ID de secreto configurado, se omite.")
            continue

        response = client.secrets().get(secret_id)
        if not response.success or response.data is None:
            raise RuntimeError(
                f"No se pudo recuperar {env_name} desde Bitwarden: "
                f"{response.error_message or 'error desconocido'}"
            )
        os.environ[env_name] = response.data.value
        print(f"OK: {env_name} recuperado exitosamente desde Bitwarden.")


if __name__ == "__main__":
    load_secrets()
    # smoke test: confirmar que quedaron seteadas (sin imprimir los valores).
    # Los secretos con ID todavía vacío (ver TODO arriba) se saltean: no
    # es un error, todavía no se terminaron de configurar en Bitwarden.
    for env_name, secret_id in SECRET_IDS.items():
        if not secret_id:
            continue
        assert os.environ.get(env_name), f"{env_name} no se cargó"
    print("Todas las variables configuradas se cargaron correctamente.")
