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
        "flex w-max max-w-full items-stretch overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {CATEGORIES.map((cat, index) => {
        const active = value === cat.id;
        const isLast = index === CATEGORIES.length - 1;
        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(cat.id)}
            className={cn(
              "relative min-h-10 shrink-0 border-y border-l border-border/80 bg-transparent px-[1.125rem] py-2.5 text-xs font-medium uppercase tracking-[0.055em] text-muted-foreground transition-[background-color,color,box-shadow] duration-160 ease-[ease]",
              "hover:bg-foreground/[0.07] hover:text-foreground",
              "focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              isLast && "border-r border-border/80",
              active &&
                "z-[1] border-foreground bg-foreground text-background shadow-[inset_0_0_0_1px_var(--foreground)] hover:bg-foreground hover:text-background",
            )}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
