import { useId, useState } from "react";
import { ChevronDown, CircleMinus, Plus } from "lucide-react";

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

/** Collapsed sections only preview a few marked pieces, not the full row. */
const COLLAPSED_PREVIEW_LIMIT = 4;

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

function CategorySection({
  category,
  row,
  marks,
  pending,
  includeFull,
  onToggleMark,
  onClear,
}: {
  category: GarmentCategoryDb;
  row: ClothingCardData[];
  marks: ConstraintMap;
  pending: boolean;
  includeFull: boolean;
  onToggleMark: (id: string, mark: ConstraintMark | null) => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const label = GARMENT_CATEGORY_LABEL[category];
  const marked = row.filter((g) => marks[g.id]);
  const previews = marked.slice(0, COLLAPSED_PREVIEW_LIMIT);
  const hiddenPreviewCount = marked.length - previews.length;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((open) => !open)}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-0.5 text-left",
            "touch-manipulation [-webkit-tap-highlight-color:transparent]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "[@media(hover:hover)_and_(pointer:fine)]:transition-colors [@media(hover:hover)_and_(pointer:fine)]:duration-200 [@media(hover:hover)_and_(pointer:fine)]:ease-[ease]",
            "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/60",
          )}
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 origin-center text-muted-foreground",
              "transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:transition-none",
              expanded ? "rotate-0" : "-rotate-90",
            )}
          />
          <span className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={pending || marked.length === 0}
          onClick={onClear}
        >
          Clear
        </Button>
      </div>

      {!expanded && previews.length > 0 ? (
        <ul
          className="flex items-center gap-1.5 pl-5"
          aria-label={`${label} selections`}
        >
          {previews.map((g) => {
            const included = marks[g.id] === "include";
            return (
              <li key={g.id} className="shrink-0">
                <div className="relative size-10">
                  <div
                    className={cn(
                      "absolute inset-0 overflow-hidden rounded-lg bg-muted",
                      !included && "opacity-45",
                    )}
                  >
                    {garmentThumb(g)}
                  </div>
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-0 rounded-lg ring-2",
                      included ? "ring-primary" : "ring-destructive/70",
                    )}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full",
                      included
                        ? "bg-primary text-primary-foreground"
                        : "bg-destructive text-white",
                    )}
                  >
                    {included ? (
                      <Plus className="size-2.5" />
                    ) : (
                      <CircleMinus className="size-2.5" />
                    )}
                  </span>
                  <span className="sr-only">
                    {included ? `Included ${g.name}` : `Ignored ${g.name}`}
                  </span>
                </div>
              </li>
            );
          })}
          {hiddenPreviewCount > 0 ? (
            <li className="pl-0.5 text-xs text-muted-foreground tabular-nums">
              +{hiddenPreviewCount}
            </li>
          ) : null}
        </ul>
      ) : null}

      <div
        id={panelId}
        inert={expanded ? undefined : true}
        aria-hidden={expanded ? undefined : true}
        className={cn(
          "grid",
          "transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          "motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="flex gap-2 overflow-x-auto px-0.5 pt-0.5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {row.map((g) => {
              const mark = marks[g.id];
              return (
                <li key={g.id} className="w-[4.75rem] shrink-0">
                  <div
                    className={cn(
                      "relative aspect-[0.78] overflow-hidden rounded-xl bg-muted",
                      mark === "include" && "ring-2 ring-primary",
                      mark === "avoid" &&
                        "opacity-45 ring-2 ring-destructive/70",
                    )}
                  >
                    {garmentThumb(g)}
                    <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 p-1">
                      <button
                        type="button"
                        disabled={
                          pending || (includeFull && mark !== "include")
                        }
                        aria-pressed={mark === "include"}
                        aria-label={`Include ${g.name}`}
                        onClick={() =>
                          onToggleMark(
                            g.id,
                            mark === "include" ? null : "include",
                          )
                        }
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full",
                          "touch-manipulation [-webkit-tap-highlight-color:transparent]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          mark === "include"
                            ? "bg-primary text-primary-foreground"
                            : "bg-black/55 text-white",
                        )}
                      >
                        <Plus aria-hidden="true" className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        aria-pressed={mark === "avoid"}
                        aria-label={`Avoid ${g.name}`}
                        onClick={() =>
                          onToggleMark(g.id, mark === "avoid" ? null : "avoid")
                        }
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full",
                          "touch-manipulation [-webkit-tap-highlight-color:transparent]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          mark === "avoid"
                            ? "bg-destructive text-white"
                            : "bg-black/55 text-white",
                        )}
                      >
                        <CircleMinus aria-hidden="true" className="size-3.5" />
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
      </div>
    </div>
  );
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
    <div className="flex flex-col gap-1">
      {includeFull ? (
        <p className="text-xs text-muted-foreground">
          Include is full ({MAX_MUST_WEAR_INCLUDES}). Clear a piece to pin another.
        </p>
      ) : null}
      {GARMENT_CATEGORY_VALUES.map((cat) => {
        const row = byCategory.get(cat);
        if (!row) return null;
        return (
          <CategorySection
            key={cat}
            category={cat}
            row={row}
            marks={marks}
            pending={pending}
            includeFull={includeFull}
            onToggleMark={setMark}
            onClear={() => clearCategory(cat)}
          />
        );
      })}
    </div>
  );
}
