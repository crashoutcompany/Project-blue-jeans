import { CircleMinus, Plus } from "lucide-react";

import type { ClothingCardData } from "@/lib/garments/types";
import {
  GARMENT_CATEGORY_LABEL,
  GARMENT_CATEGORY_VALUES,
  type GarmentCategoryDb,
} from "@/lib/garments/types";
import { shouldBypassImageOptimizer } from "@/lib/media/display";
import { MAX_MUST_WEAR_INCLUDES } from "@/lib/outfits/look-composition";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";

export type ConstraintMark = "include" | "avoid";

export type ConstraintMap = Record<string, ConstraintMark>;

function garmentThumb(g: ClothingCardData) {
  if (g.imageUrl) {
    return (
      <Image
        src={g.imageUrl}
        alt=""
        fill
        className="object-cover"
        sizes="72px"
        unoptimized={shouldBypassImageOptimizer(g.imageUrl)}
      />
    );
  }
  return (
    <div
      className="size-full"
      style={{ backgroundColor: `${g.colorHex ?? "#e8e8e6"}40` }}
    />
  );
}

export function marksToIds(marks: ConstraintMap) {
  const includedGarmentIds: string[] = [];
  const avoidedGarmentIds: string[] = [];
  for (const [id, mark] of Object.entries(marks)) {
    if (mark === "include") includedGarmentIds.push(id);
    else if (mark === "avoid") avoidedGarmentIds.push(id);
  }
  return { includedGarmentIds, avoidedGarmentIds };
}

export function GeneratorIncludeAvoidPicker({
  closetGarments,
  omittedIds,
  marks,
  onChange,
  pending,
}: {
  closetGarments: ClothingCardData[];
  omittedIds: ReadonlySet<string>;
  marks: ConstraintMap;
  onChange: (next: ConstraintMap) => void;
  pending: boolean;
}) {
  const visible = closetGarments.filter((g) => !omittedIds.has(g.id));
  if (visible.length === 0) return null;

  const byCategory = new Map<GarmentCategoryDb, ClothingCardData[]>();
  for (const cat of GARMENT_CATEGORY_VALUES) {
    const row = visible.filter((g) => g.category === cat);
    if (row.length > 0) byCategory.set(cat, row);
  }

  function visibleIncludeCount(current: ConstraintMap) {
    return visible.reduce(
      (n, g) => (current[g.id] === "include" ? n + 1 : n),
      0,
    );
  }

  function setMark(id: string, mark: ConstraintMark | null) {
    if (mark === "include") {
      if (
        marks[id] !== "include" &&
        visibleIncludeCount(marks) >= MAX_MUST_WEAR_INCLUDES
      ) {
        return;
      }
    }
    const next = { ...marks };
    if (!mark) delete next[id];
    else next[id] = mark;
    onChange(next);
  }

  function clearCategory(cat: GarmentCategoryDb) {
    const next = { ...marks };
    for (const g of byCategory.get(cat) ?? []) {
      delete next[g.id];
    }
    onChange(next);
  }

  const includeFull = visibleIncludeCount(marks) >= MAX_MUST_WEAR_INCLUDES;

  return (
    <div className="flex flex-col gap-4">
      {includeFull ? (
        <p className="text-xs text-muted-foreground">
          Include is full ({MAX_MUST_WEAR_INCLUDES}). Clear a piece to pin another.
        </p>
      ) : null}
      {GARMENT_CATEGORY_VALUES.map((cat) => {
        const row = byCategory.get(cat);
        if (!row) return null;
        const hasMarks = row.some((g) => marks[g.id]);
        return (
          <div key={cat} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {GARMENT_CATEGORY_LABEL[cat]}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={pending || !hasMarks}
                onClick={() => clearCategory(cat)}
              >
                Clear
              </Button>
            </div>
            <ul className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {row.map((g) => {
                const mark = marks[g.id];
                return (
                  <li key={g.id} className="w-[4.75rem] shrink-0">
                    <div
                      className={cn(
                        "relative aspect-[0.78] overflow-hidden rounded-xl bg-muted",
                        mark === "include" && "ring-2 ring-primary",
                        mark === "avoid" && "opacity-45 ring-2 ring-destructive/70",
                      )}
                    >
                      {garmentThumb(g)}
                      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 p-1">
                        <button
                          type="button"
                          disabled={pending || (includeFull && mark !== "include")}
                          aria-pressed={mark === "include"}
                          aria-label={`Include ${g.name}`}
                          onClick={() =>
                            setMark(g.id, mark === "include" ? null : "include")
                          }
                          className={cn(
                            "flex size-6 items-center justify-center rounded-full",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            mark === "include"
                              ? "bg-primary text-primary-foreground"
                              : "bg-black/55 text-white",
                          )}
                        >
                          <Plus className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          aria-pressed={mark === "avoid"}
                          aria-label={`Avoid ${g.name}`}
                          onClick={() =>
                            setMark(g.id, mark === "avoid" ? null : "avoid")
                          }
                          className={cn(
                            "flex size-6 items-center justify-center rounded-full",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            mark === "avoid"
                              ? "bg-destructive text-white"
                              : "bg-black/55 text-white",
                          )}
                        >
                          <CircleMinus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 truncate text-[0.65rem] leading-tight text-foreground">
                      {g.name}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
