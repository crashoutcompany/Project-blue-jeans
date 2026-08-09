"use client";

import { ArrowLeftRight, Check } from "lucide-react";

import type { OutfitLook } from "@/lib/outfits/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function StackCardShell({
  children,
  className,
  style,
  interactive,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/40 shadow-[0_20px_50px_rgba(0,0,0,0.35)]",
        !interactive && "pointer-events-none",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

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
  if (slice.length === 0) return null;

  const [front, ...rest] = slice;
  const frontBusy = Boolean(busyLookId && busyLookId === front.id);
  const controlsDisabled = Boolean(disabled || frontBusy);
  /** Furthest back first (larger depth = more offset). */
  const backLayers = rest.slice().reverse();

  return (
    <div className="relative mx-auto w-full max-w-lg pt-2 pb-[clamp(3rem,8vw,5.5rem)]">
      <div className="relative">
        {backLayers.map((look, idx) => {
          const depth = backLayers.length - idx;
          return (
            <StackCardShell
              key={look.id}
              className="absolute inset-x-0 top-0"
              style={{
                opacity: 0.28 + depth * 0.12,
                transform: `translateY(${depth * 10}px) translateX(${depth * 5}px) scale(${1 - depth * 0.035})`,
                zIndex: depth,
              }}
            >
              <div className="flex h-[min(200px,42vw)] items-stretch gap-0">
                <div className="relative w-[38%] shrink-0 bg-muted/80">
                  {look.imageDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={look.imageDataUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-75"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      Look
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center px-4 py-3">
                  <p className="font-serif text-base text-foreground/85">
                    {look.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {look.description}
                  </p>
                </div>
              </div>
            </StackCardShell>
          );
        })}

        <StackCardShell
          interactive
          className="relative z-20"
          style={{ position: "relative" }}
        >
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-5">
            <div className="relative mx-auto aspect-[3/4] w-[min(200px,42%)] shrink-0 overflow-hidden rounded-xl bg-muted sm:mx-0 sm:w-[38%]">
              {front.imageDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={front.imageDataUrl}
                  alt={front.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Preview
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/50 to-transparent" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
              <div>
                <h3 className="font-serif text-xl leading-tight text-foreground">
                  {front.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {front.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={controlsDisabled}
                  onClick={() => void onApprove(messageId, front)}
                  className={cn(
                    "rounded-full bg-foreground px-5 text-background hover:bg-foreground/90",
                    approvedLookId === front.id &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                >
                  <Check className="mr-1.5 size-4" />
                  {approvedLookId === front.id
                    ? "Saved"
                    : frontBusy
                      ? "Saving…"
                      : "Approve"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={controlsDisabled}
                  className="rounded-full border border-border/80 bg-muted/80 px-5 text-foreground hover:bg-muted"
                  onClick={() => onRemix(front)}
                >
                  <ArrowLeftRight className="mr-1.5 size-4" />
                  Remix
                </Button>
              </div>
            </div>
          </div>
        </StackCardShell>
      </div>
    </div>
  );
}
