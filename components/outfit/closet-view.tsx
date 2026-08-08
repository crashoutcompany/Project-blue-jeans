"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { CalendarDays, Plus, Search, X } from "lucide-react";

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
import type { ClosetSavedOutfit } from "@/lib/outfits/closet-saved-outfits";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSidebar } from "@/components/ui/sidebar";
import { ClothingCard } from "@/components/outfit/clothing-card";
import { GarmentDetailSheet } from "@/components/outfit/garment-detail-sheet";
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

function formatWornOn(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function ClosetView({
  initialGarments,
  savedOutfits = [],
}: {
  initialGarments: ClothingCardData[];
  savedOutfits?: ClosetSavedOutfit[];
}) {
  const [, startTransition] = useTransition();
  const { state: sidebarState, isMobile } = useSidebar();
  const [serverGarments, setServerGarments] = useState(initialGarments);
  const addZoneRef = useRef<HTMLDivElement>(null);

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<GarmentUploadDraft[]>([]);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [savingDrafts, setSavingDrafts] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

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
      if (category !== "all" && category !== "outfits" && g.category !== category)
        return false;
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

  const selectedGarment =
    selectedId === null
      ? null
      : (garments.find((g) => g.id === selectedId) ?? null);

  const pieceLabel =
    garments.length === 1 ? "1 piece" : `${garments.length} pieces`;

  function openAddZone() {
    setAddOpen(true);
    setCategory("all");
    requestAnimationFrame(() => {
      addZoneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleFilesReady(items: ClosetPendingLocalImage[]) {
    setPersistError(null);
    setAddOpen(true);
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
        setAddOpen(false);
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

  const showGarments = category !== "outfits";

  return (
    <div className="relative flex flex-col pb-8">
      <header className="flex flex-col px-1 pt-2 sm:px-0 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[13px] font-medium uppercase tracking-[0.1em] leading-none text-foreground">
            {pieceLabel}
          </p>
          <label className="group/search relative flex w-full max-w-[15rem] items-center gap-2.5 border-b border-border/55 pb-2 transition-[border-color] duration-160 ease-[ease] focus-within:border-foreground">
            <Search
              className="size-3.5 shrink-0 text-muted-foreground transition-colors duration-160 group-focus-within/search:text-foreground"
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
                className="grid size-6 shrink-0 place-items-center text-muted-foreground transition-colors duration-160 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            ) : null}
          </label>
        </div>

        <div className="mt-10 flex flex-col gap-5 sm:mt-12">
          <FilterPills value={category} onChange={setCategory} />
          {showGarments && dynamicColorFacets.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setColorId("all")}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full ring-1 ring-offset-2 ring-offset-background transition duration-160 ease-[ease]",
                  colorId === "all" ? "ring-foreground" : "ring-transparent",
                )}
                aria-label="All colors"
                title="All colors"
              >
                <span
                  className="size-5 rounded-full border border-border/50"
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
                      "flex size-7 items-center justify-center rounded-full ring-1 ring-offset-2 ring-offset-background transition duration-160 ease-[ease]",
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
      </header>

      {addOpen || pendingDrafts.length > 0 ? (
        <div
          ref={addZoneRef}
          className="mt-10 border border-dashed border-border/70 bg-background/40 px-5 py-8 sm:px-8"
        >
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              New archive piece
            </p>
            <p className="text-sm text-muted-foreground">
              Photos stay on your device until you add them to the closet.
            </p>
            <ClosetImageUpload
              onFilesReady={handleFilesReady}
              disabled={savingDrafts}
            />
            {persistError ? (
              <p className="max-w-xs text-sm text-destructive">{persistError}</p>
            ) : null}
            {pendingDrafts.length === 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
            ) : null}
          </div>

          {pendingDrafts.length > 0 ? (
            <div className="mt-8 flex min-h-0 w-full flex-col gap-4 border-t border-border/50 pt-6">
              <p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Ready to save
              </p>
              <div className="flex max-h-[min(70vh,640px)] flex-col gap-4 overflow-y-auto overscroll-y-contain pr-1">
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
            </div>
          ) : null}
        </div>
      ) : null}

      {category === "outfits" ? (
        <section className="mt-11 sm:mt-12" aria-label="Saved outfits">
          {savedOutfits.length === 0 ? (
            <div className="px-1 py-16 text-center sm:px-0">
              <p className="text-[13px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                No outfits yet
              </p>
              <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                Approve looks from the generator and they will land here.
              </p>
              <Link
                href="/generator"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "mt-6 rounded-none",
                )}
              >
                Open generator
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-x-[14px] gap-y-[18px] sm:grid-cols-3 sm:gap-x-[18px] md:grid-cols-4 xl:grid-cols-5">
              {savedOutfits.map((o) => {
                const src = o.imageUrl ?? o.fallbackGarmentImageUrl;
                const title = o.name?.trim() || "Outfit";
                return (
                  <li key={o.id}>
                    <Link
                      href="/calendar"
                      className="group flex flex-col gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                          {formatWornOn(o.wornOn)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {showGarments ? (
        <div
          className="mt-8 grid grid-cols-2 gap-x-2 gap-y-3 sm:mt-11 sm:grid-cols-3 sm:gap-x-[18px] sm:gap-y-[22px] md:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(165px,1fr))]"
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

      {showGarments && filtered.length === 0 && !addOpen ? (
        <p className="mt-16 px-1 text-[13px] font-medium uppercase tracking-[0.04em] text-muted-foreground sm:px-0">
          No pieces in this filter
        </p>
      ) : null}

      {/* Fixed FAB clears the sidebar; expands to “Add clothes” on hover like wardrobe. */}
      <button
        type="button"
        onClick={openAddZone}
        aria-label="Add clothes"
        style={{
          left:
            isMobile || sidebarState === "collapsed"
              ? "1.125rem"
              : "calc(var(--sidebar-width) + 1.125rem)",
        }}
        className="group/tray fixed bottom-[max(1.125rem,env(safe-area-inset-bottom))] z-30 flex min-h-12 items-center gap-0 overflow-hidden rounded-full border border-white/10 bg-foreground p-1 text-background shadow-[0_8px_28px_rgba(25,23,18,0.2)] transition-[left,box-shadow] duration-220 ease-out hover:shadow-[0_12px_36px_rgba(25,23,18,0.26)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-160 group-hover/tray:bg-white/12 group-focus-visible/tray:bg-white/12">
          <Plus className="size-[19px]" strokeWidth={2} />
        </span>
        <span className="flex max-w-0 items-center overflow-hidden opacity-0 transition-[max-width,opacity] duration-320 ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover/tray:max-w-[11rem] group-hover/tray:opacity-100 group-focus-visible/tray:max-w-[11rem] group-focus-visible/tray:opacity-100">
          <span className="whitespace-nowrap px-2.5 pr-3 text-xs tracking-[0.01em]">
            Add clothes
          </span>
        </span>
      </button>

      <GarmentDetailSheet
        garment={selectedGarment}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}
