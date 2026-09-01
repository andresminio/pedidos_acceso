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
  page.tsx                 → página principal (protegida por login)
  api/sync-sheets/route.ts → recibe el webhook y escribe en Google Sheets
components/
  AuthGate.tsx              → login por magic link (Supabase Auth)
  PanelSolicitudes.tsx       → tabla + filtros + edición inline
  SolicitudForm.tsx         → alta de nuevo pedido
lib/
  supabase.ts               → cliente de Supabase (anon key, solo cliente)
  types.ts                  → tipos y estados posibles
supabase/
  schema.sql                → tabla, índices, trigger, RLS
```

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
