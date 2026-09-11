export const metadata = {
  title: "Política de privacidad",
};

export default function Privacidad() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-[var(--fg-soft)]">
      <h1 className="mb-4 text-xl font-semibold text-[var(--foreground)]">
        Política de privacidad
      </h1>
      <p className="mb-4">
        Esta aplicación es una herramienta interna de la oficina para
        registrar y actualizar el estado de los pedidos de acceso a la
        información pública. No está dirigida al público general.
      </p>

      <h2 className="mb-2 mt-6 font-semibold text-[var(--foreground)]">
        Qué datos se manejan
      </h2>
      <p className="mb-2">
        La aplicación guarda el email institucional de las personas que
        inician sesión en el panel, y los datos de cada pedido cargado
        (nombre del solicitante, fecha, contenido de la solicitud,
        categoría, estado y observaciones).
      </p>
      <p className="mb-4">
        Estos datos se almacenan en una base de datos privada (Supabase) y
        se reflejan automáticamente en una hoja de cálculo de Google de uso
        interno, para mantener un registro de control.
      </p>

      <h2 className="mb-2 mt-6 font-semibold text-[var(--foreground)]">
        Acceso a Google Sheets
      </h2>
      <p className="mb-4">
        La aplicación usa la API de Google Sheets únicamente para escribir
        los pedidos registrados en la hoja de cálculo de control. No lee,
        comparte ni usa esos datos para ningún otro fin.
      </p>

      <h2 className="mb-2 mt-6 font-semibold text-[var(--foreground)]">
        Con quién se comparte
      </h2>
      <p className="mb-4">
        No se comparte con terceros. Es de uso exclusivo del personal
        autorizado de la oficina.
      </p>

      <h2 className="mb-2 mt-6 font-semibold text-[var(--foreground)]">Contacto</h2>
      <p>
        <a href="mailto:andresminio@gmail.com" className="text-[var(--accent-hover)] hover:underline">
          andresminio@gmail.com
        </a>
      </p>
    </main>
  );
}
