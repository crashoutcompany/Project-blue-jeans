"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { compressImageForUpload } from "@/lib/compress-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Local queue item before UploadThing (blob preview + file to upload on save). */
export type ClosetPendingLocalImage = {
  clientKey: string;
  file: File;
  previewUrl: string;
  name: string;
};

type ClosetImageUploadProps = {
  onFilesReady: (items: ClosetPendingLocalImage[]) => void | Promise<void>;
  disabled?: boolean;
};

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function imageFilesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data?.items?.length) return [];
  const out: File[] = [];
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && isImageFile(file)) out.push(file);
  }
  return out;
}

function imageFilesFromFileList(list: FileList | File[] | null | undefined): File[] {
  if (!list?.length) return [];
  return Array.from(list).filter(isImageFile);
}

export function ClosetImageUpload({
  onFilesReady,
  disabled = false,
}: ClosetImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hoverRef = useRef(false);
  const dragDepthRef = useRef(0);
  const inFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "preparing">("idle");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const busy = phase !== "idle" || disabled;

  const prepareAndEmit = useCallback(
    async (files: File[]) => {
      if (!files.length || disabled) return;
      if (inFlightRef.current) {
        setError("Still preparing the previous images. Wait, then try again.");
        return;
      }
      inFlightRef.current = true;
      setError(null);
      setPhase("preparing");
      try {
        const compressed = await Promise.all(
          files.map((f) => compressImageForUpload(f)),
        );
        const items: ClosetPendingLocalImage[] = compressed.map((file) => ({
          clientKey: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          name: file.name,
        }));
        await onFilesReady(items);
      } catch {
        setError("Something went wrong preparing images. Try again.");
      } finally {
        setPhase("idle");
        inFlightRef.current = false;
      }
    },
    [disabled, onFilesReady],
  );

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files;
    /** Copy before resetting input — `FileList` can be live; clearing `value` empties it. */
    const files = imageFilesFromFileList(raw ?? undefined);
    e.target.value = "";
    if (!files.length) return;
    await prepareAndEmit(files);
  }

  function onPaste(e: React.ClipboardEvent) {
    const files = imageFilesFromDataTransfer(e.clipboardData);
    if (!files.length) return;
    e.preventDefault();
    void prepareAndEmit(files);
  }

  useEffect(() => {
    if (disabled) return;
    function onDocumentPaste(e: ClipboardEvent) {
      if (!hoverRef.current) return;
      const files = imageFilesFromDataTransfer(e.clipboardData);
      if (!files.length) return;
      e.preventDefault();
      void prepareAndEmit(files);
    }
    document.addEventListener("paste", onDocumentPaste);
    return () => document.removeEventListener("paste", onDocumentPaste);
  }, [disabled, prepareAndEmit]);

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (dragDepthRef.current === 1) setIsDraggingOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDraggingOver(false);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingOver(false);
    const files = imageFilesFromFileList(e.dataTransfer.files);
    if (!files.length) {
      setError("Drop image files only.");
      return;
    }
    setError(null);
    void prepareAndEmit(files);
  }

  const label = phase === "preparing" ? "Compressing…" : "Choose photos";

  return (
    <div
      className={cn(
        "flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-transparent p-4 transition-colors",
        isDraggingOver &&
          "border-primary/60 bg-primary/5 ring-2 ring-primary/20",
      )}
      tabIndex={0}
      role="group"
      aria-label="Add closet photos"
      onMouseEnter={() => {
        hoverRef.current = true;
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
      }}
      onPaste={onPaste}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="Choose clothing photos"
        onChange={onPick}
        disabled={busy}
      />
      <Button
        type="button"
        variant="secondary"
        className="rounded-full"
        disabled={busy}
        aria-busy={busy}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Drop images here, or paste (hover this area first, or focus it with
        Tab).
      </p>
      {error ? (
        <p className="max-w-xs text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
