-- Falta esta política desde que se sacó el requisito de login
-- (migration_remove_auth.sql agregó select/insert/update públicas, pero no
-- delete). Sin ella, el botón "Eliminar" del panel no borra nada: RLS
-- bloquea el delete en silencio (sin error, 0 filas afectadas).
-- Correr una sola vez en el SQL editor de Supabase.

create policy "Acceso público de eliminación"
  on public.pedidos_solicitudes
  for delete
  using (true);
