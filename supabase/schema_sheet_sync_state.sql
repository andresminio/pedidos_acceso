-- Estado de sincronización con la hoja de Google, independiente de una
-- fila puntual de pedidos_solicitudes (a diferencia de la columna
-- synced_at, esto también se actualiza en un DELETE, donde no hay fila
-- que marcar). Fila única (id=1), actualizada por /api/sync-sheets
-- después de cada sync exitoso (create, update o delete).
-- Correr una sola vez en el SQL editor de Supabase.

create table if not exists public.sheet_sync_state (
  id                        smallint primary key default 1,
  ultima_sincronizacion_en  timestamptz,
  constraint sheet_sync_state_single_row check (id = 1)
);

insert into public.sheet_sync_state (id) values (1)
  on conflict (id) do nothing;

alter table public.sheet_sync_state enable row level security;

create policy "Acceso público de lectura"
  on public.sheet_sync_state
  for select
  using (true);

create policy "Acceso público de actualización"
  on public.sheet_sync_state
  for update
  using (true)
  with check (true);
