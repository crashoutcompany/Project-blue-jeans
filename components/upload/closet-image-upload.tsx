"use client";

import { useRef, useState } from "react";

import { compressImageForUpload } from "@/lib/compress-image";
import { Button } from "@/components/ui/button";

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

export function ClosetImageUpload({
  onFilesReady,
  disabled = false,
}: ClosetImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "preparing">("idle");

  const busy = phase !== "idle" || disabled;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const raw = e.target.files;
    /** Copy before resetting input — `FileList` can be live; clearing `value` empties it. */
    const files = raw?.length ? Array.from(raw) : [];
    e.target.value = "";
    if (!files.length) return;

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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setPhase("idle");
    }
  }

  const label = phase === "preparing" ? "Compressing…" : "Choose photos";

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
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
      {error ? (
        <p className="max-w-xs text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
