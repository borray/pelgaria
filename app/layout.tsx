import type { Metadata } from "next";
import { Manrope, Onest, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import AppShell from "@/components/AppShell";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope" });
const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-jetbrains", weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "//:МОСТ — Портал Пельгарии",
  description: "Электронный документооборот города-государства Пельгария",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${onest.variable} ${jetbrains.variable}`}>
      <body>
        <div className="bg-mesh" aria-hidden="true"><i /></div>
        <div className="bg-grain" aria-hidden="true" />
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
