"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClosetPendingLocalImage } from "@/components/upload/closet-image-upload";
import {
  GARMENT_CATEGORY_VALUES,
  type GarmentCategoryDb,
} from "@/lib/garments/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<GarmentCategoryDb, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  shoes: "Shoes",
};

export type GarmentUploadDraft = ClosetPendingLocalImage & {
  displayName: string;
  category: GarmentCategoryDb;
  color: string;
  notes: string;
  description: string;
};

export function garmentDraftFromLocalPick(
  item: ClosetPendingLocalImage,
): GarmentUploadDraft {
  const displayName =
    item.name.replace(/\.[^/.]+$/, "").trim() || "Photo";
  return {
    ...item,
    displayName,
    category: "tops",
    color: "",
    notes: "",
    description: "",
  };
}

type ClosetGarmentDraftCardProps = {
  draft: GarmentUploadDraft;
  onChange: (patch: Partial<GarmentUploadDraft>) => void;
  onRemove: () => void;
  disabled?: boolean;
};

export function ClosetGarmentDraftCard({
  draft,
  onChange,
  onRemove,
  disabled,
}: ClosetGarmentDraftCardProps) {
  return (
    <Card className="overflow-hidden border border-border/80 bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
          <div className="relative mx-auto aspect-square w-full max-w-[140px] shrink-0 overflow-hidden rounded-2xl bg-muted sm:mx-0">
            <Image
              src={draft.previewUrl}
              alt={draft.displayName || draft.name}
              fill
              unoptimized
              className="object-cover"
              sizes="140px"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Not uploaded yet
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
                disabled={disabled}
                aria-label="Remove from queue"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`closet-name-${draft.clientKey}`}>Name</Label>
              <Input
                id={`closet-name-${draft.clientKey}`}
                value={draft.displayName}
                onChange={(e) => onChange({ displayName: e.target.value })}
                disabled={disabled}
                placeholder="e.g. Black crewneck"
                className="h-9 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Category</span>
              <div className="flex flex-wrap gap-1.5">
                {GARMENT_CATEGORY_VALUES.map((cat) => {
                  const active = draft.category === cat;
                  return (
                    <Button
                      key={cat}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "secondary"}
                      disabled={disabled}
                      onClick={() => onChange({ category: cat })}
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

            <div className="space-y-1.5">
              <Label htmlFor={`closet-color-${draft.clientKey}`}>Color</Label>
              <Input
                id={`closet-color-${draft.clientKey}`}
                value={draft.color}
                onChange={(e) => onChange({ color: e.target.value })}
                disabled={disabled}
                placeholder="#1a1c1b or navy"
                className="h-9 rounded-lg font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`closet-description-${draft.clientKey}`}>
                Description (for AI)
              </Label>
              <Textarea
                id={`closet-description-${draft.clientKey}`}
                value={draft.description}
                onChange={(e) => onChange({ description: e.target.value })}
                disabled={disabled}
                placeholder="Optional. Leave blank and we’ll describe the photo with Gemini when you add to closet."
                rows={2}
                className="min-h-[4.5rem] resize-y rounded-lg text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`closet-notes-${draft.clientKey}`}>Notes</Label>
              <Textarea
                id={`closet-notes-${draft.clientKey}`}
                value={draft.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                disabled={disabled}
                placeholder="Fit, fabric, care…"
                rows={2}
                className="min-h-[4.5rem] resize-y rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
