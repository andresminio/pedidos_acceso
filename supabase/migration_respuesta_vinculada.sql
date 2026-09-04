-- Detección de correos que son la RESPUESTA a un pedido ya cargado (ej:
-- Nora o Prosecretaría mandan el texto que hay que reenviarle al
-- solicitante), en vez de un pedido nuevo. Se vinculan a mano desde el
-- panel de revisión: el usuario busca el pedido correspondiente y lo
-- cierra con esa respuesta.

alter table public.candidatos_correo
  add column if not exists es_respuesta_pedido boolean not null default false;

alter table public.pedidos_solicitudes
  add column if not exists respuesta_texto text;
