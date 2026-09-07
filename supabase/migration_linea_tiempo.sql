-- Línea de tiempo de eventos por pedido (recepción, reenvío, respuesta de
-- Nora, repregunta del solicitante, etc.), en reemplazo del campo único
-- pedidos_solicitudes.respuesta_texto (que solo alcanzaba para "una
-- respuesta", no para un intercambio con varios pasos).

create table if not exists public.pedido_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_solicitudes(id) on delete cascade,
  fecha date not null,
  etiqueta text not null,
  cuerpo text,
  candidato_correo_id uuid references public.candidatos_correo(id) on delete set null,
  creado_en timestamptz not null default now()
);

alter table public.pedido_eventos enable row level security;

create policy "acceso publico pedido_eventos"
  on public.pedido_eventos
  for all
  using (true)
  with check (true);

create index if not exists pedido_eventos_pedido_id_idx
  on public.pedido_eventos (pedido_id);

-- Campo nuevo para que el bot de correo (mail-bot/classify.py) etiquete
-- qué tipo de evento es un correo detectado como respuesta ("Respuesta de
-- Nora", "Repregunta del solicitante", "Reenvío interno", etc.) — se usa
-- como sugerencia editable al vincular, no como valor fijo.
alter table public.candidatos_correo
  add column if not exists etiqueta_evento text;

-- Migración de datos: los pedidos que YA tienen algo cargado en
-- respuesta_texto (vinculados con el mecanismo viejo, antes de esta
-- tabla) pasan a tener un evento único en pedido_eventos, usando
-- fecha_respuesta como fecha y "Respuesta" como etiqueta genérica (se
-- puede renombrar a mano después desde la línea de tiempo).
insert into public.pedido_eventos (pedido_id, fecha, etiqueta, cuerpo)
select id, coalesce(fecha_respuesta, fecha), 'Respuesta', respuesta_texto
from public.pedidos_solicitudes
where respuesta_texto is not null and trim(respuesta_texto) <> '';
