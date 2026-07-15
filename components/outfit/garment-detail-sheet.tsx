"use client";

import Image from "next/image";
import { Heart } from "lucide-react";

import type { ClothingCardData } from "@/lib/garments/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function GarmentDetailSheet({
  garment,
  onOpenChange,
  onToggleFavorite,
}: {
  garment: ClothingCardData | null;
  onOpenChange: (open: boolean) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const color =
    garment?.colorHex ??
    (garment?.color?.startsWith("#") ? garment.color : "#d8d8d3");

  return (
    <Sheet open={garment !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto border-foreground/10 p-0 sm:max-w-[min(42rem,44vw)]"
      >
        {garment ? (
          <>
            <div className="relative min-h-[52svh] overflow-hidden bg-foreground/[0.045]">
              <div className="absolute left-4 top-4 z-10 rounded-sm bg-background px-3 py-2 text-xs font-medium capitalize shadow-sm">
                {garment.category.replace(/s$/, "")}
              </div>
              {garment.imageUrl ? (
                // TODO: Replace this garment image with a generated image of the user wearing the complete outfit.
                <Image
                  src={garment.imageUrl}
                  alt={garment.name}
                  fill
                  className="object-contain p-8 pb-16 sm:p-12 sm:pb-20"
                  sizes="(max-width: 640px) 100vw, 44vw"
                  priority
                />
              ) : (
                <div className="flex min-h-[42svh] items-center justify-center text-sm capitalize text-muted-foreground">
                  {garment.imageHint ?? garment.category}
                </div>
              )}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-b from-transparent via-popover/70 to-popover backdrop-blur-[3px] [mask-image:linear-gradient(to_bottom,transparent,black_42%)]"
                aria-hidden
              />
              {garment.imageUrl ? (
                <div className="absolute bottom-3 right-5 z-20 h-36 w-32 sm:bottom-4 sm:right-7 sm:h-44 sm:w-40">
                  <Image
                    src={garment.imageUrl}
                    alt={`${garment.name} item preview`}
                    fill
                    className="object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.14)]"
                    sizes="160px"
                  />
                </div>
              ) : null}
            </div>

            <div className="p-5 sm:p-7">
              <SheetHeader className="flex-row items-start justify-between gap-4 p-0">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl">
                    {garment.name}
                  </SheetTitle>
                  <SheetDescription className="mt-1 capitalize">
                    {garment.category}
                    {garment.material ? ` · ${garment.material}` : ""}
                  </SheetDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label={
                    garment.isFavorite
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                  aria-pressed={garment.isFavorite}
                  onClick={() => onToggleFavorite(garment.id)}
                >
                  <Heart
                    className={
                      garment.isFavorite
                        ? "fill-foreground text-foreground"
                        : "text-muted-foreground"
                    }
                  />
                </Button>
              </SheetHeader>

              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <DetailField label="Name" value={garment.name} />
                <DetailField
                  label="Category"
                  value={garment.category.replace(/^\w/, (c) =>
                    c.toUpperCase(),
                  )}
                />
              </div>

              <section className="mt-7 border-t border-foreground/8 pt-6">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Color
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span
                    className="size-9 rounded-sm ring-1 ring-foreground/10"
                    style={{ backgroundColor: color }}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {garment.colorLabel ?? garment.color ?? "Not specified"}
                    </p>
                    <p className="font-mono text-[0.65rem] uppercase text-muted-foreground">
                      {color}
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-7 border-t border-foreground/8 pt-6">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Details
                </p>
                <dl className="mt-3 space-y-3 text-sm">
                  <DetailRow label="Material" value={garment.material} />
                  <DetailRow label="Occasion" value={garment.occasion} />
                  <DetailRow
                    label="Description"
                    value={garment.description ?? undefined}
                  />
                </dl>
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <label className="space-y-2">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <Input
        value={value}
        readOnly
        className="h-10 rounded-sm border-foreground/10 bg-transparent shadow-none"
      />
    </label>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value || "Not specified"}</dd>
    </div>
  );
}
