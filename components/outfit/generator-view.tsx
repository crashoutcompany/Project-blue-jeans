"use client";

import Image from "next/image";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Sparkles } from "lucide-react";

import { generateLookbook } from "@/app/actions/generate-lookbook";
import type { ClothingCardData } from "@/lib/garments/types";
import type { OutfitLook } from "@/lib/outfits/types";
import { ChipGroup } from "@/components/outfit/chip-group";
import { OutfitCard } from "@/components/outfit/outfit-card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const CLIMATE = [
  { id: "temperate", label: "Temperate" },
  { id: "crisp", label: "Crisp" },
  { id: "sultry", label: "Sultry" },
] as const;

const CONTEXT = [
  { id: "studio", label: "Studio" },
  { id: "gala", label: "Gala" },
  { id: "soiree", label: "Soirée" },
] as const;

type ClimateId = (typeof CLIMATE)[number]["id"];
type ContextId = (typeof CONTEXT)[number]["id"];

function climateLabel(id: ClimateId) {
  return CLIMATE.find((c) => c.id === id)?.label ?? id;
}

function contextLabel(id: ContextId) {
  return CONTEXT.find((c) => c.id === id)?.label ?? id;
}

function idsSignature(garments: ClothingCardData[]) {
  return garments.map((g) => g.id).join("\0");
}

/** Remount with `key={closetSig}` so selection resets to “all included” when the closet set changes. */
function GeneratorClosetScope({
  closetGarments,
  pending,
  onSelectionChange,
}: {
  closetGarments: ClothingCardData[];
  pending: boolean;
  onSelectionChange: (ids: Set<string>) => void;
}) {
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(closetGarments.map((g) => g.id)),
  );

  useLayoutEffect(() => {
    onSelectionChange(new Set(closetGarments.map((g) => g.id)));
    // Mount-only: parent uses `key={closetSig}` so a new closet set remounts this instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync parent once per instance
  }, []);

  const allClosetIds = useMemo(
    () => new Set(closetGarments.map((g) => g.id)),
    [closetGarments],
  );

  const allSelected =
    closetGarments.length > 0 &&
    selectedIds.size === allClosetIds.size &&
    [...selectedIds].every((id) => allClosetIds.has(id));

  function patchSelection(updater: (prev: Set<string>) => Set<string>) {
    setSelectedIds((prev) => {
      const next = updater(prev);
      onSelectionChange(next);
      return next;
    });
  }

  function selectAllGarments() {
    const next = new Set(closetGarments.map((g) => g.id));
    setSelectedIds(next);
    onSelectionChange(next);
  }

  function clearGarmentSelection() {
    const next = new Set<string>();
    setSelectedIds(next);
    onSelectionChange(next);
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Select wardrobe
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the pieces the model can style.
          </p>
        </div>
        {closetGarments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-xs"
              disabled={pending || allSelected}
              onClick={selectAllGarments}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-xs"
              disabled={pending || selectedIds.size === 0}
              onClick={clearGarmentSelection}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </div>
      {closetGarments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Your closet is empty. Add garments in{" "}
          <span className="font-medium text-foreground">Closet</span> to scope
          the generator.
        </p>
      ) : (
        <ScrollArea className="h-[min(570px,62vh)]">
          <ul className="grid grid-cols-2 gap-3 pr-3 sm:grid-cols-3 xl:grid-cols-4">
            {closetGarments.map((g) => {
              const checked = selectedIds.has(g.id);
              const hasImage = Boolean(g.imageUrl);
              return (
                <li key={g.id} className="min-w-0">
                  <label
                    className={cn(
                      "group relative flex cursor-pointer flex-col gap-2 rounded-xl outline-none transition-opacity",
                      !checked && "opacity-45",
                      pending && "pointer-events-none opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        patchSelection((prev) => {
                          const next = new Set(prev);
                          if (next.has(g.id)) next.delete(g.id);
                          else next.add(g.id);
                          return next;
                        })
                      }
                      className="absolute right-2 top-2 z-10 size-4 rounded border-input accent-foreground"
                      disabled={pending}
                    />
                    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-foreground/[0.04]">
                      {hasImage ? (
                        <Image
                          src={g.imageUrl!}
                          alt={g.name}
                          fill
                          className="object-contain p-2"
                          sizes="(max-width: 640px) 45vw, 18vw"
                        />
                      ) : (
                        <div
                          className="flex size-full items-center justify-center text-[0.65rem] text-muted-foreground"
                          style={{
                            backgroundColor: `${g.colorHex ?? "#e8e8e6"}40`,
                          }}
                        >
                          Piece
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 px-0.5">
                      <p className="truncate text-xs font-medium text-foreground">
                        {g.name}
                      </p>
                      <p className="truncate text-[0.65rem] capitalize text-muted-foreground">
                        {g.category}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
      {closetGarments.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {selectedIds.size} of {closetGarments.length} included
          {!allSelected ? " · only checked items are sent to the model" : ""}
        </p>
      ) : null}
    </>
  );
}

export function GeneratorView({
  closetGarments,
}: {
  closetGarments: ClothingCardData[];
}) {
  const [climate, setClimate] = useState<ClimateId>("temperate");
  const [context, setContext] = useState<ContextId>("gala");
  const [narrative, setNarrative] = useState("");
  const [looks, setLooks] = useState<OutfitLook[]>([]);
  const [curatorNote, setCuratorNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const generationRequestIdRef = useRef(0);

  const closetSig = useMemo(() => idsSignature(closetGarments), [closetGarments]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    new Set(closetGarments.map((g) => g.id)),
  );
  const onClosetSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids);
  }, []);

  const featured = looks.find((l) => l.featured);
  const secondary = looks.filter((l) => !l.featured);

  const allClosetIds = useMemo(
    () => new Set(closetGarments.map((g) => g.id)),
    [closetGarments],
  );

  const allSelected =
    closetGarments.length > 0 &&
    selectedIds.size === allClosetIds.size &&
    [...selectedIds].every((id) => allClosetIds.has(id));

  async function handleGenerate() {
    setError(null);
    if (closetGarments.length > 0 && selectedIds.size === 0) {
      setError("Select at least one piece to include in generation.");
      return;
    }

    const requestId = ++generationRequestIdRef.current;
    setIsGenerating(true);
    try {
      const result = await generateLookbook({
        climate: climateLabel(climate),
        context: contextLabel(context),
        narrative,
        ...(!allSelected && selectedIds.size > 0
          ? { includedGarmentIds: [...selectedIds] }
          : {}),
      });
      if (requestId !== generationRequestIdRef.current) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setLooks(result.looks);
      setCuratorNote(result.curatorNote);
    } finally {
      if (requestId === generationRequestIdRef.current) {
        setIsGenerating(false);
      }
    }
  }

  return (
    <div className="page-canvas flex min-w-0 flex-col gap-8">
      <header>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Studio
        </p>
        <h1 className="mt-1.5 text-2xl font-medium tracking-tight sm:text-3xl">
          Build an outfit
        </h1>
      </header>

      <section className="grid min-h-[calc(100svh-11rem)] gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.7fr)] lg:items-start">
        <div className="min-w-0 rounded-2xl bg-foreground/[0.022] p-4 sm:p-5">
          <div className="space-y-3">
            <GeneratorClosetScope
              key={closetSig}
              closetGarments={closetGarments}
              pending={isGenerating}
              onSelectionChange={onClosetSelectionChange}
            />
          </div>
        </div>

        <aside className="space-y-7 rounded-2xl bg-foreground/[0.04] p-5 lg:sticky lg:top-20 lg:p-6">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Direction
            </p>
            <h2 className="mt-1.5 text-xl font-medium tracking-tight">
              Describe the look
            </h2>
          </div>
          <ChipGroup
            label="Climate"
            options={CLIMATE}
            value={climate}
            onChange={setClimate}
          />
          <ChipGroup
            label="Context"
            options={CONTEXT}
            value={context}
            onChange={setContext}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="style-notes"
                className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                Notes
              </label>
              <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                <Sparkles className="size-3.5" />
                AI styled
              </span>
            </div>
            <Textarea
              id="style-notes"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Clean layers, relaxed proportions…"
              className="min-h-[116px] resize-none rounded-xl border-0 bg-background/80 text-sm shadow-none"
              disabled={isGenerating}
            />
          </div>
          <div className="space-y-3">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={
                isGenerating ||
                (closetGarments.length > 0 && selectedIds.size === 0)
              }
              className="h-11 w-full rounded-full bg-foreground text-background hover:bg-foreground/85 disabled:opacity-60"
            >
              <Sparkles className="size-4" />
              {isGenerating ? "Styling…" : "Generate looks"}
            </Button>
            <p className="text-center text-[0.65rem] leading-relaxed text-muted-foreground">
              {selectedIds.size} pieces selected · powered by Gemini
            </p>
          </div>
        </aside>
      </section>

      <section className="space-y-5 border-t border-foreground/8 pt-7">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Lookbook
          </p>
          <h2 className="mt-1 text-xl font-medium tracking-tight text-foreground">
            Generated looks
          </h2>
        </div>
        {looks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-foreground/12 px-4 py-10 text-center text-sm text-muted-foreground">
            Your generated looks will appear here.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            {featured ? (
              <OutfitCard
                look={featured}
                variant="featured"
                className="h-full"
              />
            ) : null}
            <div className="flex flex-col gap-4">
              {secondary.map((look) => (
                <OutfitCard key={look.id} look={look} variant="compact" />
              ))}
            </div>
          </div>
        )}
      </section>

      {looks.length > 0 && curatorNote.trim().length > 0 ? (
        <section className="relative overflow-hidden rounded-2xl bg-foreground/[0.04] px-6 py-7 sm:px-8">
          <div className="max-w-xl space-y-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Curator&apos;s note
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              {curatorNote}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
