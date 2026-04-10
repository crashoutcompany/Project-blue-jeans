"use client";

import Image from "next/image";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Sparkles } from "lucide-react";

import { generateLookbook } from "@/app/actions/generate-lookbook";
import type { ClothingCardData } from "@/lib/garments/types";
import type { OutfitLook } from "@/lib/outfits/types";
import { ChipGroup } from "@/components/outfit/chip-group";
import { OutfitCard } from "@/components/outfit/outfit-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Closet scope
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            All pieces are included by default. Uncheck any you want to exclude
            from this run.
          </p>
        </div>
        {closetGarments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              disabled={pending || allSelected}
              onClick={selectAllGarments}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="outline"
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
        <ScrollArea className="h-[min(280px,40vh)] rounded-2xl border border-border bg-card/50">
          <ul className="divide-y divide-border p-2">
            {closetGarments.map((g) => {
              const checked = selectedIds.has(g.id);
              const hasImage = Boolean(g.imageUrl);
              return (
                <li key={g.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition-colors",
                      "hover:bg-muted/60",
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
                      className="size-4 shrink-0 rounded border-input accent-primary"
                      disabled={pending}
                    />
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {hasImage ? (
                        <Image
                          src={g.imageUrl!}
                          alt={g.name}
                          fill
                          className="object-cover"
                          sizes="48px"
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {g.name}
                      </p>
                      <p className="truncate text-xs capitalize text-muted-foreground">
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
  const [pending, startTransition] = useTransition();

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

  function handleGenerate() {
    setError(null);
    if (closetGarments.length > 0 && selectedIds.size === 0) {
      setError("Select at least one piece to include in generation.");
      return;
    }
    startTransition(async () => {
      const result = await generateLookbook({
        climate: climateLabel(climate),
        context: contextLabel(context),
        narrative,
        ...(!allSelected && selectedIds.size > 0
          ? { includedGarmentIds: [...selectedIds] }
          : {}),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setLooks(result.looks);
      setCuratorNote(result.curatorNote);
    });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:max-w-none">
      <div className="space-y-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Outfit generator
        </p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Set the climate and context, add a short style narrative, and generate
          a three-look concept deck. The hero look uses{" "}
          <span className="font-medium text-foreground">Gemini 2.5 Flash Image</span>{" "}
          (Nano Banana) when your API key is configured.
        </p>
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.75fr)] lg:items-start">
        <div className="space-y-8">
          <ChipGroup
            label="Current climate"
            options={CLIMATE}
            value={climate}
            onChange={setClimate}
          />
          <ChipGroup
            label="The context"
            options={CONTEXT}
            value={context}
            onChange={setContext}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Style narrative
              </p>
              <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                <Sparkles className="size-3.5" />
                Gemini
              </span>
            </div>
            <Textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="E.g. Minimalist with a touch of Bohemian texture…"
              className="min-h-[120px] rounded-2xl border-border bg-card text-base"
              disabled={pending}
            />
          </div>

          <div className="space-y-3">
            <GeneratorClosetScope
              key={closetSig}
              closetGarments={closetGarments}
              pending={pending}
              onSelectionChange={onClosetSelectionChange}
            />
          </div>
        </div>

        <Card className="border-0 bg-primary text-primary-foreground shadow-[0_12px_40px_rgba(26,28,27,0.08)]">
          <CardContent className="flex flex-col gap-4 p-6 sm:p-8">
            <h2 className="font-serif text-2xl text-primary-foreground">
              Fabricate ensembles
            </h2>
            <p className="text-sm leading-relaxed text-primary-foreground/85">
              We&apos;ll blend your narrative with the climate and context you
              choose—structured copy from Gemini Flash, optional hero render from
              Flash Image.
            </p>
            {error ? (
              <p className="text-sm text-primary-foreground/90" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={
                pending ||
                (closetGarments.length > 0 && selectedIds.size === 0)
              }
              className="mt-2 h-11 rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 disabled:opacity-60"
            >
              <Sparkles className="size-4" />
              {pending ? "Generating…" : "Generate lookbook"}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <h2 className="font-serif text-2xl text-foreground">
          Generated narratives
        </h2>
        {looks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            Run <span className="font-medium text-foreground">Generate lookbook</span>{" "}
            to see structured looks here.
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
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#fde7dc] via-[#fceee8] to-[#f8ddd4] px-6 py-8 sm:px-10">
          <div className="max-w-xl space-y-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#501e12]/80">
              Curator&apos;s note
            </p>
            <p className="text-sm leading-relaxed text-[#3a3a38]">
              {curatorNote}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
