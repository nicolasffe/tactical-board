import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "TacticalPad Studio",
  description:
    "Quadro tático profissional para montar jogadas, treinos e apresentações de futebol.",
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
