"use client";

import Image from "next/image";

import type { ClothingCardData } from "@/lib/garments/types";
import { cn } from "@/lib/utils";

export function ClothingCard({
  garment,
  className,
  selected = false,
  onSelect,
}: {
  garment: ClothingCardData;
  className?: string;
  selected?: boolean;
  onSelect?: (garment: ClothingCardData) => void;
}) {
  const swatchHex = garment.colorHex ?? "#e8e8e6";
  const hasRemoteImage = Boolean(garment.imageUrl);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(garment)}
      aria-label={`View details for ${garment.name}`}
      aria-pressed={selected}
      className={cn(
        "garment-tile group relative aspect-[4/5] min-w-0 overflow-hidden rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "ring-1 ring-foreground"
          : "ring-1 ring-transparent hover:ring-foreground/20",
        className,
      )}
      style={
        hasRemoteImage ? undefined : { backgroundColor: `${swatchHex}33` }
      }
    >
      {hasRemoteImage ? (
        <Image
          src={garment.imageUrl!}
          alt=""
          fill
          data-garment-image
          className="object-contain p-1.5 sm:p-2"
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
    </button>
  );
}
