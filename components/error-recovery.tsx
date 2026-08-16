"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export function ErrorRecovery({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-canvas mx-auto flex min-h-[70svh] max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-muted-foreground">Could not load this page.</p>
      <Button size="lg" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
