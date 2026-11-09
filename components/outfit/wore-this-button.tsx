"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markDayWorn } from "@/app/actions/today";
import { Button } from "@/components/ui/button";
import { formatProductWornOn } from "@/lib/time/product-timezone";
import { cn } from "@/lib/utils";

/**
 * "Wore this" toggle for a past or current day's Outfit. Only a confirmed
 * day counts as worn for last worn and Plan my week's repeat guard.
 */
export function WoreThisButton({
  wornOn,
  worn,
  size = "sm",
  className,
  onError,
}: {
  wornOn: string;
  worn: boolean;
  size?: "xs" | "sm";
  className?: string;
  onError?: (message: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Shown immediately; the refreshed server value replaces it.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [seenWorn, setSeenWorn] = useState(worn);
  if (worn !== seenWorn) {
    setSeenWorn(worn);
    setOptimistic(null);
  }
  const isWorn = optimistic ?? worn;
  const day = formatProductWornOn(wornOn);

  return (
    <Button
      type="button"
      size={size}
      variant={isWorn ? "secondary" : "outline"}
      disabled={pending}
      aria-pressed={isWorn}
      aria-label={isWorn ? `Worn on ${day}. Tap to undo` : `Wore this on ${day}`}
      className={cn(className)}
      onClick={() => {
        const next = !isWorn;
        onError?.(null);
        setOptimistic(next);
        startTransition(async () => {
          const res = await markDayWorn(wornOn, next);
          if (!res.ok) {
            setOptimistic(null);
            onError?.(res.message);
            return;
          }
          router.refresh();
        });
      }}
    >
      {isWorn ? <Check aria-hidden /> : null}
      {isWorn ? "Worn" : "Wore this"}
    </Button>
  );
}
