-- Cache de feriados nacionales de Argentina, alimentado por
-- app/api/feriados/[anio]/route.ts desde la API pública de ArgentinaDatos
-- (api.argentinadatos.com/v1/feriados/{anio} — gratis, sin API key). La
-- ruta la actualiza como máximo una vez por día por año consultado; si ese
-- día la consulta externa falla, sirve la última lista guardada acá en vez
-- de romper el cálculo de plazos.
--
-- No incluye feria judicial (verano/invierno) ni el 16/11 (Día del
-- Empleado Judicial) — esas son reglas propias del Poder Judicial de la
-- Nación, no feriados nacionales, y se mantienen a mano en lib/feriados.ts
-- (la de invierno cambia de fecha cada año por Acordada de la Corte
-- Suprema, no hay API pública que la tenga).
--
-- Ejecutar en el SQL editor de Supabase, mismo proyecto que las demás
-- tablas (uywxcspzavewdyvuvcot).

create table if not exists public.feriados_nacionales_cache (
  anio           integer primary key,
  feriados       jsonb not null,            -- array de { fecha: "YYYY-MM-DD", nombre: string }
  fuente         text not null default 'api', -- 'api' (recién traído de ArgentinaDatos) o 'cache' (se sirvió lo guardado porque la consulta del día falló)
  actualizado_en timestamptz not null default now()
);

-- RLS: mismo criterio "público" que ya se usa en push_subscriptions,
-- candidatos_correo, categorias_custom, etc. — la ruta server-side usa la
-- anon key igual que el resto de la app, así que necesita poder
-- insertar/actualizar.
alter table public.feriados_nacionales_cache enable row level security;

create policy "Acceso público de lectura" on public.feriados_nacionales_cache
  for select using (true);
create policy "Acceso público de inserción" on public.feriados_nacionales_cache
  for insert with check (true);
create policy "Acceso público de actualización" on public.feriados_nacionales_cache
  for update using (true) with check (true);
