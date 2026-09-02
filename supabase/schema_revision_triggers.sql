-- NO EN USO — se optó por Programador de tareas de Windows (cada 2hs)
-- en vez del botón + watcher. No hace falta correr este SQL. Se deja
-- por si se quiere volver a este modelo más adelante. Ver README, 6.

-- Señal para el botón "Revisar correo ahora" del panel. El panel corre
-- en la nube y no puede llegar al webmail interno, así que en vez de
-- disparar el IMAP directo, deja un pedido acá — y el watcher que corre
-- en una PC dentro de la red (mail-bot/watcher.py) lo detecta y procesa.
-- Ejecutar en el SQL editor de Supabase, mismo proyecto que las tablas
-- anteriores.

create table if not exists public.revision_triggers (
  id             uuid primary key default gen_random_uuid(),
  solicitado_en  timestamptz not null default now(),
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente', 'procesando', 'completado', 'error')),
  mensaje        text,
  completado_en  timestamptz
);

create index if not exists revision_triggers_estado_idx
  on public.revision_triggers (estado, solicitado_en desc);

alter table public.revision_triggers enable row level security;

create policy "Acceso público de lectura" on public.revision_triggers
  for select using (true);
create policy "Acceso público de inserción" on public.revision_triggers
  for insert with check (true);
create policy "Acceso público de actualización" on public.revision_triggers
  for update using (true) with check (true);
