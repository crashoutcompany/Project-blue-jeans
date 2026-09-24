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

/** Collapsed chips only preview a few marked pieces, not the full row. */
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

function CategoryChip({
  label,
  expanded,
  panelId,
  pending,
  marked,
  marks,
  onToggle,
  onClear,
}: {
  label: string;
  expanded: boolean;
  panelId: string;
  pending: boolean;
  marked: ClothingCardData[];
  marks: ConstraintMap;
  onToggle: () => void;
  onClear: () => void;
}) {
  const previews = expanded ? [] : marked.slice(0, COLLAPSED_PREVIEW_LIMIT);
  const hiddenPreviewCount = expanded
    ? 0
    : marked.length - previews.length;

  return (
    <div
      className={cn(
        "flex h-11 shrink-0 items-center gap-0.5 rounded-full border py-0.5 pr-0.5 pl-0.5",
        expanded
          ? "border-foreground/20 bg-muted"
          : "border-border/70 bg-muted/35",
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        onClick={onToggle}
        className={cn(
          "flex h-10 min-w-11 items-center gap-1 rounded-full px-2.5 text-left",
          "touch-manipulation [-webkit-tap-highlight-color:transparent]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "[@media(hover:hover)_and_(pointer:fine)]:transition-colors [@media(hover:hover)_and_(pointer:fine)]:duration-200 [@media(hover:hover)_and_(pointer:fine)]:ease-[ease]",
          "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-background/50",
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
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </button>
      {previews.length > 0 ? (
        <ul
          className="flex items-center gap-1"
          aria-label={`${label} selections`}
        >
          {previews.map((g) => {
            const included = marks[g.id] === "include";
            return (
              <li key={g.id} className="shrink-0">
                <div className="relative size-7">
                  <div
                    className={cn(
                      "absolute inset-0 overflow-hidden rounded-md bg-muted",
                      !included && "opacity-45",
                    )}
                  >
                    {garmentThumb(g)}
                  </div>
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-0 rounded-md ring-2",
                      included ? "ring-primary" : "ring-destructive/70",
                    )}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full",
                      included
                        ? "bg-primary text-primary-foreground"
                        : "bg-destructive text-white",
                    )}
                  >
                    {included ? (
                      <Plus className="size-2" />
                    ) : (
                      <CircleMinus className="size-2" />
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
            <li className="pr-0.5 text-[0.65rem] text-muted-foreground tabular-nums">
              +{hiddenPreviewCount}
            </li>
          ) : null}
        </ul>
      ) : null}
      {marked.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={pending}
          aria-label={`Clear ${label}`}
          onClick={onClear}
          className="rounded-full"
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}

function GarmentPickerRow({
  id,
  row,
  marks,
  pending,
  includeFull,
  onToggleMark,
}: {
  id: string;
  row: ClothingCardData[];
  marks: ConstraintMap;
  pending: boolean;
  includeFull: boolean;
  onToggleMark: (id: string, mark: ConstraintMark | null) => void;
}) {
  return (
    <div
      id={id}
      className="animate-in fade-in slide-in-from-top-1 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none"
    >
      <ul className="flex gap-2 overflow-x-auto overscroll-x-contain px-0.5 pt-0.5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                      onToggleMark(g.id, mark === "include" ? null : "include")
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
  );
}

export function GeneratorIncludeAvoidPicker({
  closetGarments,
  omittedIds,
  marks,
  onChange,
  pending,
  chatActive = false,
}: {
  closetGarments: ClothingCardData[];
  omittedIds: ReadonlySet<string>;
  marks: ConstraintMap;
  onChange: (next: ConstraintMap) => void;
  pending: boolean;
  /** Collapse an open category once suggestions arrive so the chat can use the sheet. */
  chatActive?: boolean;
}) {
  const panelId = useId();
  const [expanded, setExpanded] = useState<GarmentCategoryDb | null>(null);
  const [trackedChat, setTrackedChat] = useState(chatActive);
  if (chatActive !== trackedChat) {
    setTrackedChat(chatActive);
    if (chatActive) setExpanded(null);
  }

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
  const expandedRow = expanded ? byCategory.get(expanded) : undefined;

  return (
    <div className="flex flex-col gap-2">
      {includeFull ? (
        <p className="text-xs text-muted-foreground">
          Include is full ({MAX_MUST_WEAR_INCLUDES}). Clear a piece to pin another.
        </p>
      ) : null}
      <div
        role="group"
        aria-label="Closet categories"
        className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {GARMENT_CATEGORY_VALUES.map((cat) => {
          const row = byCategory.get(cat);
          if (!row) return null;
          const marked = row.filter((g) => marks[g.id]);
          return (
            <CategoryChip
              key={cat}
              label={GARMENT_CATEGORY_LABEL[cat]}
              expanded={expanded === cat}
              panelId={panelId}
              pending={pending}
              marked={marked}
              marks={marks}
              onToggle={() =>
                setExpanded((current) => (current === cat ? null : cat))
              }
              onClear={() => clearCategory(cat)}
            />
          );
        })}
      </div>
      {expanded && expandedRow ? (
        <GarmentPickerRow
          id={panelId}
          row={expandedRow}
          marks={marks}
          pending={pending}
          includeFull={includeFull}
          onToggleMark={setMark}
        />
      ) : null}
    </div>
  );
}
