import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist_Mono, Manrope, Noto_Serif } from "next/font/google";

import { NeonAuthProvider } from "@/components/auth/neon-auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Digital Atelier",
  description:
    "Your personal fashion curator—digital closet and intelligent styling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${notoSerif.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <NeonAuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <Suspense fallback={<div className="min-h-svh bg-background" />}>
              <TooltipProvider>{children}</TooltipProvider>
            </Suspense>
          </ThemeProvider>
        </NeonAuthProvider>
      </body>
    </html>
  );
}
