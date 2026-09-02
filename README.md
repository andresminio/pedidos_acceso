# Pedidos de Acceso a la Información Pública

Panel para registrar y actualizar pedidos de acceso a la información pública.
Next.js 16 + Supabase (Postgres) como fuente de verdad, con sincronización
idempotente hacia una hoja de Google Sheets en cada alta/actualización.

## 1. Supabase

Tu proyecto: `uywxcspzavewdyvuvcot`
URL del proyecto: `https://uywxcspzavewdyvuvcot.supabase.co`

1. Andá a [supabase.com/dashboard/project/uywxcspzavewdyvuvcot](https://supabase.com/dashboard/project/uywxcspzavewdyvuvcot).
2. Abrí **SQL Editor** → pegá el contenido de `supabase/schema.sql` → **Run**.
   Esto crea la tabla `pedidos_solicitudes`, los índices, el trigger de
   `updated_at` y las políticas de RLS (solo usuarios autenticados
   leen/escriben). Si ya habías corrido una versión anterior con la tabla
   llamada `solicitudes`, corré en cambio `supabase/migration_rename_pedidos.sql`
   una sola vez para renombrarla (no vuelvas a correr `schema.sql` sobre
   una base que ya tiene la tabla vieja).
3. En **Project Settings → API** copiá:
   - `Project URL` → va en `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. En **Authentication → Providers** confirmá que **Email** (magic link /
   OTP) esté habilitado — es como entra el equipo de la oficina al panel
   (no hay usuario/contraseña propio, el login es con el email
   institucional).
5. En **Authentication → URL Configuration**, agregá la URL de producción
   de Vercel (paso 4) a **Redirect URLs** cuando la tengas.

## 2. Google Sheets (autenticación OAuth — sin service account)

Tu organización de Google Cloud bloquea la creación de claves de service
account (`iam.disableServiceAccountKeyCreation`), así que en vez de eso
la app se autentica como tu propia cuenta de Google vía OAuth. No hace
falta compartir la hoja con nadie — actúa como si fueras vos.

1. Creá (o reusá) una hoja de cálculo para el registro. Copiá su ID (la
   parte de la URL entre `/d/` y `/edit`) → `GOOGLE_SHEET_ID`.
2. En [Google Cloud Console](https://console.cloud.google.com/) → **APIs
   & Services → Library** → buscá "Google Sheets API" → **Enable** (si no
   lo hiciste ya).
3. **APIs & Services → OAuth consent screen**: si no está configurada,
   armala como **Internal** (si tu org lo permite) o **External** con tu
   propio email como test user. No hace falta publicarla.
4. **APIs & Services → Credentials → Create Credentials → OAuth client
   ID** → tipo de aplicación **Desktop app** (este tipo no choca con la
   política que bloquea las service accounts). Al crearlo te muestra:
   - `Client ID` → `GOOGLE_OAUTH_CLIENT_ID`
   - `Client secret` → `GOOGLE_OAUTH_CLIENT_SECRET`
5. Conseguí un **refresh token** una sola vez, usando esas credenciales,
   con el scope de Sheets. La forma más simple es con el [OAuth
   Playground de Google](https://developers.google.com/oauthplayground):
   - Click en el ícono de engranaje (arriba a la derecha) → tildá **"Use
     your own OAuth credentials"** → pegá tu `Client ID` y `Client
     secret`.
   - En el panel izquierdo, en el campo de scope manual, pegá
     `https://www.googleapis.com/auth/spreadsheets` → **Authorize APIs**.
   - Iniciá sesión con la cuenta de Google que sea dueña o editora de la
     hoja de cálculo.
   - En el paso 2, click **"Exchange authorization code for tokens"**.
   - Copiá el **Refresh token** que aparece → `GOOGLE_OAUTH_REFRESH_TOKEN`.
6. Definí `SYNC_WEBHOOK_SECRET` con cualquier string largo y aleatorio
   (por ejemplo `openssl rand -hex 32`) — valida que las llamadas a
   `/api/sync-sheets` vengan realmente de tu webhook de Supabase.

Si más adelante tu org habilita las service accounts, o preferís no
depender de tu cuenta personal, se puede volver a ese esquema — avisame
y actualizo `getSheetsClient()` en `app/api/sync-sheets/route.ts`.

## 3. Vercel

1. Importá este repo en Vercel.
2. En **Settings → Environment Variables** cargá todas las variables de
   `.env.example` con los valores de los pasos anteriores.
3. Deploy. Anotá la URL final (ej. `https://pedidos-acceso.vercel.app`).

## 4. Conectar el sync: Database Webhook en Supabase

1. En Supabase: **Database → Webhooks → Create a new hook**.
2. Tabla: `pedidos_solicitudes`. Eventos: `INSERT` y `UPDATE`.
3. Tipo: **HTTP Request**.
   URL: `https://<tu-app>.vercel.app/api/sync-sheets`
4. Headers: agregá `x-webhook-secret: <el mismo valor de SYNC_WEBHOOK_SECRET>`.
5. Guardá. A partir de acá, cada alta o edición de un pedido dispara el
   webhook, que hace upsert por `id` en la hoja: si la fila ya existe la
   actualiza, si no la agrega. Es idempotente — reintentos del webhook no
   duplican filas, y el estado en la hoja siempre queda igual al de
   Supabase, incluyendo cuando pasa a "Cerrado".

## 5. Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar con los valores reales
npm run dev
```

## Estructura

```
app/
  page.tsx                 → página principal
  revision/page.tsx        → cola de candidatos detectados en el correo
  api/sync-sheets/route.ts → recibe el webhook y escribe en Google Sheets
components/
  AuthGate.tsx              → login por magic link (Supabase Auth)
  PanelSolicitudes.tsx       → tabla + filtros + edición inline
  SolicitudForm.tsx         → alta de nuevo pedido
  PanelCandidatos.tsx        → cola de revisión de candidatos de correo
lib/
  supabase.ts               → cliente de Supabase (anon key, solo cliente)
  types.ts                  → tipos y estados posibles
supabase/
  schema.sql                        → tabla pedidos_solicitudes, índices, trigger, RLS
  schema_candidatos_correo.sql      → tablas candidatos_correo + mail_sync_state
mail-bot/
  ingest.py                  → conexión IMAP, trae mails nuevos
  classify.py                → clasificación con Gemini Flash
  supabase_client.py         → estado de sync, dedupe, upsert
  main.py                    → orquestador (lo corre el workflow)
  contexto_clasificacion.md  → reglas editables de qué incluir/excluir
  test_imap_connection.py    → script de test manual, sin dependencias
.github/workflows/
  check_mail.yml            → cron cada 30 min
```

## 6. Bot de correo → candidatos a pedido (mail-bot/)

Segunda ventana del proyecto: un bot que lee el correo institucional
(Zimbra vía IMAP), usa Gemini Flash para detectar pedidos de acceso no
registrados, y los deja como "candidatos" en `/revision` dentro del
panel para que los cargues con un click (o los descartes). Corre solo
vía GitHub Actions — no hay servidor propio que mantener.

### 6.1 Supabase

1. En el mismo proyecto (`uywxcspzavewdyvuvcot`), SQL Editor → pegá
   `supabase/schema_candidatos_correo.sql` → **Run**. Crea las tablas
   `candidatos_correo` y `mail_sync_state`, con la misma política de RLS
   "pública" que ya tiene `pedidos_solicitudes`.

### 6.2 Probar la conexión IMAP antes de todo

Si la cuenta tiene verificación en dos pasos activada, la contraseña
normal de la cuenta NO va a andar por IMAP — hace falta generar un
**código de acceso para aplicaciones** (a veces llamado "contraseña de
aplicación") desde la configuración de seguridad de la cuenta, y usar
ese código como contraseña acá (y después como `IMAP_PASS`). La
contraseña habitual de login sigue intacta, esto es un código aparte
solo para este uso.

Antes de cargar nada en GitHub, confirmá que el host/puerto/usuario
andan:

```bash
cd mail-bot
python3 test_imap_connection.py
```

Te pide usuario y contraseña de forma interactiva (no se guardan en
ningún lado). Si falla, probá otro puerto/host:

```bash
IMAP_HOST=webmail.pjn.gov.ar IMAP_PORT=993 python3 test_imap_connection.py
```

### 6.3 Gemini API key

Conseguí una API key en [Google AI Studio](https://aistudio.google.com/apikey).
El bot usa el alias `gemini-flash-latest`, así que siempre pega contra el
modelo Flash vigente sin que haga falta actualizar código cuando Google
saca una versión nueva (se puede fijar una versión específica con la
variable `GEMINI_MODEL` si en algún momento se prefiere).

### 6.4 Ajustar qué clasifica como pedido: `mail-bot/contexto_clasificacion.md`

Este archivo se manda tal cual dentro del prompt de Gemini en cada
corrida. Ahí podés ir anotando, con el tiempo:

- Remitentes/dominios que **nunca** son pedidos de acceso (spam,
  notificaciones automáticas, listas internas).
- Remitentes/dominios que **siempre** son pedidos, aunque el texto sea
  ambiguo.
- Cualquier otra aclaración de criterio.

Editalo y hacé commit — no requiere redeploy, el próximo run del
workflow ya lo lee.

### 6.5 GitHub Secrets

En **Settings → Secrets and variables → Actions** del repo, cargá:

| Secret | Valor |
| --- | --- |
| `IMAP_HOST` | confirmado en el paso 6.2 (ej. `webmail.pjn.gov.ar`) |
| `IMAP_PORT` | confirmado en el paso 6.2 (ej. `993`) |
| `IMAP_USER` | mail institucional completo |
| `IMAP_PASS` | contraseña de esa cuenta, o el código de acceso para aplicaciones si tiene verificación en dos pasos (ver paso 6.2) |
| `GEMINI_API_KEY` | de Google AI Studio |
| `SUPABASE_URL` | la misma `NEXT_PUBLIC_SUPABASE_URL` del panel |
| `SUPABASE_KEY` | la misma `NEXT_PUBLIC_SUPABASE_ANON_KEY` del panel (RLS es pública, no hace falta la service role key) |

El workflow (`.github/workflows/check_mail.yml`) corre cada 30 minutos
(`cron: "*/30 * * * *"`) y también se puede disparar a mano desde la
pestaña **Actions → Check mail → Run workflow**.

### 6.6 Cómo revisar los candidatos

Entrá a `/revision` en el panel (link "Revisión de correo →" desde la
home). Cada candidato pendiente muestra los campos que propuso la IA,
editables. **Cargar como pedido** lo inserta en `pedidos_solicitudes`
(aparece inmediatamente en el panel principal y se sincroniza a Sheets
como cualquier alta manual). **Descartar** lo saca de la cola sin crear
nada.

Los mails que la IA no considera pedidos, o que matchean por
nombre+fecha con un pedido ya cargado (dedupe simple), ni siquiera
aparecen en la cola — quedan guardados igual en `candidatos_correo` por
las dudas, pero no generan trabajo de revisión.

### 6.7 Notas de comportamiento

- Nunca marca mails como leídos en el servidor.
- Si falla la conexión IMAP o la clasificación, el workflow no avanza
  el último UID procesado — el próximo run reintenta esos mails, no se
  pierden silenciosamente.
- Correr el workflow dos veces sobre el mismo estado no duplica
  candidatos (upsert por `email_uid`).

## Notas de seguridad

- La `anon key` de Supabase es pública por diseño; la protección real la
  da RLS (solo usuarios autenticados leen/escriben) — no cambiar eso sin
  entender el impacto.
- `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` y
  `SYNC_WEBHOOK_SECRET` son secretos: viven solo como env vars de Vercel
  (tipo **Secret**), nunca en código ni en el cliente. El refresh token
  no expira solo, pero se puede revocar en cualquier momento desde
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
  si hace falta.
