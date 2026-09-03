-- Categorías agregadas a mano desde "+ Agregar categoría" (en el formulario
-- de nuevo pedido y en la revisión de correo), además de las fijas de
-- lib/types.ts (TEMAS). Público como el resto de las tablas de este
-- proyecto (sin login). Correr una sola vez en el SQL editor de Supabase.

create table if not exists public.categorias_custom (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.categorias_custom enable row level security;

create policy "Acceso público de lectura"
  on public.categorias_custom
  for select
  using (true);

create policy "Acceso público de inserción"
  on public.categorias_custom
  for insert
  with check (true);
