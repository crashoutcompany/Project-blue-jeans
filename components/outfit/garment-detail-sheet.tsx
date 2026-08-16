"use client";

import Image from "next/image";
import { useId, useState, useTransition } from "react";
import { Heart } from "lucide-react";

import { extractProductUrls } from "@/lib/ai/garments/extract-product-urls";
import type { ClothingCardData, GarmentCategoryDb } from "@/lib/garments/types";
import { GARMENT_CATEGORY_VALUES } from "@/lib/garments/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<GarmentCategoryDb, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  shoes: "Shoes",
};

export type GarmentEditSaveInput = {
  id: string;
  name: string;
  category: GarmentCategoryDb;
  color: string;
  notes: string;
  description: string;
  regenerateNameWithAi: boolean;
  regenerateDescriptionWithAi: boolean;
};

export type GarmentEditSaveResult =
  | { ok: true; garment: ClothingCardData }
  | { ok: false; message: string };

export type GarmentDeleteResult = { ok: true } | { ok: false; message: string };

export function GarmentDetailSheet({
  garment,
  onOpenChange,
  onToggleFavorite,
  onSave,
  onDelete,
}: {
  garment: ClothingCardData | null;
  onOpenChange: (open: boolean) => void;
  onToggleFavorite: (id: string) => Promise<boolean>;
  onSave: (input: GarmentEditSaveInput) => Promise<GarmentEditSaveResult>;
  onDelete: (id: string) => Promise<GarmentDeleteResult>;
}) {
  return (
    <Sheet open={garment !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto border-foreground/10 p-0 sm:max-w-[min(42rem,44vw)]"
      >
        {garment ? (
          <GarmentDetailEditor
            key={garment.id}
            garment={garment}
            onToggleFavorite={onToggleFavorite}
            onSave={onSave}
            onDelete={onDelete}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function GarmentDetailEditor({
  garment,
  onToggleFavorite,
  onSave,
  onDelete,
}: {
  garment: ClothingCardData;
  onToggleFavorite: (id: string) => Promise<boolean>;
  onSave: (input: GarmentEditSaveInput) => Promise<GarmentEditSaveResult>;
  onDelete: (id: string) => Promise<GarmentDeleteResult>;
}) {
  const formId = useId();
  const initialCategory = GARMENT_CATEGORY_VALUES.includes(
    garment.category as GarmentCategoryDb,
  )
    ? (garment.category as GarmentCategoryDb)
    : "tops";

  const [name, setName] = useState(garment.name);
  const [category, setCategory] = useState<GarmentCategoryDb>(initialCategory);
  const [color, setColor] = useState(garment.color?.trim() || "");
  const [description, setDescription] = useState(
    garment.description?.trim() || "",
  );
  const [notes, setNotes] = useState(garment.notes?.trim() || "");
  const [generateName, setGenerateName] = useState(false);
  const [generateDescription, setGenerateDescription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(Boolean(garment.isFavorite));
  const [favoritePending, setFavoritePending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const previewColor =
    (color.startsWith("#") ? color : null) ??
    garment.colorHex ??
    (garment.color?.startsWith("#") ? garment.color : "#d8d8d3");

  const productUrls = extractProductUrls(notes);
  const isPendingUpload = garment.id.startsWith("pending:");
  const canEdit = !isPendingUpload;
  const anyAi = generateName || generateDescription;

  function handleSave() {
    if (!canEdit) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await onSave({
          id: garment.id,
          name,
          category,
          color,
          notes,
          description,
          regenerateNameWithAi: generateName,
          regenerateDescriptionWithAi: generateDescription,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setName(result.garment.name);
        setCategory(
          GARMENT_CATEGORY_VALUES.includes(
            result.garment.category as GarmentCategoryDb,
          )
            ? (result.garment.category as GarmentCategoryDb)
            : category,
        );
        setColor(result.garment.color?.trim() || "");
        setDescription(result.garment.description?.trim() || "");
        setNotes(result.garment.notes?.trim() || "");
        setIsFavorite(Boolean(result.garment.isFavorite));
        setGenerateName(false);
        setGenerateDescription(false);
      } catch (e) {
        console.error("[closet] save garment editor", e);
        setError("Could not save that piece. Try again in a moment.");
      }
    });
  }

  function handleDelete() {
    if (!canEdit) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setError(null);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await onDelete(garment.id);
        if (!result.ok) {
          setError(result.message);
          setConfirmDelete(false);
        }
      } catch (e) {
        console.error("[closet] delete garment", e);
        setError("Could not remove that piece. Try again in a moment.");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <>
      <div className="relative min-h-[52svh] overflow-hidden bg-foreground/[0.045]">
        <div className="absolute left-4 top-4 z-10 rounded-sm bg-background px-3 py-2 text-xs font-medium capitalize shadow-sm">
          {category.replace(/s$/, "")}
        </div>
        {garment.imageUrl ? (
          <Image
            src={garment.imageUrl}
            alt={name || garment.name}
            fill
            className="object-contain p-8 pb-16 sm:p-12 sm:pb-20"
            sizes="(max-width: 640px) 100vw, 44vw"
            priority
          />
        ) : (
          <div className="flex min-h-[42svh] items-center justify-center text-sm capitalize text-muted-foreground">
            {garment.imageHint ?? garment.category}
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-b from-transparent via-popover/70 to-popover backdrop-blur-[3px] [mask-image:linear-gradient(to_bottom,transparent,black_42%)]"
          aria-hidden
        />
        {garment.imageUrl ? (
          <div className="absolute bottom-3 right-5 z-20 h-36 w-32 sm:bottom-4 sm:right-7 sm:h-44 sm:w-40">
            <Image
              src={garment.imageUrl}
              alt={`${name || garment.name} item preview`}
              fill
              className="object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.14)]"
              sizes="160px"
            />
          </div>
        ) : null}
      </div>

      <div className="p-5 sm:p-7">
        <SheetHeader className="flex-row items-start justify-between gap-4 p-0">
          <div className="min-w-0">
            <SheetTitle className="truncate text-xl">
              {name || garment.name}
            </SheetTitle>
            <SheetDescription className="mt-1 capitalize">
              {category}
            </SheetDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full"
            aria-label={
              isFavorite ? "Remove from favorites" : "Add to favorites"
            }
            aria-pressed={isFavorite}
            onClick={() => {
              if (favoritePending || isPendingUpload) return;
              setFavoritePending(true);
              void onToggleFavorite(garment.id)
                .then((ok) => {
                  if (ok) setIsFavorite((v) => !v);
                })
                .finally(() => setFavoritePending(false));
            }}
            disabled={isPendingUpload || favoritePending}
          >
            <Heart
              className={
                isFavorite
                  ? "fill-foreground text-foreground"
                  : "text-muted-foreground"
              }
            />
          </Button>
        </SheetHeader>

        <form
          className="mt-7 flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${formId}-name`}>Name</Label>
              <Input
                id={`${formId}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit || isPending || generateName}
                className="h-10 rounded-sm border-foreground/10 bg-transparent shadow-none"
              />
              {generateName ? (
                <p className="text-xs text-muted-foreground">
                  Name will be generated from the photo
                  {productUrls.length > 0
                    ? " and product link(s) in notes"
                    : ""}{" "}
                  on save.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${formId}-color`}>Color</Label>
              <div className="flex items-center gap-2">
                <span
                  className="size-9 shrink-0 rounded-sm ring-1 ring-foreground/10"
                  style={{ backgroundColor: previewColor }}
                  aria-hidden
                />
                <Input
                  id={`${formId}-color`}
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={!canEdit || isPending}
                  placeholder="#1a1c1b or navy"
                  className="h-10 rounded-sm border-foreground/10 bg-transparent font-mono text-sm shadow-none"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span id={`${formId}-category`} className="text-sm font-medium">
              Category
            </span>
            <div
              role="group"
              aria-labelledby={`${formId}-category`}
              className="flex flex-wrap gap-1.5"
            >
              {GARMENT_CATEGORY_VALUES.map((cat) => {
                const active = category === cat;
                return (
                  <Button
                    key={cat}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "secondary"}
                    disabled={!canEdit || isPending}
                    aria-pressed={active}
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "rounded-full px-3 text-[0.65rem] font-semibold uppercase tracking-[0.12em]",
                      active &&
                        "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    {CATEGORY_LABEL[cat]}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-description`}>
              Description (for AI)
            </Label>
            <Textarea
              id={`${formId}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit || isPending || generateDescription}
              placeholder="Catalog copy used when planning outfits"
              rows={3}
              className="min-h-20 resize-y rounded-sm border-foreground/10 bg-transparent text-sm shadow-none"
            />
            {generateDescription ? (
              <p className="text-xs text-muted-foreground">
                Description will be rewritten from the photo
                {productUrls.length > 0
                  ? " and product link(s) in notes"
                  : ""}{" "}
                on save.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-notes`}>Notes</Label>
            <Textarea
              id={`${formId}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit || isPending}
              placeholder="Fit, fabric, care, or a product page URL…"
              rows={3}
              className="min-h-20 resize-y rounded-sm border-foreground/10 bg-transparent text-sm shadow-none"
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4 rounded-sm border border-foreground/8 px-3 py-3">
              <div className="min-w-0">
                <Label
                  htmlFor={`${formId}-generate-name`}
                  className="text-sm font-medium"
                >
                  Generate Name
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {productUrls.length > 0
                    ? "Short label from the photo and product link(s)."
                    : "Short label from the photo. Add a product URL in notes for more detail."}
                </p>
              </div>
              <Switch
                id={`${formId}-generate-name`}
                checked={generateName}
                onCheckedChange={setGenerateName}
                disabled={!canEdit || isPending}
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-sm border border-foreground/8 px-3 py-3">
              <div className="min-w-0">
                <Label htmlFor={`${formId}-ai`} className="text-sm font-medium">
                  Regenerate description with AI
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {productUrls.length > 0
                    ? `Will use ${productUrls.length} product link${productUrls.length === 1 ? "" : "s"} from notes.`
                    : "Uses the photo. Add a product URL in notes to pull page details."}
                </p>
              </div>
              <Switch
                id={`${formId}-ai`}
                checked={generateDescription}
                onCheckedChange={setGenerateDescription}
                disabled={!canEdit || isPending}
              />
            </div>
          </div>

          {isPendingUpload ? (
            <p className="text-sm text-muted-foreground">
              Finish adding this piece to the closet before editing.
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="rounded-none"
            disabled={!canEdit || isPending}
          >
            {isPending && !confirmDelete
              ? anyAi
                ? "Saving & regenerating…"
                : "Saving…"
              : "Save changes"}
          </Button>
        </form>

        {canEdit ? (
          <div className="mt-6 flex flex-col gap-2 border-t border-foreground/8 pt-5">
            <Button
              type="button"
              variant="destructive"
              className="rounded-none"
              disabled={isPending}
              onClick={handleDelete}
            >
              {isPending && confirmDelete
                ? "Removing…"
                : confirmDelete
                  ? "Delete photo and piece?"
                  : "Remove from closet"}
            </Button>
            {confirmDelete && !isPending ? (
              <p className="text-xs text-muted-foreground">
                This deletes the photo from storage. Looks that only used this
                piece will be removed.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
