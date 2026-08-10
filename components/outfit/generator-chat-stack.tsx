"use client";

import { useState } from "react";
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight } from "lucide-react";

import type { OutfitLook } from "@/lib/outfits/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GeneratorChatStack({
  messageId,
  looks,
  approvedLookId,
  onApprove,
  onRemix,
  disabled,
  busyLookId,
}: {
  messageId: string;
  looks: OutfitLook[];
  approvedLookId: string | null;
  onApprove: (messageId: string, look: OutfitLook) => void | Promise<void>;
  onRemix: (look: OutfitLook) => void;
  disabled?: boolean;
  /** When saving this look to the archive, disable only its actions. */
  busyLookId?: string | null;
}) {
  const slice = looks.slice(0, 3);
  // Reset via parent `key={messageId}` remount — do not sync index in an effect.
  const [index, setIndex] = useState(0);

  if (slice.length === 0) return null;

  const safeIndex = Math.min(index, slice.length - 1);
  const look = slice[safeIndex]!;
  const lookBusy = Boolean(busyLookId && busyLookId === look.id);
  const controlsDisabled = Boolean(disabled || lookBusy);
  const multi = slice.length > 1;

  function go(delta: number) {
    setIndex((i) => {
      const next = i + delta;
      if (next < 0) return slice.length - 1;
      if (next >= slice.length) return 0;
      return next;
    });
  }

  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/40 shadow-[0_20px_50px_rgba(0,0,0,0.35)]",
        )}
        aria-roledescription="carousel"
        aria-label="Generated outfit looks"
      >
        <div
          key={look.id}
          className="flex animate-in fade-in duration-200 flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-5"
        >
          <div className="relative mx-auto aspect-[3/4] w-[min(200px,42%)] shrink-0 overflow-hidden rounded-xl bg-muted sm:mx-0 sm:w-[38%]">
            {look.imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={look.imageDataUrl}
                alt={look.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
                <p className="text-sm text-muted-foreground">Preview</p>
                <p className="text-[0.65rem] leading-snug text-muted-foreground/80">
                  Image unavailable — Approve still saves the pieces
                </p>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/50 to-transparent" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
            <div>
              {multi ? (
                <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Look {safeIndex + 1} of {slice.length}
                </p>
              ) : null}
              <h3 className="font-serif text-xl leading-tight text-foreground">
                {look.title}
              </h3>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {look.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={controlsDisabled}
                onClick={() => void onApprove(messageId, look)}
                className={cn(
                  "rounded-full bg-foreground px-5 text-background hover:bg-foreground/90",
                  approvedLookId === look.id &&
                    "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                <Check className="mr-1.5 size-4" />
                {approvedLookId === look.id
                  ? "Saved"
                  : lookBusy
                    ? "Saving…"
                    : "Approve"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={controlsDisabled}
                className="rounded-full border border-border/80 bg-muted/80 px-5 text-foreground hover:bg-muted"
                onClick={() => onRemix(look)}
              >
                <ArrowLeftRight className="mr-1.5 size-4" />
                Remix
              </Button>
            </div>
          </div>
        </div>
      </div>

      {multi ? (
        <div className="mt-3 flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            disabled={disabled}
            onClick={() => go(-1)}
            aria-label="Previous look"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-1.5" aria-label="Look pages">
            {slice.map((item, i) => (
              <button
                key={item.id}
                type="button"
                aria-current={i === safeIndex ? "true" : undefined}
                aria-label={`Show look ${i + 1}`}
                disabled={disabled}
                onClick={() => setIndex(i)}
                className={cn(
                  "size-2 rounded-full transition-colors",
                  i === safeIndex
                    ? "bg-foreground"
                    : "bg-muted-foreground/35 hover:bg-muted-foreground/55",
                )}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            disabled={disabled}
            onClick={() => go(1)}
            aria-label="Next look"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
