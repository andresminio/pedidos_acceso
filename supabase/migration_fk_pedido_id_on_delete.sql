-- candidatos_correo.pedido_id no tenía ON DELETE, así que Postgres bloqueaba
-- borrar un pedido si algún candidato de correo quedó vinculado a él (el
-- que se "Cargó como pedido" desde /revision). Con ON DELETE SET NULL, al
-- borrar el pedido el candidato no se borra — solo pierde el vínculo
-- (pedido_id vuelve a null), queda como historial.
-- Correr una sola vez en el SQL editor de Supabase.

alter table public.candidatos_correo
  drop constraint if exists candidatos_correo_pedido_id_fkey;

alter table public.candidatos_correo
  add constraint candidatos_correo_pedido_id_fkey
  foreign key (pedido_id)
  references public.pedidos_solicitudes(id)
  on delete set null;
