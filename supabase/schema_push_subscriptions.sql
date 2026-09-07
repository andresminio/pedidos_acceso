-- Suscripciones de Web Push: una fila por navegador/dispositivo que activó
-- "Activar avisos" en la app (components/PushSetup.tsx). Se usa desde
-- app/api/push/send/route.ts para mandarle un push a cada una cuando entra
-- un candidato nuevo (ver Database Webhook sobre candidatos_correo).
-- Ejecutar en el SQL editor de Supabase, mismo proyecto que las demás
-- tablas (uywxcspzavewdyvuvcot).

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  endpoint      text not null unique, -- identifica de forma única al navegador/dispositivo suscripto
  p256dh        text not null,        -- claves públicas de cifrado que entrega el navegador al suscribirse
  auth          text not null,
  creado_en     timestamptz not null default now(),
  ultimo_uso_en timestamptz
);

-- RLS: mismo criterio "público" que el resto de las tablas de este
-- proyecto (protegido por la oscuridad de la URL del panel, no por login).
alter table public.push_subscriptions enable row level security;

create policy "Acceso público de lectura" on public.push_subscriptions
  for select using (true);
create policy "Acceso público de inserción" on public.push_subscriptions
  for insert with check (true);
create policy "Acceso público de actualización" on public.push_subscriptions
  for update using (true) with check (true);
create policy "Acceso público de borrado" on public.push_subscriptions
  for delete using (true);
