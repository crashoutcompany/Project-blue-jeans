"use client";

import { cn } from "@/lib/utils";

/** Matches `garment_category` enum in db/schema.sql (Pieces mode only). */
const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "shoes", label: "Shoes" },
] as const;

export type CategoryFilterId = (typeof CATEGORIES)[number]["id"];

export function FilterPills({
  value,
  onChange,
  className,
}: {
  value: CategoryFilterId;
  onChange: (id: CategoryFilterId) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Piece categories"
      className={cn(
        "flex w-max max-w-full items-center gap-5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {CATEGORIES.map((cat) => {
        const active = value === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(cat.id)}
            className={cn(
              "shrink-0 py-1 text-xs font-medium uppercase tracking-[0.08em]",
              "transition-[color,transform] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]",
              "active:scale-[0.98] motion-reduce:transform-none",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
              "[@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
