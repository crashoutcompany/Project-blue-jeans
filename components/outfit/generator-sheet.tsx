"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import type { ClothingCardData } from "@/lib/garments/types";
import { cn } from "@/lib/utils";
import { GeneratorView } from "@/components/outfit/generator-view";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function GeneratorSheet({
  open,
  onOpenChange,
  closetGarments,
  wornOn,
  onApproved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closetGarments: ClothingCardData[];
  wornOn: string;
  onApproved?: () => void;
}) {
  const [hasGeneratedOptions, setHasGeneratedOptions] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setHasGeneratedOptions(false);
      setConfirmDiscard(false);
      setSessionKey((k) => k + 1);
    }
  }

  function requestClose() {
    if (hasGeneratedOptions) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(false);
  }

  function handleSheetOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    requestClose();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton
          className={cn(
            "inset-x-0 bottom-0 h-[min(92svh,56rem)] max-h-[92svh] gap-0 overflow-hidden rounded-t-2xl border-t p-0",
            "duration-320 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "data-[side=bottom]:data-starting-style:translate-y-full data-[side=bottom]:data-ending-style:translate-y-full",
            "motion-reduce:duration-150 motion-reduce:data-[side=bottom]:data-starting-style:translate-y-0 motion-reduce:data-[side=bottom]:data-ending-style:translate-y-0",
          )}
        >
          <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 sm:px-6">
            <SheetTitle className="font-serif text-xl tracking-tight">
              Change look
            </SheetTitle>
            <SheetDescription>
              Pick a new outfit for today from your closet.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {open ? (
              <GeneratorView
                key={sessionKey}
                closetGarments={closetGarments}
                wornOn={wornOn}
                onHasGeneratedOptionsChange={setHasGeneratedOptions}
                onApproved={() => {
                  setHasGeneratedOptions(false);
                  onOpenChange(false);
                  onApproved?.();
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <DialogPrimitive.Root
        open={confirmDiscard}
        onOpenChange={(next) => {
          if (!next) setConfirmDiscard(false);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            className={cn(
              "fixed inset-0 z-[60] bg-black/20 transition-opacity duration-200",
              "supports-backdrop-filter:backdrop-blur-xs",
              "data-ending-style:opacity-0 data-starting-style:opacity-0",
              "motion-reduce:duration-150",
            )}
          />
          <DialogPrimitive.Popup
            className={cn(
              "fixed top-1/2 left-1/2 z-[60] w-[min(100%-2rem,22rem)] -translate-x-1/2 -translate-y-1/2",
              "rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-lg",
              "transition duration-200 ease-[cubic-bezier(0.215,0.61,0.355,1)]",
              "data-starting-style:scale-[0.97] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.97] data-ending-style:opacity-0",
              "motion-reduce:transition-opacity motion-reduce:duration-150 motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <DialogPrimitive.Title className="font-heading text-base font-medium text-foreground">
              Discard looks?
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
              You have generated options that haven’t been approved. Closing
              discards them.
            </DialogPrimitive.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDiscard(false)}
              >
                Keep editing
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setConfirmDiscard(false);
                  setHasGeneratedOptions(false);
                  onOpenChange(false);
                }}
              >
                Discard
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
