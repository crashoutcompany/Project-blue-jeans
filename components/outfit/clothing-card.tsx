"use client";

import Image from "next/image";
import Link from "next/link";

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
  const tileClassName = cn(
    "garment-tile group relative aspect-[0.78] min-w-0 overflow-hidden rounded-none bg-transparent p-2.5 outline-none transition-[border-color] duration-160 ease-[ease] focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-foreground sm:p-3",
    onSelect ? "cursor-zoom-in" : null,
    selected
      ? "border border-foreground"
      : "border border-transparent",
    className,
  );
  const tileStyle = hasRemoteImage
    ? undefined
    : { backgroundColor: `${swatchHex}22` };
  const content = hasRemoteImage ? (
    <Image
      src={garment.imageUrl!}
      alt=""
      fill
      data-garment-image
      className="object-contain"
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 165px"
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
  );

  if (!onSelect) {
    return (
      <Link
        href="/closet"
        aria-label={`Open wardrobe to view ${garment.name}`}
        className={tileClassName}
        style={tileStyle}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(garment)}
      aria-label={`View details for ${garment.name}`}
      aria-current={selected ? "true" : undefined}
      className={tileClassName}
      style={tileStyle}
    >
      {content}
    </button>
  );
}
