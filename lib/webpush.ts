import webpush from "web-push";

// Configura las claves VAPID una sola vez por proceso. Si faltan las env
// vars (todavía no se configuraron en Vercel), lo dejamos sin configurar y
// que falle explícito en /api/push/send en vez de romper el build.
let configurado = false;

export function webpushConfigurado(): boolean {
  if (configurado) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configurado = true;
  return true;
}

export { webpush };
