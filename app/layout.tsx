import type { Metadata } from "next";
import { Archivo, JetBrains_Mono, Oswald } from "next/font/google";
import "./globals.css";

const display = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Archivo({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Before the Bulldozer",
  description: "AI salvage scout for Nashville houses slated for demolition.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="concrete min-h-screen antialiased">{children}</body>
    </html>
  );
}
