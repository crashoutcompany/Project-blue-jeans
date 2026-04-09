import { Heart } from "lucide-react";

import type { OutfitLook } from "@/lib/mock/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function OutfitCard({
  look,
  variant = "compact",
  className,
}: {
  look: OutfitLook;
  variant?: "featured" | "compact";
  className?: string;
}) {
  if (variant === "featured") {
    return (
      <Card
        className={cn(
          "overflow-hidden border-0 bg-card shadow-[0_12px_40px_rgba(26,28,27,0.06)]",
          className
        )}
      >
        <CardContent className="flex flex-col gap-0 p-0">
          <div className="relative aspect-[3/4] bg-muted">
            {look.imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL from AI; next/image remotePatterns do not apply
              <img
                src={look.imageDataUrl}
                alt={look.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />
            {!look.imageDataUrl ? (
              <div className="relative flex h-full items-center justify-center font-serif text-2xl text-muted-foreground">
                Look
              </div>
            ) : null}
            <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
              {look.tags.map((t) => (
                <Badge
                  key={t}
                  className={cn(
                    "rounded-full text-[0.65rem] uppercase tracking-wide",
                    t.toLowerCase().includes("prime")
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-[#501e12]"
                  )}
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-2xl text-foreground">
                  {look.title}
                </h3>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {look.description}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Favorite">
                <Heart className="size-4" />
              </Button>
            </div>
            <Button className="rounded-full bg-gradient-to-br from-primary to-[#064e3b] px-6 text-primary-foreground">
              Details
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden border-0 bg-card shadow-[0_12px_40px_rgba(26,28,27,0.04)]",
        className
      )}
    >
      <CardContent className="flex gap-4 p-4">
        <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
          {look.imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={look.imageDataUrl}
              alt={look.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Preview
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="font-serif text-lg leading-snug">{look.title}</h3>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {look.description}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {look.tags.map((t) => (
              <span
                key={t}
                className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
