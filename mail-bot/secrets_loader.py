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
        response = client.secrets().get(secret_id)
        os.environ[env_name] = response.data.value
        print(f"✅ {env_name} recuperado exitosamente desde Bitwarden.")


if __name__ == "__main__":
    load_secrets()
    # smoke test: confirmar que quedaron seteadas (sin imprimir los valores)
    for env_name in SECRET_IDS:
        assert os.environ.get(env_name), f"{env_name} no se cargó"
    print("Todas las variables cargadas correctamente.")
