-- Candidatos a pedido de acceso detectados por el bot de correo (mail-bot/).
-- Ejecutar en el SQL editor de Supabase, en el mismo proyecto que
-- pedidos_solicitudes (uywxcspzavewdyvuvcot).

create table if not exists public.candidatos_correo (
  id                  uuid primary key default gen_random_uuid(),
  email_uid           text not null unique, -- uid IMAP, evita reprocesar/duplicar
  fecha_correo        timestamptz not null,
  remitente           text not null,
  asunto              text,
  cuerpo_resumen      text, -- lo que se mandó a Gemini (truncado)

  -- Salida de la clasificación (Gemini)
  es_pedido_acceso    boolean not null,
  urgencia            text,          -- alta / media / baja
  confianza_ia        text,          -- nota libre de la IA sobre por qué clasificó así

  -- Campos propuestos, mismo shape que pedidos_solicitudes, para poder
  -- cargarlos con un solo click desde la ventana de revisión
  nombre_solicitante  text,
  fecha_propuesta     date,
  solicitud_propuesta text,
  categoria_propuesta text,
  subcategoria_propuesta text,

  -- Estado del flujo de revisión humana
  estado_revision     text not null default 'pendiente'
                       check (estado_revision in ('pendiente', 'aprobado', 'descartado', 'ya_cargado')),
  pedido_id           uuid references public.pedidos_solicitudes(id), -- se completa al aprobar
  revisado_en         timestamptz,

  procesado_en        timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index if not exists candidatos_correo_estado_idx
  on public.candidatos_correo (estado_revision);

create index if not exists candidatos_correo_fecha_idx
  on public.candidatos_correo (fecha_correo desc);

-- Estado de sincronización: último UID de IMAP procesado, para que el
-- workflow de GitHub Actions no dependa de memoria local entre corridas.
create table if not exists public.mail_sync_state (
  id                  smallint primary key default 1 check (id = 1), -- una sola fila
  ultimo_uid          text,
  ultima_corrida_en   timestamptz,
  ultimo_error        text
);

insert into public.mail_sync_state (id, ultimo_uid)
values (1, null)
on conflict (id) do nothing;

-- RLS: mismo criterio "público" que ya se adoptó para pedidos_solicitudes
-- (migration_remove_auth.sql) — protegido por la oscuridad de la URL del
-- panel, no por login. El bot de GitHub Actions usa la misma anon key.
alter table public.candidatos_correo enable row level security;
alter table public.mail_sync_state enable row level security;

create policy "Acceso público de lectura" on public.candidatos_correo
  for select using (true);
create policy "Acceso público de inserción" on public.candidatos_correo
  for insert with check (true);
create policy "Acceso público de actualización" on public.candidatos_correo
  for update using (true) with check (true);

create policy "Acceso público de lectura" on public.mail_sync_state
  for select using (true);
create policy "Acceso público de actualización" on public.mail_sync_state
  for update using (true) with check (true);
