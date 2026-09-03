-- Registro de pedidos de acceso a la información pública
-- Ejecutar en el SQL editor de Supabase

create extension if not exists "pgcrypto";

create table if not exists public.pedidos_solicitudes (
  id                  uuid primary key default gen_random_uuid(),
  anio                integer not null,
  cuatrimestre        smallint not null check (cuatrimestre in (1, 2, 3)),
  fecha               date not null,
  nombre_solicitante  text not null,
  solicitud           text not null,
  categoria           text,
  subcategoria        text,
  nombre_archivo      text,
  estado              text not null default 'Pendiente',
  subestado           text,
  fecha_respuesta     date,
  observaciones       text,
  synced_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists pedidos_solicitudes_anio_cuatrimestre_idx
  on public.pedidos_solicitudes (anio, cuatrimestre);

create index if not exists pedidos_solicitudes_estado_idx
  on public.pedidos_solicitudes (estado);

-- Mantiene updated_at al día, pero solo cuando cambia algo de negocio real.
-- Si no, cada vez que /api/sync-sheets marca synced_at (que también es un
-- UPDATE) este trigger bumpearía updated_at a un instante posterior, y el
-- indicador "al día" del panel (que compara synced_at >= updated_at) daría
-- siempre desactualizado justo después de sincronizar.
create or replace function public.pedidos_set_updated_at()
returns trigger as $$
begin
  if (
    NEW.anio is distinct from OLD.anio
    or NEW.cuatrimestre is distinct from OLD.cuatrimestre
    or NEW.fecha is distinct from OLD.fecha
    or NEW.nombre_solicitante is distinct from OLD.nombre_solicitante
    or NEW.solicitud is distinct from OLD.solicitud
    or NEW.categoria is distinct from OLD.categoria
    or NEW.subcategoria is distinct from OLD.subcategoria
    or NEW.nombre_archivo is distinct from OLD.nombre_archivo
    or NEW.estado is distinct from OLD.estado
    or NEW.subestado is distinct from OLD.subestado
    or NEW.fecha_respuesta is distinct from OLD.fecha_respuesta
    or NEW.observaciones is distinct from OLD.observaciones
  ) then
    new.updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists pedidos_solicitudes_set_updated_at on public.pedidos_solicitudes;
create trigger pedidos_solicitudes_set_updated_at
  before update on public.pedidos_solicitudes
  for each row
  execute function public.pedidos_set_updated_at();

-- RLS: solo usuarios autenticados de la oficina (Supabase Auth) pueden
-- leer/escribir. El panel debe pedir login (magic link o email+password)
-- antes de mostrar datos; el cliente usa siempre la anon key, nunca la
-- service role key.
alter table public.pedidos_solicitudes enable row level security;

create policy "Usuarios autenticados pueden leer"
  on public.pedidos_solicitudes
  for select
  using (auth.role() = 'authenticated');

create policy "Usuarios autenticados pueden insertar"
  on public.pedidos_solicitudes
  for insert
  with check (auth.role() = 'authenticated');

create policy "Usuarios autenticados pueden actualizar"
  on public.pedidos_solicitudes
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
