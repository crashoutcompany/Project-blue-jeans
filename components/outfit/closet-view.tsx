"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Settings2 } from "lucide-react";

import {
  createGarmentsFromUpload,
  toggleGarmentFavorite,
} from "@/app/actions/garments";
import {
  ClosetImageUpload,
  type ClosetPendingLocalImage,
} from "@/components/upload/closet-image-upload";
import {
  ClosetGarmentDraftCard,
  garmentDraftFromLocalPick,
  type GarmentUploadDraft,
} from "@/components/upload/closet-garment-draft-card";
import { useUploadThing } from "@/lib/uploadthing";
import type { ClothingCardData } from "@/lib/garments/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ClothingCard } from "@/components/outfit/clothing-card";
import {
  FilterPills,
  type CategoryFilterId,
} from "@/components/outfit/filter-pills";
import {
  buildColorFacetsFromGarments,
  garmentMatchesColorFacet,
} from "@/lib/garments/color-facets";
import { cn } from "@/lib/utils";

function publicImageUrl(file: {
  ufsUrl?: string;
  url?: string;
  appUrl?: string;
}) {
  return file.ufsUrl || file.url || file.appUrl || "";
}

export function ClosetView({
  initialGarments,
}: {
  initialGarments: ClothingCardData[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryFilterId>("all");
  const [colorId, setColorId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [pendingDrafts, setPendingDrafts] = useState<GarmentUploadDraft[]>([]);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [savingDrafts, setSavingDrafts] = useState(false);

  const previewUrlsRef = useRef<Set<string>>(new Set());
  previewUrlsRef.current = new Set(pendingDrafts.map((d) => d.previewUrl));

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const { startUpload } = useUploadThing("closetImage");

  const dynamicColorFacets = useMemo(
    () => buildColorFacetsFromGarments(initialGarments),
    [initialGarments],
  );

  const colorFacetIdsKey = useMemo(
    () => dynamicColorFacets.map((f) => f.id).join("\0"),
    [dynamicColorFacets],
  );

  useEffect(() => {
    if (
      colorId !== "all" &&
      !dynamicColorFacets.some((f) => f.id === colorId)
    ) {
      setColorId("all");
    }
  }, [colorFacetIdsKey, colorId, dynamicColorFacets]);

  const filtered = useMemo(() => {
    return initialGarments.filter((g) => {
      if (category !== "all" && g.category !== category) return false;
      if (!garmentMatchesColorFacet(g, colorId)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = [g.name, g.category, g.color, g.colorLabel, g.material]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [initialGarments, category, colorId, query]);

  function handleFilesReady(items: ClosetPendingLocalImage[]) {
    setPersistError(null);
    setPendingDrafts((prev) => [
      ...prev,
      ...items.map(garmentDraftFromLocalPick),
    ]);
  }

  async function handleSavePendingToCloset() {
    if (pendingDrafts.length === 0) return;
    setPersistError(null);
    setSavingDrafts(true);
    const draftsSnapshot = pendingDrafts;
    try {
      const files = draftsSnapshot.map((d) => d.file);
      const uploaded = await startUpload(files);
      if (!uploaded?.length || uploaded.length !== draftsSnapshot.length) {
        setPersistError(
          uploaded === undefined
            ? "Upload did not finish. Set UPLOADTHING_TOKEN, restart the dev server, and try again."
            : "Some files did not upload. Try again or remove items from the queue.",
        );
        return;
      }

      const payload = [];
      for (let i = 0; i < draftsSnapshot.length; i++) {
        const u = uploaded[i]!;
        const url = publicImageUrl(u);
        if (!url) {
          setPersistError(
            "Upload succeeded but no public URL was returned. Try again or refresh the page.",
          );
          return;
        }
        const d = draftsSnapshot[i]!;
        payload.push({
          url,
          key: u.key,
          name: d.displayName,
          category: d.category,
          color: d.color,
          notes: d.notes,
          description: d.description,
        });
      }

      const result = await createGarmentsFromUpload(payload);
      if (result.ok) {
        draftsSnapshot.forEach((d) => URL.revokeObjectURL(d.previewUrl));
        setPendingDrafts([]);
        router.refresh();
      } else {
        setPersistError(result.message);
      }
    } catch {
      setPersistError("Could not complete upload or save. Try again.");
    } finally {
      setSavingDrafts(false);
    }
  }

  function handleClearPending() {
    setPendingDrafts((prev) => {
      prev.forEach((d) => URL.revokeObjectURL(d.previewUrl));
      return [];
    });
    setPersistError(null);
  }

  function updateDraft(clientKey: string, patch: Partial<GarmentUploadDraft>) {
    setPendingDrafts((prev) =>
      prev.map((d) => (d.clientKey === clientKey ? { ...d, ...patch } : d)),
    );
  }

  function removeDraft(clientKey: string) {
    setPendingDrafts((prev) => {
      const target = prev.find((d) => d.clientKey === clientKey);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((d) => d.clientKey !== clientKey);
    });
  }

  async function handleToggleFavorite(id: string) {
    const result = await toggleGarmentFavorite(id);
    if (result.ok) router.refresh();
  }

  return (
    <div className="page-canvas flex min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Collection · {initialGarments.length} pieces
          </p>
          <h1 className="mt-1.5 text-2xl font-medium tracking-tight sm:text-3xl">
            Wardrobe
          </h1>
        </div>
        <div className="relative w-full sm:w-64">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search wardrobe"
            className="h-9 rounded-full border-0 bg-foreground/[0.045] px-4 text-xs shadow-none"
            aria-label="Search closet"
          />
        </div>
      </header>

      <div className="flex flex-col gap-3 border-b border-foreground/8 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <FilterPills value={category} onChange={setCategory} />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Color
          </span>
          <button
            type="button"
            onClick={() => setColorId("all")}
            className={cn(
              "flex size-7 items-center justify-center rounded-full ring-1 ring-offset-1 ring-offset-background transition",
              colorId === "all" ? "ring-primary" : "ring-transparent",
            )}
            aria-label="All colors"
            title="All colors"
          >
            <span
              className="size-5 rounded-full border border-border/40"
              style={{ backgroundColor: "#e2e3e0" }}
            />
          </button>
          {dynamicColorFacets.map((c) => {
            const active = colorId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setColorId(c.id)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full ring-1 ring-offset-1 ring-offset-background transition",
                  active ? "ring-primary" : "ring-transparent",
                )}
                aria-label={`Color: ${c.label}`}
                title={c.label}
              >
                <span
                    className="size-5 rounded-full border border-border/40"
                  style={{ backgroundColor: c.hex }}
                />
              </button>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5 rounded-full text-xs text-muted-foreground"
          >
            <Settings2 className="size-3.5" />
            Filters
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <Card
          className={cn(
            "rounded-xl border border-dashed border-foreground/15 bg-foreground/[0.018] py-0 ring-0",
            pendingDrafts.length > 0 && "col-span-full",
          )}
        >
          <CardContent
            className={cn(
              "flex h-full flex-col items-center justify-center gap-3 p-4 text-center",
              pendingDrafts.length === 0 && "aspect-[4/5]",
            )}
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-foreground/[0.06]">
              <Plus className="size-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">
                Add pieces
              </p>
              <p className="text-[0.65rem] leading-relaxed text-muted-foreground">
                Select photos from your camera roll
              </p>
            </div>
            <ClosetImageUpload
              onFilesReady={handleFilesReady}
              disabled={savingDrafts}
            />
            {persistError ? (
              <p className="max-w-xs text-sm text-destructive">
                {persistError}
              </p>
            ) : null}

            {pendingDrafts.length > 0 ? (
              <div className="w-full space-y-4 border-t border-border/60 pt-4 text-left">
                <p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Ready to save
                </p>
                <div className="flex max-h-[min(60vh,520px)] flex-col gap-4 overflow-y-auto pr-1">
                  {pendingDrafts.map((d) => (
                    <ClosetGarmentDraftCard
                      key={d.clientKey}
                      draft={d}
                      disabled={savingDrafts}
                      onChange={(patch) => updateDraft(d.clientKey, patch)}
                      onRemove={() => removeDraft(d.clientKey)}
                    />
                  ))}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={savingDrafts}
                    onClick={() => void handleSavePendingToCloset()}
                  >
                    {savingDrafts ? "Uploading & saving…" : "Add to closet"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={savingDrafts}
                    onClick={handleClearPending}
                  >
                    Clear queue
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {filtered.map((g) => (
          <ClothingCard
            key={g.id}
            garment={g}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}
