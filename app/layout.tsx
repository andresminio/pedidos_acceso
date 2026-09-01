import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pedidos de Acceso a la Información Pública",
  description: "Panel de registro y seguimiento de pedidos de acceso a la información pública",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
