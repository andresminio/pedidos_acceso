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

create trigger pedidos_solicitudes_sync_trigger
  after insert or update on public.pedidos_solicitudes
  for each row
  execute function public.pedidos_notify_sync();
