"use client";

import Image from "next/image";
import { Heart } from "lucide-react";

import type { ClothingCardData } from "@/lib/garments/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ClothingCard({
  garment,
  className,
  onToggleFavorite,
}: {
  garment: ClothingCardData;
  className?: string;
  onToggleFavorite?: (id: string) => void;
}) {
  const categoryLabel = garment.category.replace(/^\w/, (c) => c.toUpperCase());
  const subtitleParts = [
    categoryLabel,
    garment.material ||
      garment.colorLabel ||
      garment.color ||
      "Archive",
  ];
  const subtitle = subtitleParts.join(" · ");
  const swatchHex = garment.colorHex ?? "#e8e8e6";
  const hasRemoteImage = Boolean(garment.imageUrl);

  return (
    <Card
      className={cn(
        "garment-tile group overflow-visible rounded-none bg-transparent py-0 ring-0",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-2.5 p-0">
        <div
          className="relative aspect-[4/5] overflow-hidden rounded-xl bg-foreground/[0.035]"
          style={
            hasRemoteImage
              ? undefined
              : { backgroundColor: `${swatchHex}55` }
          }
        >
          {hasRemoteImage ? (
            <Image
              src={garment.imageUrl!}
              alt={garment.name}
              fill
              data-garment-image
              className="object-contain p-2.5 sm:p-3"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
            />
          ) : (
            <div
              data-garment-image
              className="flex size-full items-center justify-center"
            >
              <span className="text-xs font-medium capitalize text-muted-foreground">
                {garment.imageHint ?? "piece"}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute right-2 top-2 rounded-full bg-background/88 opacity-80 shadow-[0_1px_5px_rgba(26,28,27,0.08)] backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 dark:bg-background/90"
            aria-label={
              garment.isFavorite ? "Remove from favorites" : "Add to favorites"
            }
            aria-pressed={garment.isFavorite}
            disabled={!onToggleFavorite}
            onClick={() => onToggleFavorite?.(garment.id)}
          >
            <Heart
              className={cn(
                "size-4",
                garment.isFavorite
                  ? "fill-primary text-primary"
                  : "text-muted-foreground",
              )}
            />
          </Button>
        </div>
        <div className="min-w-0 px-0.5">
          <h3 className="truncate text-xs font-medium leading-snug text-foreground sm:text-sm">
            {garment.name}
          </h3>
          <p className="mt-0.5 truncate text-[0.65rem] capitalize text-muted-foreground">
            {subtitle}
            {garment.occasion ? ` · ${garment.occasion}` : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
