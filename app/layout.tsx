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
    "Your personal fashion curator—digital closet, intelligent styling, and a living style profile.",
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
      <head>
        {/* Google-hosted icon font; not available via next/font */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- Material Symbols */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
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
