import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const sans = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
});
const mono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "//:МОСТ — Реестр объектов",
  description: "Федеральный реестр объектов Пельгарии",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Prevent theme flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t)}catch(e){}` }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
