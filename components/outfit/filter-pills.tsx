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
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((cat) => {
        const active = value === cat.id;
        return (
          <Button
            key={cat.id}
            type="button"
            size="sm"
            variant={active ? "default" : "secondary"}
            onClick={() => onChange(cat.id)}
            className={cn(
              "rounded-full px-4 text-[0.65rem] font-semibold uppercase tracking-[0.14em]",
              active &&
                "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {cat.label}
          </Button>
        );
      })}
    </div>
  );
}
