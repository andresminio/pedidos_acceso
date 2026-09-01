-- Saca el requisito de login: deja que cualquiera con la anon key
-- (o sea, cualquiera que entre a la URL del panel) lea y escriba en la
-- tabla. Correr una sola vez en el SQL editor de Supabase.
--
-- Nota de seguridad: la app ya no pide email/login, así que cualquiera
-- que tenga el link del panel puede ver y modificar los pedidos. Si en
-- algún momento querés volver a restringirlo, avisame.

drop policy if exists "Usuarios autenticados pueden leer" on public.pedidos_solicitudes;
drop policy if exists "Usuarios autenticados pueden insertar" on public.pedidos_solicitudes;
drop policy if exists "Usuarios autenticados pueden actualizar" on public.pedidos_solicitudes;

create policy "Acceso público de lectura"
  on public.pedidos_solicitudes
  for select
  using (true);

create policy "Acceso público de inserción"
  on public.pedidos_solicitudes
  for insert
  with check (true);

create policy "Acceso público de actualización"
  on public.pedidos_solicitudes
  for update
  using (true)
  with check (true);
