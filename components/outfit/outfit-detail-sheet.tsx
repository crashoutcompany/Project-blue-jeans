"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import {
  getTodaysOutfitId,
  renameOutfit,
  wearOutfitToday,
} from "@/app/actions/outfits";
import type { ClosetSavedOutfit } from "@/lib/outfits/closet-saved-outfits";
import type { ClothingCardData } from "@/lib/garments/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function formatWornOn(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function OutfitDetailSheet({
  outfit,
  garments,
  onOpenChange,
  onRenamed,
}: {
  outfit: ClosetSavedOutfit | null;
  garments: ClothingCardData[];
  onOpenChange: (open: boolean) => void;
  onRenamed: (outfitId: string, name: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [editingName, setEditingName] = useState(false);

  const open = outfit !== null;
  const title = outfit?.name?.trim() || "Outfit";
  const hero = outfit?.imageUrl ?? outfit?.fallbackGarmentImageUrl ?? null;

  const pieceThumbs =
    outfit?.garmentIds
      .map((id) => garments.find((g) => g.id === id))
      .filter((g): g is ClothingCardData => Boolean(g)) ?? [];

  function resetLocal() {
    setError(null);
    setConfirmReplace(false);
    setEditingName(false);
    setNameDraft("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetLocal();
    onOpenChange(next);
  }

  function runWearToday() {
    if (!outfit) return;
    setError(null);
    startTransition(async () => {
      const res = await wearOutfitToday(outfit.id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setConfirmReplace(false);
      onOpenChange(false);
      router.push("/");
      router.refresh();
    });
  }

  function handleWearToday() {
    if (!outfit) return;
    setError(null);
    startTransition(async () => {
      const todayId = await getTodaysOutfitId();
      if (todayId && todayId !== outfit.id) {
        setConfirmReplace(true);
        return;
      }
      const res = await wearOutfitToday(outfit.id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onOpenChange(false);
      router.push("/");
      router.refresh();
    });
  }

  function handleSaveName() {
    if (!outfit) return;
    setError(null);
    startTransition(async () => {
      const res = await renameOutfit(outfit.id, nameDraft);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      const next = nameDraft.trim() || null;
      onRenamed(outfit.id, next);
      setEditingName(false);
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto border-foreground/10 p-0 sm:max-w-[min(42rem,44vw)]"
        >
          {outfit ? (
            <>
              <div className="relative min-h-[42svh] overflow-hidden bg-foreground/[0.045]">
                {hero ? (
                  <Image
                    src={hero}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 44vw"
                    priority
                  />
                ) : (
                  <div className="flex min-h-[42svh] items-center justify-center text-sm text-muted-foreground">
                    Outfit
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-5 p-5 sm:p-7">
                <SheetHeader className="gap-2 p-0">
                  {editingName ? (
                    <div className="flex flex-col gap-2">
                      <Input
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        placeholder="Name this outfit"
                        aria-label="Outfit name"
                        disabled={pending}
                        className="rounded-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={handleSaveName}
                        >
                          Save name
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => setEditingName(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <SheetTitle className="font-serif text-2xl tracking-tight">
                        {title}
                      </SheetTitle>
                      <SheetDescription>
                        Last worn {formatWornOn(outfit.wornOn)}
                      </SheetDescription>
                      <button
                        type="button"
                        className="w-fit text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => {
                          setNameDraft(outfit.name?.trim() ?? "");
                          setEditingName(true);
                        }}
                      >
                        {outfit.name?.trim() ? "Rename" : "Add a name"}
                      </button>
                    </>
                  )}
                </SheetHeader>

                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}

                {pieceThumbs.length > 0 ? (
                  <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Garments
                    </h3>
                    <ul className="flex gap-3 overflow-x-auto pb-1">
                      {pieceThumbs.map((g) => (
                        <li key={g.id} className="w-16 shrink-0">
                          <div className="relative aspect-[0.78] overflow-hidden bg-muted">
                            {g.imageUrl ? (
                              <Image
                                src={g.imageUrl}
                                alt={g.name}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-[0.65rem] text-muted-foreground">
                            {g.name}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <Button
                  type="button"
                  size="lg"
                  className="rounded-none"
                  disabled={pending}
                  onClick={handleWearToday}
                >
                  {pending ? "Saving…" : "Wear today"}
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <DialogPrimitive.Root
        open={confirmReplace}
        onOpenChange={(next) => {
          if (!next) setConfirmReplace(false);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            className={cn(
              "fixed inset-0 z-[60] bg-black/20 transition-opacity duration-200",
              "supports-backdrop-filter:backdrop-blur-xs",
              "data-ending-style:opacity-0 data-starting-style:opacity-0",
            )}
          />
          <DialogPrimitive.Popup
            className={cn(
              "fixed top-1/2 left-1/2 z-[60] w-[min(100%-2rem,22rem)] -translate-x-1/2 -translate-y-1/2",
              "rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-lg",
              "transition duration-200 ease-[cubic-bezier(0.215,0.61,0.355,1)]",
              "data-starting-style:scale-[0.97] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.97] data-ending-style:opacity-0",
            )}
          >
            <DialogPrimitive.Title className="font-heading text-base font-medium">
              Replace today’s outfit?
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
              You already have something committed for today. Wear this look
              instead?
            </DialogPrimitive.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirmReplace(false)}
              >
                Keep current
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={runWearToday}
              >
                Replace
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
