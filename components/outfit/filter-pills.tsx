"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Matches `garment_category` enum in db/schema.sql */
const CATEGORIES = [
  { id: "all", label: "All pieces" },
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "shoes", label: "Shoes" },
] as const;

export type CategoryFilterId = (typeof CATEGORIES)[number]["id"];

export function FilterPills({
  value,
  onChange,
}: {
  value: CategoryFilterId;
  onChange: (id: CategoryFilterId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full bg-foreground/[0.045] p-1">
      {CATEGORIES.map((cat) => {
        const active = value === cat.id;
        return (
          <Button
            key={cat.id}
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange(cat.id)}
            aria-pressed={active}
            className={cn(
              "rounded-full px-3.5 text-xs font-medium text-muted-foreground",
              active &&
                "bg-background text-foreground shadow-[0_1px_4px_rgba(26,28,27,0.08)] hover:bg-background",
            )}
          >
            {cat.label}
          </Button>
        );
      })}
    </div>
  );
}
