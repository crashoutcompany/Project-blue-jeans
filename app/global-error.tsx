"use client";

import { ErrorRecovery } from "@/components/error-recovery";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ErrorRecovery error={error} reset={reset} />
      </body>
    </html>
  );
}
