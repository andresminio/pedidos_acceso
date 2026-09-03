-- Alternativa al Database Webhook del dashboard (roto en este proyecto por
-- falta del schema "supabase_functions"). Hace lo mismo usando pg_net
-- directamente desde un trigger de Postgres.
--
-- Requiere que la extensión pg_net esté habilitada
-- (Database → Extensions → pg_net → Enabled).
--
-- Reemplazá TU_SECRET_ACA por el mismo valor que pusiste en la variable
-- de entorno SYNC_WEBHOOK_SECRET en Vercel.

create or replace function public.pedidos_notify_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://pedidos-acceso.vercel.app/api/sync-sheets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'TU_SECRET_ACA'
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW)
    )
  );
  return NEW;
end;
$$;

drop trigger if exists pedidos_solicitudes_sync_trigger on public.pedidos_solicitudes;

-- El WHEN evita el loop infinito: /api/sync-sheets marca synced_at después
-- de sincronizar, eso es un UPDATE, que dispararía este mismo trigger de
-- nuevo si no lo filtráramos. En un INSERT, OLD es NULL, así que
-- "NEW.col IS DISTINCT FROM OLD.col" da true para cualquier columna con
-- valor (el WHEN se cumple igual, no hace falta tratar INSERT aparte).
create trigger pedidos_solicitudes_sync_trigger
  after insert or update on public.pedidos_solicitudes
  for each row
  when (
    NEW.anio is distinct from OLD.anio
    or NEW.cuatrimestre is distinct from OLD.cuatrimestre
    or NEW.fecha is distinct from OLD.fecha
    or NEW.nombre_solicitante is distinct from OLD.nombre_solicitante
    or NEW.solicitud is distinct from OLD.solicitud
    or NEW.categoria is distinct from OLD.categoria
    or NEW.subcategoria is distinct from OLD.subcategoria
    or NEW.nombre_archivo is distinct from OLD.nombre_archivo
    or NEW.estado is distinct from OLD.estado
    or NEW.subestado is distinct from OLD.subestado
    or NEW.fecha_respuesta is distinct from OLD.fecha_respuesta
    or NEW.observaciones is distinct from OLD.observaciones
  )
  execute function public.pedidos_notify_sync();
