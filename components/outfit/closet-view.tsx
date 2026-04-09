"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Settings2, Sparkles } from "lucide-react";

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
import { cn } from "@/lib/utils";

const COLOR_FILTERS = [
  { id: "all", hex: "transparent", label: "All" },
  { id: "cream", hex: "#f5f0e6", label: "Cream" },
  { id: "sand", hex: "#d4c4a8", label: "Sand" },
  { id: "emerald", hex: "#0d3d30", label: "Emerald" },
  { id: "terracotta", hex: "#8b4a3c", label: "Terracotta" },
] as const;

function garmentMatchesColorFilter(
  g: ClothingCardData,
  colorId: (typeof COLOR_FILTERS)[number]["id"],
): boolean {
  if (colorId === "all") return true;
  const swatch = COLOR_FILTERS.find((c) => c.id === colorId);
  if (!swatch || swatch.hex === "transparent") return true;

  const raw = (g.color ?? "").trim().toLowerCase();
  const hex = (g.colorHex ?? "").toLowerCase();
  const label = (g.colorLabel ?? "").trim().toLowerCase();

  if (hex && hex === swatch.hex.toLowerCase()) return true;
  if (raw && raw === swatch.hex.toLowerCase()) return true;
  if (raw && raw === swatch.label.toLowerCase()) return true;
  if (raw && raw === swatch.id.toLowerCase()) return true;
  if (label && label === swatch.label.toLowerCase()) return true;

  return false;
}

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
  const [colorId, setColorId] =
    useState<(typeof COLOR_FILTERS)[number]["id"]>("all");
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

  const filtered = useMemo(() => {
    return initialGarments.filter((g) => {
      if (category !== "all" && g.category !== category) return false;
      if (!garmentMatchesColorFilter(g, colorId)) return false;
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
            "Upload succeeded but no public URL was returned. Check the dev server console.",
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
    } catch (e) {
      setPersistError(
        e instanceof Error ? e.message : "Could not complete upload or save.",
      );
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
    <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:max-w-none">
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
                {COLOR_FILTERS.map((c) => {
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
                      aria-label={c.label}
                    >
                      <span
                        className="size-7 rounded-full border border-border/40"
                        style={{
                          backgroundColor:
                            c.hex === "transparent" ? "#e2e3e0" : c.hex,
                        }}
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-2 border-dashed border-border/80 bg-transparent shadow-none">
          <CardContent className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 p-6 text-center">
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
