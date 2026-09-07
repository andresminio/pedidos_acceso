import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// Guarda (o actualiza, si el navegador ya estaba suscripto con el mismo
// endpoint) la suscripción de Web Push que manda el cliente al activar
// "Avisos" (ver components/PushSetup.tsx). No requiere el secreto de
// PUSH_SEND_SECRET — eso solo protege el envío, no el alta.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const endpoint: string | undefined = body?.endpoint;
  const p256dh: string | undefined = body?.keys?.p256dh;
  const auth: string | undefined = body?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ endpoint, p256dh, auth }, { onConflict: "endpoint" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Se llama al desactivar los avisos desde el mismo navegador — borra la
// suscripción para no seguir mandándole pushes a un endpoint que ya se
// dio de baja del lado del navegador.
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const endpoint: string | undefined = body?.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: "Falta el endpoint." }, { status: 400 });
  }
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
