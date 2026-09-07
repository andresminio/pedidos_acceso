import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { webpush, webpushConfigurado } from "@/lib/webpush";

export const runtime = "nodejs";

// Lo dispara el Database Webhook de Supabase en cada INSERT sobre
// candidatos_correo (mismo patrón que /api/sync-sheets — ver README).
// Payload estándar de Supabase: { type, table, record, old_record }.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.PUSH_SEND_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!webpushConfigurado()) {
    return NextResponse.json(
      { error: "Faltan las env vars de VAPID en el servidor." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const record = body?.record;

  // Solo avisamos cuando el candidato realmente necesita revisión humana
  // — no en cada mail que el bot guarda para auditoría (ver mail-bot/main.py,
  // que decide estado_revision al insertar: "pendiente" es el único caso
  // que nos interesa acá).
  if (!record || record.estado_revision !== "pendiente") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const titulo = record.es_respuesta_pedido
    ? "Respuesta para vincular"
    : "Nuevo pedido detectado";
  const cuerpo = record.nombre_solicitante || record.remitente || "Revisá el correo nuevo.";

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, enviados: 0 });
  }

  const payload = JSON.stringify({ title: titulo, body: cuerpo, url: "/revision" });

  let enviados = 0;
  const expirados: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        enviados++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        // 404/410 = el navegador dio de baja esa suscripción del lado suyo
        // (desinstaló, borró datos, etc.) — la limpiamos.
        if (status === 404 || status === 410) {
          expirados.push(sub.endpoint);
        } else {
          console.error("Error mandando push:", err);
        }
      }
    })
  );

  if (expirados.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expirados);
  }

  return NextResponse.json({ ok: true, enviados, expirados: expirados.length });
}
