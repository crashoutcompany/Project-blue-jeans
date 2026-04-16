"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { Plus, Settings2 } from "lucide-react";

import { toggleGarmentFavorite } from "@/app/actions/garments";
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

function optimisticGarmentFromDraft(
  draft: GarmentUploadDraft,
  uploaded: { ufsUrl?: string; url?: string; appUrl?: string },
): ClothingCardData {
  const imageUrl = publicImageUrl(uploaded);
  return {
    id: `pending:${draft.clientKey}`,
    name: draft.displayName.trim() || "Untitled",
    category: draft.category,
    imageUrl: imageUrl || undefined,
    isFavorite: false,
    color: draft.color?.trim() || null,
    description: draft.description?.trim() || null,
  };
}

export function ClosetView({
  initialGarments,
}: {
  initialGarments: ClothingCardData[];
}) {
  const [, startTransition] = useTransition();
  const [serverGarments, setServerGarments] = useState(initialGarments);

  const garmentSignature = useMemo(
    () =>
      `${initialGarments.length}\0${[...initialGarments.map((g) => g.id)].sort().join("\0")}`,
    [initialGarments],
  );
  useEffect(() => {
    setServerGarments(initialGarments);
  }, [initialGarments, garmentSignature]);

  const [garments, addOptimisticGarments] = useOptimistic(
    serverGarments,
    (current, toAdd: ClothingCardData[]) => [...toAdd, ...current],
  );

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
    () => buildColorFacetsFromGarments(garments),
    [garments],
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
    return garments.filter((g) => {
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
  }, [garments, category, colorId, query]);

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

      const saveRes = await fetch("/api/closet/garments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ items: payload }),
      });
      let result: { ok: boolean; message?: string };
      try {
        result = (await saveRes.json()) as { ok: boolean; message?: string };
      } catch {
        setPersistError(
          saveRes.ok
            ? "Save returned an invalid response. Try again."
            : `Save failed (${saveRes.status}). Try again.`,
        );
        return;
      }
      if (result.ok) {
        const added = draftsSnapshot.map((d, i) =>
          optimisticGarmentFromDraft(d, uploaded[i]!),
        );
        draftsSnapshot.forEach((d) => URL.revokeObjectURL(d.previewUrl));
        setPendingDrafts([]);
        startTransition(() => {
          addOptimisticGarments(added);
          setServerGarments((prev) => [...added, ...prev]);
        });
      } else {
        setPersistError(
          result.message ?? `Save failed (${saveRes.status}). Try again.`,
        );
      }
    } catch (error) {
      console.error("[closet] save queue", error);
      const msg =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Could not complete upload or save. Try again.";
      setPersistError(msg);
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
    if (id.startsWith("pending:")) return;
    const result = await toggleGarmentFavorite(id);
    if (result.ok) {
      setServerGarments((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, isFavorite: !g.isFavorite } : g,
        ),
      );
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
            Your closet
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Pieces load from your Neon database. Choose photos, add details,
            then add to closet — we upload and save only when you confirm.
            Filter by category and color.
          </p>
        </div>
        <div className="relative w-full max-w-md lg:w-72">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your closet…"
            className="h-11 rounded-full border border-border bg-card pl-4"
            aria-label="Search closet"
          />
        </div>
      </header>

      <div className="space-y-6">
        <FilterPills value={category} onChange={setCategory} />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <div className="space-y-1.5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Color
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setColorId("all")}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background transition",
                    colorId === "all" ? "ring-primary" : "ring-transparent",
                  )}
                  aria-label="All colors"
                  title="All colors"
                >
                  <span
                    className="size-7 rounded-full border border-border/40"
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
                        "flex size-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background transition",
                        active ? "ring-primary" : "ring-transparent",
                      )}
                      aria-label={`Color: ${c.label}`}
                      title={c.label}
                    >
                      <span
                        className="size-7 rounded-full border border-border/40"
                        style={{ backgroundColor: c.hex }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            className="gap-2 self-start text-muted-foreground"
          >
            <Settings2 className="size-4" />
            Advanced filters
          </Button>
        </div>
      </div>

      <div className="grid auto-rows-min items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card
          className={cn(
            "min-h-0 border-2 border-dashed border-border/80 bg-transparent shadow-none",
            pendingDrafts.length > 0 && "sm:col-span-2 xl:col-span-3",
          )}
        >
          <CardContent
            className={cn(
              "flex min-h-[320px] flex-col gap-4 p-6",
              pendingDrafts.length > 0
                ? "min-h-0 w-full items-stretch pb-8"
                : "items-center justify-center text-center",
            )}
          >
            <div
              className={cn(
                "flex flex-col gap-4",
                pendingDrafts.length > 0 &&
                  "mx-auto w-full max-w-xl items-center text-center",
              )}
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Plus className="size-6 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="font-serif text-lg text-foreground">
                  New archive piece
                </p>
                <p className="text-sm text-muted-foreground">
                  Photos are compressed on your device. Nothing is sent to the
                  cloud until you tap Add to closet — then we upload and save to
                  your database.
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
            </div>

            {pendingDrafts.length > 0 ? (
              <div className="flex min-h-0 w-full flex-col gap-4 border-t border-border/60 pt-4">
                <p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Ready to save
                </p>
                <div className="flex min-h-0 max-h-[min(70vh,640px)] flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch]">
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
                <div className="flex shrink-0 flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
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
