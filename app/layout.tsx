import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "TacticalPad Studio",
  description:
    "Quadro tatico profissional para montar jogadas, treinos e apresentacoes de futebol.",
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
