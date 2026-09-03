"""
Clasificación de mails con Gemini Flash: determina si es un pedido de
acceso a la información no registrado, y propone los campos para cargarlo
en pedidos_solicitudes.
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path

from google import genai
from google.genai import errors as genai_errors

CONTEXTO_PATH = Path(__file__).parent / "contexto_clasificacion.md"

MAX_INTENTOS = 3
ESPERA_BASE_SEGUNDOS = 10  # backoff: 10s, 20s entre reintentos

# Mismo listado que lib/types.ts (TEMAS) del panel Next.js. Si agregan un
# tema nuevo ahí, conviene reflejarlo acá también.
CATEGORIAS = [
    "Resultados electorales",
    "Padrón electoral",
    "Agrupaciones políticas",
    "Voto Joven",
    "Participación y ausentismo electoral",
    "Información general",
    "Candidaturas",
    "Electores Residentes en el exterior",
    "Geografía Electoral",
    "Jurisprudencia",
    "Datos Históricos",
    "Ciudadanía",
    "Boletas de votación",
    "Electores Privados de Libertad",
    "Accesibilidad Electoral",
    "Extranjeros",
    "Autoridades de mesa",
    "Normas electorales",
    "Acompañamiento Cívico",
    "Biometría",
    "Contrataciones CNE",
    "Manejo y seguridad de datos informáticos",
    "Reclamos y Denuncias",
    "Redes sociales",
    "Registro de Empresas de Encuestas y Sondeos de Opinión",
]

DEFAULT_MODEL = "gemini-flash-latest"  # alias: siempre apunta al Flash vigente

PROMPT_TEMPLATE = """Sos un asistente que ayuda a una oficina pública (Cámara Nacional \
Electoral) a triar su correo entrante para detectar pedidos de acceso a la \
información pública que todavía no fueron cargados en su sistema de registro.

Te paso un mail. Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin \
texto extra) con este formato exacto:

{{
  "es_pedido_acceso": true o false,
  "confianza_ia": "una frase corta explicando por qué lo clasificaste así",
  "nombre_solicitante": "nombre de quien pide, o null si no se puede inferir",
  "solicitud_propuesta": "qué se solicita, directo y breve (ver formato abajo), o null",
  "categoria_propuesta": "una de estas categorías EXACTAS, o null si ninguna aplica: {categorias}",
  "subcategoria_propuesta": "subtema más específico si aplica, o null"
}}

Consideraciones:
- "es_pedido_acceso" es true SOLO si el mail es un pedido de acceso a la \
información pública (alguien externo pidiendo datos, estadísticas, \
documentos, información electoral, etc.), NO para spam, newsletters, \
notificaciones automáticas, mails internos administrativos, o \
conversaciones que no son un pedido nuevo.
- Si no estás seguro, marcá "es_pedido_acceso": false y explicá por qué en \
"confianza_ia".
- Para "solicitud_propuesta": andá directo al grano, sin frases de relleno. \
NUNCA arranques con "Se solicita información sobre", "El remitente pide", \
"Solicita acceso a" ni nada equivalente — esa parte ya se sabe (es un \
pedido de acceso), no hace falta repetirla. Empezá directo por el objeto \
concreto del pedido. Por ejemplo, en vez de "Se solicita información sobre \
el padrón electoral de la provincia de Córdoba" escribí "Padrón electoral \
de la provincia de Córdoba". Si son varios puntos, listalos separados por \
comas o "y", igual de directo.

Además de lo anterior, seguí estas reglas de contexto específicas de esta \
oficina (definidas por el equipo, tienen prioridad sobre tu criterio general \
si hay conflicto):

{contexto}

Remitente: {remitente}
Asunto: {asunto}
Cuerpo:
{cuerpo}
"""


@dataclass
class Clasificacion:
    es_pedido_acceso: bool
    confianza_ia: str | None
    nombre_solicitante: str | None
    solicitud_propuesta: str | None
    categoria_propuesta: str | None
    subcategoria_propuesta: str | None


def _client() -> genai.Client:
    api_key = os.environ["GEMINI_API_KEY"]
    return genai.Client(api_key=api_key)


def _leer_contexto() -> str:
    if CONTEXTO_PATH.exists():
        texto = CONTEXTO_PATH.read_text(encoding="utf-8").strip()
        if texto:
            return texto
    return "(sin reglas adicionales definidas todavía)"


def _sin_comentarios_html(texto: str) -> str:
    # Saca los bloques <!-- ... --> (ahí viven los ejemplos de la plantilla,
    # no queremos que se interpreten como reglas reales).
    return re.sub(r"<!--.*?-->", "", texto, flags=re.DOTALL)


def _patrones_exclusion() -> list[str]:
    """
    Lee la sección "Remitentes / dominios a excluir siempre" de
    contexto_clasificacion.md y devuelve una lista de substrings en
    minúscula para matchear contra el remitente (ej. "@spamdominio.com",
    "noreply@algo.gov.ar").
    """
    if not CONTEXTO_PATH.exists():
        return []
    texto = _sin_comentarios_html(CONTEXTO_PATH.read_text(encoding="utf-8"))
    m = re.search(
        r"##\s*Remitentes.*?excluir siempre.*?\n(.*?)(?=\n##\s|\Z)",
        texto,
        re.IGNORECASE | re.DOTALL,
    )
    if not m:
        return []

    patrones = []
    for linea in m.group(1).splitlines():
        linea = linea.strip()
        if not linea.startswith("-"):
            continue
        linea = linea.lstrip("-").strip()
        if not linea:
            continue
        token = re.split(r"[\s→]", linea, maxsplit=1)[0].strip()
        token = token.lstrip("*")  # "*@dominio.com" -> "@dominio.com"
        if token:
            patrones.append(token.lower())
    return patrones


def remitente_excluido(remitente: str) -> str | None:
    """
    Si el remitente matchea alguna regla de exclusión del contexto,
    devuelve el patrón que matcheó (para loguear). Si no, None.
    Filtro barato que corre ANTES de llamar a Gemini, para no gastar
    tokens en mails que ya sabemos que no son pedidos.
    """
    remitente_lower = remitente.lower()
    for patron in _patrones_exclusion():
        if patron in remitente_lower:
            return patron
    return None


def classify_mail(remitente: str, asunto: str, cuerpo: str) -> Clasificacion:
    model = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)
    prompt = PROMPT_TEMPLATE.format(
        categorias=", ".join(CATEGORIAS),
        contexto=_leer_contexto(),
        remitente=remitente,
        asunto=asunto,
        cuerpo=cuerpo[:4000],
    )

    client = _client()
    response = None
    for intento in range(1, MAX_INTENTOS + 1):
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )
            break
        except genai_errors.ServerError as e:
            # 503 / modelo saturado — transitorio, no un error de nuestro
            # lado. Reintentamos con espera creciente antes de rendirnos.
            if intento == MAX_INTENTOS:
                raise
            espera = ESPERA_BASE_SEGUNDOS * intento
            print(
                f"Gemini no disponible (intento {intento}/{MAX_INTENTOS}), "
                f"reintento en {espera}s: {e}"
            )
            time.sleep(espera)

    assert response is not None  # inalcanzable: o rompe el loop o levanta arriba
    raw = (response.text or "").strip()
    data = json.loads(raw)

    categoria = data.get("categoria_propuesta")
    if categoria not in CATEGORIAS:
        categoria = None

    return Clasificacion(
        es_pedido_acceso=bool(data.get("es_pedido_acceso", False)),
        confianza_ia=data.get("confianza_ia"),
        nombre_solicitante=data.get("nombre_solicitante"),
        solicitud_propuesta=data.get("solicitud_propuesta"),
        categoria_propuesta=categoria,
        subcategoria_propuesta=data.get("subcategoria_propuesta"),
    )
