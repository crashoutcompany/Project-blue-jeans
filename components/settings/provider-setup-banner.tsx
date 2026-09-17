"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProviderSetupBanner({
  missingGemini,
  missingUploadThing,
}: {
  missingGemini: boolean;
  missingUploadThing: boolean;
}) {
  if (!missingGemini && !missingUploadThing) return null;

  const parts: string[] = [];
  if (missingUploadThing) parts.push("UploadThing to add photos");
  if (missingGemini) parts.push("Google AI Studio to plan looks");

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <p className="text-sm text-muted-foreground">
        Connect {parts.join(" and ")} in Settings.
      </p>
      <Link
        href="/settings"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
      >
        Open Settings
      </Link>
    </div>
  );
}
