import type { Metadata } from "next";
import "./globals.css";
import "./financeiro.css";

export const metadata: Metadata = {
  title: "Painel Financeiro Alisson",
  description: "Gestão de cobranças e recebimentos da Alisson Finanças.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
