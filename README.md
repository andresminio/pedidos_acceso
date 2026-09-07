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

### 4.1 Carga masiva por SQL (importar muchos pedidos de una)

El trigger dispara **una llamada al webhook por cada fila** que se inserta.
Con una carga masiva (decenas o cientos de filas en un solo `INSERT`), eso
satura la cuota de lecturas de la API de Google Sheets y la mayoría de las
llamadas rebota con error 500 — pasó una vez con una importación de 532
filas. Para evitarlo:

1. Antes del `INSERT` masivo, desactivá el trigger de insert:
   ```sql
   alter table public.pedidos_solicitudes disable trigger pedidos_solicitudes_sync_insert;
   ```
2. Corré el `INSERT` masivo.
3. Reactivá el trigger:
   ```sql
   alter table public.pedidos_solicitudes enable trigger pedidos_solicitudes_sync_insert;
   ```
4. Sincronizá la hoja entera de una — llamá a `/api/resync-sheets` (reescribe
   toda la hoja desde Supabase en una sola lectura + escritura, no dispara la
   cuota):
   ```
   POST https://<tu-app>.vercel.app/api/resync-sheets?secret=<SYNC_WEBHOOK_SECRET>
   ```
   Se puede pegar esa URL directo en el navegador (usa POST igual, así que
   hace falta algo que mande POST — un `curl -X POST "<url>"`, o Postman/Thunder
   Client. Un simple `fetch` en la consola del navegador también sirve).

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
  api/push/subscribe/route.ts → alta/baja de suscripciones de Web Push
  api/push/send/route.ts   → recibe el webhook y manda el push a todos
components/
  AuthGate.tsx              → login por magic link (Supabase Auth)
  PanelSolicitudes.tsx       → tabla + filtros + edición inline
  SolicitudForm.tsx         → alta de nuevo pedido
  PanelCandidatos.tsx        → cola de revisión de candidatos de correo
  BotonRevisarCorreo.tsx     → botón "Revisar correo ahora" (dispara el watcher)
  PushSetup.tsx              → botón "Activar avisos" (Web Push, ver sección 7)
  VersionBanner.tsx          → popup "hay una versión nueva" tras un deploy
lib/
  supabase.ts               → cliente de Supabase (anon key, solo cliente)
  types.ts                  → tipos y estados posibles
  webpush.ts                 → configuración de claves VAPID para web-push
public/
  sw.js                      → service worker (recibe el push, muestra la notificación)
supabase/
  schema.sql                        → tabla pedidos_solicitudes, índices, trigger, RLS
  schema_candidatos_correo.sql      → tablas candidatos_correo + mail_sync_state
  schema_revision_triggers.sql      → tabla revision_triggers (botón ↔ watcher)
  schema_push_subscriptions.sql     → tabla push_subscriptions (Web Push)
mail-bot/
  ingest.py                  → conexión IMAP, trae mails nuevos
  classify.py                → clasificación con Gemini Flash
  supabase_client.py         → estado de sync, dedupe, upsert
  main.py                    → orquestador (carga mail-bot/.env y corre todo)
  contexto_clasificacion.md  → reglas editables de qué incluir/excluir
  test_imap_connection.py    → script de test manual, sin dependencias
  revisar_correo.bat         → doble-click para correr el bot una vez
  watcher.py                 → escucha el botón del panel y dispara el bot
  iniciar_escucha.bat        → doble-click para dejar el watcher corriendo
  .env.example               → plantilla de credenciales locales
.github/workflows/
  check_mail.yml            → desactivado, ver nota abajo
```

## 6. Bot de correo → candidatos a pedido (mail-bot/)

Segunda ventana del proyecto: un bot que lee el correo institucional
(Zimbra vía IMAP), usa Gemini Flash para detectar pedidos de acceso no
registrados, y los deja como "candidatos" en `/revision` dentro del
panel para que los cargues con un click (o los descartes).

**Importante — por qué no es un cron en la nube:**
`webmail.pjn.gov.ar` solo es accesible desde la red interna del
organismo (VPN), y tanto los runners de GitHub Actions como el panel en
Vercel corren en la nube pública — ninguno de los dos puede llegar a
esa red. Por eso quien procesa el correo tiene que ser una máquina dentro
de esa red: tu PC, programada con el Programador de tareas de Windows
(ver 6.4) para que corra sola cada 2 horas mientras esté prendida y
conectada a la VPN. `.github/workflows/check_mail.yml` queda en el repo
pero desactivado (documentado ahí mismo), por si en el futuro se
consigue un runner self-hosted dentro de la red interna.

### 6.1 Supabase

1. En el mismo proyecto (`uywxcspzavewdyvuvcot`), SQL Editor → pegá
   `supabase/schema_candidatos_correo.sql` → **Run**. Crea las tablas
   `candidatos_correo` y `mail_sync_state`, con la misma política de RLS
   "pública" que ya tiene `pedidos_solicitudes`.

### 6.2 Certificado SSL del servidor

`webmail.pjn.gov.ar` usa un certificado autofirmado (típico en
infraestructura interna). Decisión tomada: el bot **no verifica** ese
certificado, en vez de pinnear uno — la conexión ya viaja por una red
controlada (VPN/intranet del organismo), no por internet abierto. Si en
algún momento el organismo pone un certificado válido, se puede volver
a exigir verificación seteando `IMAP_VERIFY_SSL=1` en `mail-bot/.env`.

### 6.3 Configurar credenciales (una sola vez)

```bash
cd mail-bot
copy .env.example .env    # (en PowerShell: cp .env.example .env)
```

Completá `mail-bot/.env` con: host/puerto IMAP (ya confirmados:
`webmail.pjn.gov.ar` / `993`), tu usuario, y la contraseña — o el
**código de acceso para aplicaciones** si la cuenta tiene verificación
en dos pasos (la contraseña normal no funciona por IMAP en ese caso),
más la API key de Gemini ([Google AI Studio](https://aistudio.google.com/apikey))
y la misma `SUPABASE_URL` / `SUPABASE_KEY` (anon key) que usa el panel.

`mail-bot/.env` está en `.gitignore` — nunca se sube al repo.

El bot prueba `gemini-3.5-flash-lite` y, si está saturado, rota a
`gemini-3.6-flash` (se puede fijar una versión específica con
`GEMINI_MODEL` en el `.env` si en algún momento se prefiere). Se sacó el
alias `gemini-flash-latest` de la lista — en la práctica siempre devolvía
503 (saturado) y solo hacía perder tiempo antes de rotar al modelo que sí
respondía.

### 6.4 Automatizarlo: Programador de tareas de Windows (cada 2hs)

Se evaluó un botón "Revisar correo ahora" en el panel + un watcher
escuchando todo el tiempo (el código quedó en el repo, marcado como "NO
EN USO", por si se quiere retomar), pero se optó por algo más simple:
que `mail-bot\revisar_correo.bat` se ejecute solo cada 2 horas con el
Programador de tareas de Windows. Corre unos segundos, guarda lo que
encontró en Supabase, y se cierra — no hace falta dejar nada abierto ni
a la vista. El panel siempre muestra lo último que hay en la tabla, sin
ningún paso adicional.

**Cómo configurarlo:**

1. Abrí el **Programador de tareas** de Windows (buscalo en el menú
   inicio: "Task Scheduler" / "Programador de tareas").
2. **Crear tarea básica** → nombre: "Revisar correo pedidos de acceso".
3. Desencadenador: **Diariamente**, y en las opciones avanzadas tildá
   "Repetir la tarea cada" → **2 horas**, durante "1 día" (para que se
   repita indefinidamente).
4. Acción: **Iniciar un programa**. En "Programa o script" poné la ruta
   a `revisar_correo.bat` (por ejemplo
   `D:\wfolder\pedidos_acceso\mail-bot\revisar_correo.bat`), y en
   "Iniciar en" poné la carpeta `D:\wfolder\pedidos_acceso\mail-bot`
   (importante: si no, no encuentra el `.env` ni el resto de los
   archivos).
5. Terminá el asistente. Podés probarla ya mismo: clic derecho sobre la
   tarea creada → **Ejecutar**.

Esto solo funciona en los ratos en que tu PC está prendida y conectada
a la VPN — si está apagada a las 14hs, esa corrida de las 14hs
simplemente no pasa, y la próxima vez que la prendas (conectada a la
VPN) retoma desde donde quedó (no se pierde nada, ver 6.7).

Para correrlo a mano en cualquier momento (sin esperar la próxima
corrida programada): doble-click en `mail-bot\revisar_correo.bat`, o
`python main.py` desde la carpeta `mail-bot`.

Para probar solo la conexión IMAP, sin clasificar nada:

```bash
cd mail-bot
python test_imap_connection.py
```

### 6.5 Ajustar qué clasifica como pedido: `mail-bot/contexto_clasificacion.md`

Este archivo se manda tal cual dentro del prompt de Gemini en cada
corrida. Ahí podés ir anotando, con el tiempo:

- Remitentes/dominios que **nunca** son pedidos de acceso (spam,
  notificaciones automáticas, listas internas).
- Remitentes/dominios que **siempre** son pedidos, aunque el texto sea
  ambiguo.
- Cualquier otra aclaración de criterio.

Editalo cuando quieras — se lee en cada corrida, no requiere reinstalar
nada.

**Ahorro de costos:** la sección "Remitentes a excluir siempre" es la
única que se procesa antes de llamar a Gemini — si un mail matchea
alguna de esas líneas, el bot ni siquiera gasta la llamada a la IA, lo
descarta directo. Las otras dos secciones son solo contexto que se le
pasa a Gemini como texto, no filtran nada por su cuenta.

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
- Si falla la conexión IMAP o la clasificación, no avanza el último UID
  procesado — la próxima corrida reintenta esos mails, no se pierden
  silenciosamente.
- Correr `revisar_correo.bat` dos veces sobre el mismo estado no duplica
  candidatos (upsert por `email_uid`).
- No verifica el certificado SSL del servidor (ver 6.2) — asumido
  aceptable porque la conexión viaja por la red interna/VPN, no por
  internet abierto.

## 7. Avisos push (Web Push)

Cada persona que instala la app (`MaryBot`, ver PWA arriba) puede activar
avisos en su propia PC con el botón flotante "🔔 Activar avisos" (abajo a
la izquierda). Es por navegador/dispositivo — activarlo en tu PC no avisa
a nadie más, cada compañera tiene que hacerlo en la suya. Cuando
`mail-bot` deja un candidato nuevo en `candidatos_correo` con
`estado_revision = "pendiente"`, todos los navegadores suscriptos reciben
una notificación nativa (con la app cerrada también), vía
`app/api/push/send/route.ts`.

### 7.1 Supabase

1. SQL Editor → pegá `supabase/schema_push_subscriptions.sql` → **Run**.
   Crea `push_subscriptions` (una fila por navegador suscripto).

### 7.2 Claves VAPID y secreto de envío

En **Vercel → Settings → Environment Variables** agregá:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — clave pública VAPID (viaja al cliente).
- `VAPID_PRIVATE_KEY` — clave privada VAPID (**secreto**).
- `VAPID_SUBJECT` — `mailto:tu-email@lo-que-uses` (lo exige el estándar
  Web Push, no se usa para mandar mail).
- `PUSH_SEND_SECRET` — string random largo, valida que `/api/push/send`
  lo llame realmente el webhook de Supabase (mismo criterio que
  `SYNC_WEBHOOK_SECRET`).

Si hace falta regenerar el par de claves VAPID:

```bash
node -e "
const c=require('crypto');
const {publicKey,privateKey}=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const b64url=b=>b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const pj=publicKey.export({format:'jwk'});
const pub=Buffer.concat([Buffer.from([4]),Buffer.from(pj.x,'base64'),Buffer.from(pj.y,'base64')]);
const priv=Buffer.from(privateKey.export({format:'jwk'}).d,'base64');
console.log('PUBLIC:',b64url(pub));
console.log('PRIVATE:',b64url(priv));
"
```

### 7.3 Database Webhook en Supabase (dispara el envío)

1. **Database → Webhooks → Create a new hook**.
2. Tabla: `candidatos_correo`. Eventos: solo **INSERT** (no UPDATE — si no,
   reavisa en cada edición del candidato).
3. Tipo: **HTTP Request**, método **POST**.
   URL: `https://<tu-app>.vercel.app/api/push/send`
4. Headers: `x-webhook-secret: <el mismo valor de PUSH_SEND_SECRET>`.
5. Guardá. El endpoint filtra solo, así que aunque el webhook dispare en
   cada INSERT (incluidos los que quedan como `ya_cargado` o
   `descartado`), solo se manda push cuando `estado_revision === "pendiente"`.

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
