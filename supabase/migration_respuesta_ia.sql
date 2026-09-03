-- Borrador de respuesta generado por IA, editable a mano. Solo tiene
-- sentido cuando el pedido viene de un correo importado (candidatos_correo
-- con pedido_id = este pedido), porque ahí sí tenemos el mail original
-- como contexto para redactar la respuesta.
-- Correr una sola vez en el SQL editor de Supabase.

alter table public.pedidos_solicitudes
  add column if not exists respuesta_ia_borrador text;
