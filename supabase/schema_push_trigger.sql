-- Alternativa a crear el Database Webhook desde la UI de Supabase
-- (Database → Webhooks), que en este proyecto falla con "schema
-- supabase_functions does not exist" — un bug de aprovisionamiento del
-- lado de Supabase, no de este código. Este trigger hace exactamente lo
-- mismo (llamar a /api/push/send en cada INSERT sobre candidatos_correo)
-- pero usando pg_net directo, que ya está activo en Database → Extensions.
--
-- IMPORTANTE: reemplazá <TU-APP> por tu dominio real de Vercel antes de
-- correr esto (ej. pedidos-acceso.vercel.app).
-- IMPORTANTE: reemplazá TU_SECRET_ACA por el mismo valor que pusiste en la
-- variable de entorno PUSH_SEND_SECRET en Vercel.
--
-- Ejecutar en el SQL Editor de Supabase, mismo proyecto que las demás
-- tablas (uywxcspzavewdyvuvcot).

create or replace function public.push_candidato_nuevo()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://pedidos-acceso.vercel.app/api/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'TU_SECRET_ACA'
    ),
    -- Mismo shape que manda el Database Webhook nativo de Supabase
    -- ({type, table, record}), así que app/api/push/send/route.ts no
    -- necesita saber si vino de la UI o de este trigger.
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'candidatos_correo',
      'record', to_jsonb(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists candidatos_correo_push_trigger on public.candidatos_correo;

create trigger candidatos_correo_push_trigger
after insert on public.candidatos_correo
for each row
execute function public.push_candidato_nuevo();
