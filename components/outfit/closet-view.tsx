"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarDays, Search, X } from "lucide-react";

import { toggleGarmentFavorite } from "@/app/actions/garments";
import type {
  GarmentDeleteResult,
  GarmentEditSaveInput,
  GarmentEditSaveResult,
} from "@/components/outfit/garment-detail-sheet";
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
import { mediaAssetDisplayPath } from "@/lib/media/display";
import type { ClothingCardData } from "@/lib/garments/types";
import {
  deleteGarmentResultSchema,
  updateGarmentFieldsResultSchema,
} from "@/lib/garments/types";
import type { ClosetSavedOutfit } from "@/lib/outfits/closet-saved-outfits";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClothingCard } from "@/components/outfit/clothing-card";
import { GarmentDetailSheet } from "@/components/outfit/garment-detail-sheet";
import { OutfitDetailSheet } from "@/components/outfit/outfit-detail-sheet";
import {
  FilterPills,
  type CategoryFilterId,
} from "@/components/outfit/filter-pills";
import {
  buildColorFacetsFromGarments,
  garmentMatchesColorFacet,
} from "@/lib/garments/color-facets";
import { formatProductWornOn } from "@/lib/time/product-timezone";
import { cn } from "@/lib/utils";

type ClosetMode = "pieces" | "outfits";

function optimisticGarmentFromDraft(
  draft: GarmentUploadDraft,
  mediaAssetId: string,
): ClothingCardData {
  return {
    id: `pending:${draft.clientKey}`,
    name: draft.displayName.trim() || "Untitled",
    category: draft.category,
    imageUrl: mediaAssetDisplayPath(mediaAssetId),
    isFavorite: false,
    color: draft.color?.trim() || null,
    description: draft.description?.trim() || null,
    notes: draft.notes?.trim() || null,
  };
}

export function ClosetView({
  initialGarments,
  savedOutfits = [],
}: {
  initialGarments: ClothingCardData[];
  savedOutfits?: ClosetSavedOutfit[];
}) {
  const [, startTransition] = useTransition();
  const [serverGarments, setServerGarments] = useState(initialGarments);
  const [outfitArchive, setOutfitArchive] = useState(savedOutfits);

  const outfitSignature = useMemo(
    () =>
      `${savedOutfits.length}\0${[...savedOutfits.map((o) => `${o.id}:${o.name ?? ""}:${o.wornOn}`)].sort().join("\0")}`,
    [savedOutfits],
  );
  const [seenOutfitSignature, setSeenOutfitSignature] =
    useState(outfitSignature);
  if (outfitSignature !== seenOutfitSignature) {
    setSeenOutfitSignature(outfitSignature);
    setOutfitArchive(savedOutfits);
  }

  const garmentSignature = useMemo(
    () =>
      `${initialGarments.length}\0${[...initialGarments.map((g) => g.id)].sort().join("\0")}`,
    [initialGarments],
  );
  const [seenGarmentSignature, setSeenGarmentSignature] =
    useState(garmentSignature);
  if (garmentSignature !== seenGarmentSignature) {
    setSeenGarmentSignature(garmentSignature);
    setServerGarments(initialGarments);
  }

  const garments = serverGarments;

  const [mode, setMode] = useState<ClosetMode>("pieces");
  const [category, setCategory] = useState<CategoryFilterId>("all");
  const [colorId, setColorId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<GarmentUploadDraft[]>([]);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [savingDrafts, setSavingDrafts] = useState(false);

  const previewUrlsRef = useRef<Set<string>>(new Set());

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
  const activeColorId =
    colorId === "all" || dynamicColorFacets.some((f) => f.id === colorId)
      ? colorId
      : "all";

  const filtered = useMemo(() => {
    return garments.filter((g) => {
      if (category !== "all" && g.category !== category) return false;
      if (!garmentMatchesColorFacet(g, activeColorId)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = [
          g.name,
          g.category,
          g.color,
          g.colorLabel,
          g.description,
          g.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [garments, category, activeColorId, query]);

  const selectedGarment =
    selectedId === null
      ? null
      : (garments.find((g) => g.id === selectedId) ?? null);

  const pieceLabel =
    garments.length === 1 ? "1 piece" : `${garments.length} pieces`;

  function handleFilesReady(items: ClosetPendingLocalImage[]) {
    setPersistError(null);
    for (const item of items) previewUrlsRef.current.add(item.previewUrl);
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
            ? "Upload did not finish. Connect UploadThing in Settings, then try again."
            : "Some files did not upload. Try again or remove items from the queue.",
        );
        return;
      }

      const payload: Array<{
        mediaAssetId: string;
        name: string;
        category: GarmentUploadDraft["category"];
        color?: string;
        notes?: string;
        description?: string;
      }> = [];
      for (let i = 0; i < draftsSnapshot.length; i++) {
        const u = uploaded[i]!;
        const mediaAssetId =
          typeof u.serverData?.mediaAssetId === "string"
            ? u.serverData.mediaAssetId
            : "";
        if (!mediaAssetId) {
          setPersistError(
            "Upload succeeded but Blue Jeans could not record the file. Try again.",
          );
          return;
        }
        const d = draftsSnapshot[i]!;
        payload.push({
          mediaAssetId,
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
          optimisticGarmentFromDraft(
            d,
            payload[i]!.mediaAssetId,
          ),
        );
        draftsSnapshot.forEach((d) => {
          URL.revokeObjectURL(d.previewUrl);
          previewUrlsRef.current.delete(d.previewUrl);
        });
        setPendingDrafts([]);
        // Update base state only — also calling useOptimistic with the same
        // rows would duplicate garments until the next server refresh.
        startTransition(() => {
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
    pendingDrafts.forEach((d) => {
      URL.revokeObjectURL(d.previewUrl);
      previewUrlsRef.current.delete(d.previewUrl);
    });
    setPendingDrafts([]);
    setPersistError(null);
  }

  function updateDraft(clientKey: string, patch: Partial<GarmentUploadDraft>) {
    setPendingDrafts((prev) =>
      prev.map((d) => (d.clientKey === clientKey ? { ...d, ...patch } : d)),
    );
  }

  function removeDraft(clientKey: string) {
    const target = pendingDrafts.find((d) => d.clientKey === clientKey);
    if (target) {
      URL.revokeObjectURL(target.previewUrl);
      previewUrlsRef.current.delete(target.previewUrl);
    }
    setPendingDrafts((prev) => prev.filter((d) => d.clientKey !== clientKey));
  }

  async function handleToggleFavorite(id: string): Promise<boolean> {
    if (id.startsWith("pending:")) return false;
    const result = await toggleGarmentFavorite(id);
    if (result.ok) {
      setServerGarments((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, isFavorite: !g.isFavorite } : g,
        ),
      );
      return true;
    }
    return false;
  }

  async function handleSaveGarment(
    input: GarmentEditSaveInput,
  ): Promise<GarmentEditSaveResult> {
    if (input.id.startsWith("pending:")) {
      return { ok: false, message: "Finish uploading before editing." };
    }
    try {
      const res = await fetch("/api/closet/garments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      let result: GarmentEditSaveResult | null = null;
      try {
        const parsed = updateGarmentFieldsResultSchema.safeParse(
          await res.json(),
        );
        result = parsed.success ? parsed.data : null;
      } catch {
        return {
          ok: false,
          message: `Save failed (${res.status}). Try again.`,
        };
      }
      if (!result?.ok) {
        return {
          ok: false,
          message:
            result && "message" in result && typeof result.message === "string"
              ? result.message
              : `Save failed (${res.status}). Try again.`,
        };
      }
      setServerGarments((prev) =>
        prev.map((g) => (g.id === result.garment.id ? result.garment : g)),
      );
      return result;
    } catch (error) {
      console.error("[closet] update garment", error);
      return {
        ok: false,
        message: "Could not save that piece. Try again in a moment.",
      };
    }
  }

  async function handleDeleteGarment(id: string): Promise<GarmentDeleteResult> {
    if (id.startsWith("pending:")) {
      return { ok: false, message: "Finish uploading before removing." };
    }
    try {
      const res = await fetch("/api/closet/garments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      let result: GarmentDeleteResult | null = null;
      try {
        const parsed = deleteGarmentResultSchema.safeParse(await res.json());
        result = parsed.success ? parsed.data : null;
      } catch {
        return {
          ok: false,
          message: `Remove failed (${res.status}). Try again.`,
        };
      }
      if (!result?.ok) {
        return {
          ok: false,
          message:
            result && "message" in result && typeof result.message === "string"
              ? result.message
              : `Remove failed (${res.status}). Try again.`,
        };
      }
      setServerGarments((prev) => prev.filter((g) => g.id !== id));
      setOutfitArchive((prev) =>
        prev
          .map((o) => ({
            ...o,
            garmentIds: o.garmentIds.filter((gid) => gid !== id),
          }))
          .filter((o) => o.garmentIds.length > 0),
      );
      setSelectedId(null);
      return result;
    } catch (error) {
      console.error("[closet] delete garment", error);
      return {
        ok: false,
        message: "Could not remove that piece. Try again in a moment.",
      };
    }
  }

  const showGarments = mode === "pieces";
  const headerLabel =
    mode === "pieces"
      ? pieceLabel
      : outfitArchive.length === 1
        ? "1 outfit"
        : `${outfitArchive.length} outfits`;
  const selectedOutfit =
    selectedOutfitId === null
      ? null
      : (outfitArchive.find((o) => o.id === selectedOutfitId) ?? null);

  return (
    <div className="relative flex min-h-[calc(100svh-5rem)] flex-col">
      <header className="flex flex-col gap-6 px-1 pt-2 sm:px-0 sm:pt-6">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div
            role="tablist"
            aria-label="Closet modes"
            className="flex w-fit items-center gap-5"
          >
            {(
              [
                { id: "pieces", label: "Pieces" },
                { id: "outfits", label: "Outfits" },
              ] as const
            ).map((tab) => {
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(tab.id)}
                  className={cn(
                    "shrink-0 border-b-2 py-1 text-xs font-medium uppercase tracking-[0.08em]",
                    "transition-[color,border-color,transform] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    "active:scale-[0.98] motion-reduce:transform-none",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                    "[@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-4 sm:flex-none">
            <p className="shrink-0 text-xs tracking-[0.02em] text-muted-foreground">
              {headerLabel}
            </p>
            {showGarments ? (
              <label className="group/search relative flex w-full max-w-[15rem] items-center gap-2.5 border-b border-border/55 pb-1.5 transition-[border-color] duration-200 ease-[ease] focus-within:border-foreground">
                <Search
                  className="size-3.5 shrink-0 text-muted-foreground transition-colors duration-200 ease-[ease] group-focus-within/search:text-foreground"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pieces"
                  className="h-7 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 text-[13px] tracking-[0.02em] shadow-none placeholder:text-muted-foreground/65 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
                  aria-label="Search closet"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="grid size-6 shrink-0 place-items-center text-muted-foreground transition-[color,transform] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transform-none [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" strokeWidth={1.75} />
                  </button>
                ) : null}
              </label>
            ) : null}
          </div>
        </div>

        {showGarments ? (
          <div className="flex flex-col gap-4">
            <FilterPills value={category} onChange={setCategory} />
            {dynamicColorFacets.length > 0 ? (
              <div
                className="flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="group"
                aria-label="Filter by color"
              >
                <button
                  type="button"
                  aria-pressed={activeColorId === "all"}
                  onClick={() => setColorId("all")}
                  className={cn(
                    "shrink-0 py-1 text-xs font-medium uppercase tracking-[0.08em]",
                    "transition-[color,transform] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    "active:scale-[0.98] motion-reduce:transform-none",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                    "[@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
                    activeColorId === "all"
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  Any
                </button>
                {dynamicColorFacets.map((c) => {
                  const active = activeColorId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setColorId(c.id)}
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full",
                        "ring-2 ring-offset-2 ring-offset-background",
                        "transition-[box-shadow,transform] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]",
                        "active:scale-[0.97] motion-reduce:transform-none",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                        active ? "ring-foreground" : "ring-transparent",
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
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      {mode === "outfits" ? (
        <section className="mt-6 sm:mt-8" aria-label="Saved outfits">
          {outfitArchive.length === 0 ? (
            <div className="px-1 py-16 text-center sm:px-0">
              <p className="text-[13px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                No outfits yet
              </p>
              <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                Commit a look from Today and it will land here.
              </p>
              <Link
                href="/?change-look=1"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "mt-6 rounded-none",
                )}
              >
                Change look
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-x-[14px] gap-y-[18px] sm:grid-cols-3 sm:gap-x-[18px] md:grid-cols-4 xl:grid-cols-5">
              {outfitArchive.map((o) => {
                const src = o.imageUrl ?? o.fallbackGarmentImageUrl;
                const title = o.name?.trim() || "Outfit";
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedOutfitId(o.id)}
                      className="group flex w-full flex-col gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="relative aspect-[0.78] overflow-hidden bg-foreground/[0.03]">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element -- remote outfit URLs vary
                          <img
                            src={src}
                            alt=""
                            className="size-full object-cover transition-transform duration-220 ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                            Look
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">
                          {title}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
                          <CalendarDays className="size-3" />
                          Last worn {formatProductWornOn(o.wornOn)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {showGarments ? (
        <div
          className="mt-6 grid grid-cols-2 gap-x-2 gap-y-3 sm:mt-8 sm:grid-cols-3 sm:gap-x-[18px] sm:gap-y-[22px] md:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(165px,1fr))]"
          aria-label="Closet pieces"
        >
          {filtered.map((g) => (
            <ClothingCard
              key={g.id}
              garment={g}
              selected={selectedId === g.id}
              onSelect={(garment) => setSelectedId(garment.id)}
            />
          ))}
        </div>
      ) : null}

      {showGarments && filtered.length === 0 ? (
        <p className="mt-16 px-1 text-[13px] font-medium uppercase tracking-[0.04em] text-muted-foreground sm:px-0">
          No pieces in this filter
        </p>
      ) : null}

      {pendingDrafts.length > 0 ? (
        <div className="mt-10 flex w-full flex-col gap-4 border-t border-border/50 pt-8">
          <p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Ready to save
          </p>
          <div className="flex flex-col gap-4">
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
        </div>
      ) : null}

      {/* Slim dock: picker + save actions. Drafts live above so buttons never stack. */}
      <div
        className="sticky bottom-0 z-20 mt-auto border border-dashed border-border/70 bg-background/95 px-5 py-4 backdrop-blur-sm sm:px-8"
        data-testid="closet-add-zone"
      >
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          {pendingDrafts.length === 0 ? (
            <>
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                New archive piece
              </p>
              <p className="text-sm text-muted-foreground">
                Photos stay on your device until you add them to the closet.
              </p>
            </>
          ) : null}
          <ClosetImageUpload
            onFilesReady={handleFilesReady}
            disabled={savingDrafts}
          />
          {persistError ? (
            <p className="max-w-xs text-sm text-destructive">{persistError}</p>
          ) : null}
          {pendingDrafts.length > 0 ? (
            <div className="relative z-10 flex w-full shrink-0 flex-col gap-3 bg-background/95 pt-1 sm:flex-row sm:justify-center">
              <Button
                type="button"
                className="rounded-none"
                disabled={savingDrafts}
                onClick={() => void handleSavePendingToCloset()}
              >
                {savingDrafts ? "Uploading & saving…" : "Add to closet"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                disabled={savingDrafts}
                onClick={handleClearPending}
              >
                Clear queue
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <GarmentDetailSheet
        garment={selectedGarment}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onToggleFavorite={handleToggleFavorite}
        onSave={handleSaveGarment}
        onDelete={handleDeleteGarment}
      />

      <OutfitDetailSheet
        outfit={selectedOutfit}
        garments={garments}
        onOpenChange={(open) => {
          if (!open) setSelectedOutfitId(null);
        }}
        onRenamed={(outfitId, name) => {
          setOutfitArchive((prev) =>
            prev.map((o) => (o.id === outfitId ? { ...o, name } : o)),
          );
        }}
      />
    </div>
  );
}
