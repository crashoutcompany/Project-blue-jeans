"use client";

import Image from "next/image";
import { Heart } from "lucide-react";

import type { ClothingCardData } from "@/lib/garments/types";
import { Badge } from "@/components/ui/badge";
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
        "overflow-hidden border-0 bg-card shadow-[0_12px_40px_rgba(26,28,27,0.04)]",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-6 p-4 sm:p-5">
        <div
          className="relative aspect-square overflow-hidden rounded-2xl bg-muted"
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
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <span className="font-serif text-lg capitalize text-muted-foreground">
                {garment.imageHint ?? "piece"}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute right-2 bottom-2 rounded-full bg-card/90 shadow-sm dark:bg-card/95"
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
        <div className="space-y-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {subtitle}
          </p>
          <h3 className="font-serif text-lg leading-snug text-foreground">
            {garment.name}
          </h3>
          {garment.occasion ? (
            <Badge
              variant="secondary"
              className="rounded-md border-0 bg-secondary text-xs font-medium text-[#501e12] dark:text-foreground"
            >
              {garment.occasion}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
