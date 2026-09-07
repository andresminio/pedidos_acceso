import type { Metadata } from "next";
import "./globals.css";
import VersionBanner from "@/components/VersionBanner";

export const metadata: Metadata = {
  title: "Pedidos de Acceso a la Información Pública",
  description: "Panel de registro y seguimiento de pedidos de acceso a la información pública",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <VersionBanner />
        {children}
      </body>
    </html>
  );
}
