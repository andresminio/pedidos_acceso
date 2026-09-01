-- Migración: prefija los objetos de "solicitudes" con "pedidos_"
-- para identificar a qué proyecto pertenecen.
-- Ejecutar una sola vez en el SQL editor de Supabase (sobre la base
-- donde ya corriste supabase/schema.sql).

alter table if exists public.solicitudes
  rename to pedidos_solicitudes;

alter index if exists solicitudes_anio_cuatrimestre_idx
  rename to pedidos_solicitudes_anio_cuatrimestre_idx;

alter index if exists solicitudes_estado_idx
  rename to pedidos_solicitudes_estado_idx;

alter trigger solicitudes_set_updated_at
  on public.pedidos_solicitudes
  rename to pedidos_solicitudes_set_updated_at;

alter function public.set_updated_at()
  rename to pedidos_set_updated_at;
