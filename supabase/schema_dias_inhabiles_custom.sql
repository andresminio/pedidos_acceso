-- Días inhábiles cargados a mano desde la calculadora de plazos (/plazos):
-- feriados provinciales, paros, asuetos administrativos o cualquier otra
-- fecha puntual que no está en los feriados nacionales ni en las reglas
-- fijas del Poder Judicial de la Nación (fines de semana, feria de
-- verano/invierno, 16/11 — ver lib/feriados.ts).
--
-- Ejecutar en el SQL editor de Supabase, mismo proyecto que las demás
-- tablas (uywxcspzavewdyvuvcot).

create table if not exists public.dias_inhabiles_custom (
  fecha      date primary key,
  motivo     text not null,
  -- Todo inhábil cargado a mano es uno de estos tres tipos — no hay una
  -- categoría "custom" aparte en el calendario de /plazos, se pinta con el
  -- mismo color que corresponda a su tipo (ver lib/feriados.ts).
  tipo       text not null default 'feriado'
             check (tipo in ('feriado', 'feria_judicial', 'inhabil_judicial')),
  created_at timestamptz not null default now()
);

-- RLS: público como el resto de las tablas de este proyecto. La UI de
-- /plazos igual solo muestra el formulario de alta/baja a quien esté
-- logueado (ver lib/auth.tsx), mismo criterio que el resto del panel.
alter table public.dias_inhabiles_custom enable row level security;

create policy "Acceso público de lectura" on public.dias_inhabiles_custom
  for select using (true);
create policy "Acceso público de inserción" on public.dias_inhabiles_custom
  for insert with check (true);
create policy "Acceso público de borrado" on public.dias_inhabiles_custom
  for delete using (true);
