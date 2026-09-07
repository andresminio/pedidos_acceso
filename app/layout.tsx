import type { Metadata } from "next";
import "./globals.css";
import VersionBanner from "@/components/VersionBanner";
import PushSetup from "@/components/PushSetup";

export const metadata: Metadata = {
  title: "UEEDA Pedidos de acceso a la información pública",
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
        <PushSetup />
        {children}
      </body>
    </html>
  );
}
