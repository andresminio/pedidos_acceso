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

# Emails de las áreas/personas cuyas respuestas hay que distinguir en la
# línea de tiempo de cada pedido — se pasan por variables de entorno (hoy
# recuperadas desde Bitwarden Secrets Manager, ver secrets_loader.py) para
# no dejar ningún email real hardcodeado en el repo. Sin configurar alguna,
# el clasificador simplemente no va a poder etiquetar específicamente esas
# respuestas (cae en el caso genérico "Reenvío/Respuesta de otra área").
EMAIL_NORA = os.environ.get("NORA_EMAIL", "")
EMAIL_PROSECRETARIA = os.environ.get("PROSECRETARIA_EMAIL", "")
EMAIL_SECRETARIA_ACTUACION_ELECTORAL = os.environ.get(
    "SECRETARIA_ACTUACION_ELECTORAL_EMAIL", ""
)
EMAIL_CONSEJO_ABIERTO = os.environ.get("CONSEJO_ABIERTO_EMAIL", "")

INTENTOS_POR_MODELO = 2
ESPERA_ENTRE_INTENTOS_SEGUNDOS = 5  # espera fija entre los 2 intentos de un mismo modelo

# Mismo listado que lib/types.ts (TEMAS) del panel Next.js. Si agregan un
# tema nuevo ahí, conviene reflejarlo acá también.
CATEGORIAS = [
    "Accesibilidad Electoral",
    "Acompañamiento Cívico",
    "Agrupaciones Políticas",
    "Autoridades de Mesa",
    "Biometría",
    "Boletas de Votación",
    "Candidaturas",
    "Ciudadanía",
    "Contrataciones CNE",
    "Datos Históricos",
    "Electores Privados de Libertad",
    "Electores Residentes en el Exterior",
    "Extranjeros",
    "Geografía Electoral",
    "Información General",
    "Jurisprudencia",
    "Manejo y Seguridad de Datos Informáticos",
    "Normas Electorales",
    "Padrón Electoral",
    "Participación y Ausentismo Electoral",
    "Reclamos y Denuncias",
    "Redes Sociales",
    "Registro de Empresas de Encuestas y Sondeos de Opinión",
    "Resultados Electorales",
    "Voto Joven",
]

# Subcategorías de referencia por categoría — mismo listado que
# lib/types.ts (SUBCATEGORIAS). Se le pasan a Gemini como sugerencia, no
# como restricción dura: si el mail no encaja en ninguna, puede proponer
# otra o dejarlo en null.
SUBCATEGORIAS: dict[str, list[str]] = {
    "Agrupaciones Políticas": [
        "Afiliados",
        "Financiamiento",
        "Agrupaciones políticas y alianzas",
        "Documentación",
        "Candidaturas",
        "Plataformas electorales",
    ],
    "Candidaturas": [
        "Elecciones nacionales",
        "Elecciones provinciales",
        "Elecciones municipales",
        "Candidatos",
    ],
    "Datos Históricos": ["Padrones"],
    "Electores Privados de Libertad": [
        "Participación",
        "Información",
        "Composición y/o participación",
    ],
    "Electores Residentes en el Exterior": [
        "Composición",
        "Participación",
        "Composición y/o participación",
    ],
    "Información General": [
        "Elecciones",
        "Elecciones provinciales",
        "Elecciones municipales",
        "CNE",
        "Accesibilidad electoral",
    ],
    "Jurisprudencia": ["Secretaría Penal"],
    "Normas Electorales": ["Obligatoriedad del voto"],
    "Padrón Electoral": [
        "Composición",
        "Datos personales",
        "Establecimientos de votación",
        "Padrón electoral histórico",
        "Establecimientos",
    ],
    "Participación y Ausentismo Electoral": ["Participación"],
    "Redes Sociales": ["Auditorías - Control de información"],
    "Resultados Electorales": [
        "Nacionales",
        "Provinciales y Municipales",
        "Electores privados de libertad",
        "Electores residentes en el exterior",
    ],
    "Voto Joven": ["Participación"],
}


def _lista_subcategorias() -> str:
    lineas = []
    for cat in CATEGORIAS:
        subs = SUBCATEGORIAS.get(cat)
        if subs:
            lineas.append(f"- {cat}: {', '.join(subs)}")
        else:
            lineas.append(f"- {cat}: (sin subcategorías típicas)")
    return "\n".join(lineas)

DEFAULT_MODEL = "gemini-3.5-flash-lite"

# Cuando un modelo está saturado (503 UNAVAILABLE), reintentar el mismo
# modelo no sirve de mucho — el pool de capacidad es el mismo. Por eso, tras
# un par de intentos rápidos, se rota a otro modelo (pool de capacidad
# separado) antes de rendirse. Ver classify_mail().
# "gemini-flash-latest" (el alias al Flash vigente) se sacó de la lista:
# en la práctica siempre está saturado (503) y solo hace perder tiempo
# antes de rotar a los modelos de abajo.
MODELOS_FALLBACK = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
]


def _modelos_a_intentar() -> list[str]:
    # Si se fija GEMINI_MODEL a mano (.env), se respeta como único modelo,
    # sin rotar a otros — se asume una elección intencional.
    override = os.environ.get("GEMINI_MODEL")
    return [override] if override else MODELOS_FALLBACK

PROMPT_TEMPLATE = """Sos un asistente que ayuda a una oficina pública (Cámara Nacional \
Electoral) a triar su correo entrante para detectar pedidos de acceso a la \
información pública que todavía no fueron cargados en su sistema de registro.

Te paso un mail. Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin \
texto extra) con este formato exacto:

{{
  "es_pedido_acceso": true o false,
  "es_respuesta_pedido": true o false,
  "etiqueta_evento": "si es_respuesta_pedido es true, una etiqueta corta (2-4 palabras) para la línea de tiempo del pedido, ver abajo; si no, null",
  "confianza_ia": "una frase corta explicando por qué lo clasificaste así",
  "nombre_solicitante": "nombre de quien pide, o null si no se puede inferir",
  "solicitud_propuesta": "qué se solicita, directo y breve (ver formato abajo), o null",
  "categoria_propuesta": "una de estas categorías EXACTAS, o null si ninguna aplica: {categorias}",
  "subcategoria_propuesta": "subtema más específico si aplica, o null"
}}

Referencia de subcategorías típicas por categoría (no es una lista cerrada: \
si el mail encaja en la categoría pero no en ninguna de estas subcategorías, \
proponé la que te parezca más adecuada o dejá "subcategoria_propuesta" en \
null; si sí encaja en alguna de esta lista, preferí usar exactamente ese \
texto):

{subcategorias}

Consideraciones:
- "es_pedido_acceso" es true SOLO si el mail es un pedido de acceso a la \
información pública (alguien externo pidiendo datos, estadísticas, \
documentos, información electoral, etc.), NO para spam, newsletters, \
notificaciones automáticas, mails internos administrativos, o \
conversaciones que no son un pedido nuevo.
- Si no estás seguro, marcá "es_pedido_acceso": false y explicá por qué en \
"confianza_ia".
- "es_respuesta_pedido" es true cuando el mail NO es un pedido nuevo, sino \
que trae la respuesta que hay que enviarle a un solicitante por un pedido \
que YA fue cargado antes — típicamente Nora, la Prosecretaría, u otra \
área interna mandando el texto de la respuesta para que la oficina se lo \
reenvíe al solicitante (a veces citando el pedido original, el nombre de \
quien preguntó, o "esta es la respuesta para..."). En ese caso \
"es_pedido_acceso" tiene que ser false (no es un pedido nuevo) y \
"es_respuesta_pedido" true. Para el resto de los mails internos (avisos, \
coordinación sin una respuesta concreta para reenviar, etc.) los dos \
quedan en false.
- "etiqueta_evento" describe QUÉ tipo de paso es este correo dentro del \
intercambio de un pedido ya cargado — se va a mostrar como un punto en la \
línea de tiempo del pedido (Recepción → ... → respuesta final). El \
CONTENIDO manda sobre el remitente: {email_nora}, {email_prosecretaria}, \
{email_secretaria_actuacion_electoral} y {email_consejo_abierto} también \
mandan mails de coordinación interna que NO son la respuesta para el \
solicitante (avisos, consultas internas, "¿tenés novedades de tal \
pedido?", etc.) — para esos casos, "es_respuesta_pedido" tiene que ser \
false igual que cualquier otro mail interno sin una respuesta concreta \
para reenviar (ver el punto anterior), así que no llegan a necesitar \
etiqueta. Recién si el correo SÍ trae el texto de una respuesta concreta \
para el solicitante, elegí la etiqueta según el remitente:
  - {email_nora} → "Respuesta de Nora"
  - {email_prosecretaria} → "Respuesta Prosecretaría"
  - {email_secretaria_actuacion_electoral} → "Respuesta Secretaría de Actuación Electoral"
  - {email_consejo_abierto} → "Respuesta Consejo Abierto"
  - El remitente es el SOLICITANTE original volviendo a escribir sobre su \
propio pedido (no alguien interno) → "Repregunta del solicitante"
  - Cualquier otro caso de respuesta/reenvío (otra área interna, remitente \
distinto a los de la lista) → una frase corta (2-4 palabras) específica \
al caso, por ejemplo "Reenvío a Secretaría Electoral" — evitá una \
etiqueta genérica como "Respuesta" a secas.
Si "es_respuesta_pedido" es false, "etiqueta_evento" queda en null.
- Cómo determinar "nombre_solicitante" (aplica tanto para un pedido nuevo \
como para encontrar al solicitante original de una respuesta a vincular): \
priorizá el nombre real de la persona — si el mail está firmado (nombre \
al final, antes de "Saludos"/"Atentamente"/etc.) o el nombre aparece en \
el cuerpo (ej. "Mi nombre es...", "Soy fulano de tal..."), usá ESE \
nombre. Si el mail no está firmado y no hay nombre en el cuerpo, \
inferilo de la dirección de correo del remitente (ej. \
"juan.perez@gmail.com" → "Juan Perez") — mejor un nombre inferido de la \
dirección que dejarlo en null, salvo que la dirección no tenga ninguna \
pista de nombre (ej. "info@empresa.com", "contacto123@...") — ahí sí \
"nombre_solicitante": null.
- Si "es_respuesta_pedido" es true, "nombre_solicitante" tiene que ser el \
nombre del solicitante ORIGINAL del pedido al que corresponde esta \
respuesta, con el mismo criterio del punto anterior pero buscando en el \
texto citado/reenviado del hilo (firma, cuerpo, o la dirección de correo \
del "De:" original) — NO el remitente de este mail (que suele ser \
alguien interno: Nora, Prosecretaría, otra área). Es indispensable para \
poder vincular automáticamente esta respuesta con el pedido ya cargado — \
si queda en null aunque el nombre esté en el hilo citado, no se puede \
encontrar el pedido para vincular.
- "Datos Históricos" aplica en dos casos: (1) pedidos de resultados o \
padrones de elecciones ANTERIORES a 1983 (retorno de la democracia), o \
(2) pedidos de cualquier otro tipo de documentación sobre temas \
infrecuentes ANTERIORES a 2011. Un pedido sobre elecciones de 1983 en \
adelante que no sea de un tema infrecuente previo a 2011 — aunque sea \
"viejo" o de hace décadas — no es "Datos Históricos": clasificalo en la \
categoría que corresponda al tema (por ejemplo "Resultados Electorales" o \
"Padrón Electoral").
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
    es_respuesta_pedido: bool
    etiqueta_evento: str | None
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
    prompt = PROMPT_TEMPLATE.format(
        categorias=", ".join(CATEGORIAS),
        subcategorias=_lista_subcategorias(),
        contexto=_leer_contexto(),
        email_nora=EMAIL_NORA,
        email_prosecretaria=EMAIL_PROSECRETARIA,
        email_secretaria_actuacion_electoral=EMAIL_SECRETARIA_ACTUACION_ELECTORAL,
        email_consejo_abierto=EMAIL_CONSEJO_ABIERTO,
        remitente=remitente,
        asunto=asunto,
        cuerpo=cuerpo[:4000],
    )

    # Códigos por los que vale la pena rotar a otro modelo:
    # 429/500/503 = saturado o límite de cuota (transitorio, el pool de
    # capacidad de otro modelo puede estar libre); 404 = el modelo fue
    # discontinuado (Google los retira con el tiempo) — no tiene sentido
    # reintentarlo, directo al siguiente. Cualquier otro código (400, 401,
    # 403, etc.) no es cuestión de qué modelo se use, así que se corta ahí
    # y se levanta el error tal cual.
    CODIGOS_ROTABLES = {404, 429, 500, 503}

    client = _client()
    modelos = _modelos_a_intentar()
    response = None
    ultimo_error: genai_errors.APIError | None = None

    for idx_modelo, model in enumerate(modelos):
        for intento in range(1, INTENTOS_POR_MODELO + 1):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config={"response_mime_type": "application/json"},
                )
                break
            except genai_errors.APIError as e:
                ultimo_error = e
                if e.code not in CODIGOS_ROTABLES:
                    raise  # error no relacionado al modelo (auth, request inválido, etc.)
                if e.code == 404:
                    # Modelo discontinuado: no tiene sentido reintentarlo.
                    print(f"Gemini ({model}) ya no está disponible (404): {e}")
                    break
                if intento < INTENTOS_POR_MODELO:
                    print(
                        f"Gemini ({model}) no disponible (intento "
                        f"{intento}/{INTENTOS_POR_MODELO}), reintento en "
                        f"{ESPERA_ENTRE_INTENTOS_SEGUNDOS}s: {e}"
                    )
                    time.sleep(ESPERA_ENTRE_INTENTOS_SEGUNDOS)
                else:
                    print(f"Gemini ({model}) no disponible tras {INTENTOS_POR_MODELO} intentos: {e}")
        if response is not None:
            break
        if idx_modelo < len(modelos) - 1:
            print(f"Rotando al siguiente modelo: {modelos[idx_modelo + 1]}")

    if response is None:
        assert ultimo_error is not None
        raise ultimo_error
    raw = (response.text or "").strip()
    data = json.loads(raw)

    categoria = data.get("categoria_propuesta")
    if categoria not in CATEGORIAS:
        categoria = None

    return Clasificacion(
        es_pedido_acceso=bool(data.get("es_pedido_acceso", False)),
        es_respuesta_pedido=bool(data.get("es_respuesta_pedido", False)),
        etiqueta_evento=data.get("etiqueta_evento"),
        confianza_ia=data.get("confianza_ia"),
        nombre_solicitante=data.get("nombre_solicitante"),
        solicitud_propuesta=data.get("solicitud_propuesta"),
        categoria_propuesta=categoria,
        subcategoria_propuesta=data.get("subcategoria_propuesta"),
    )
