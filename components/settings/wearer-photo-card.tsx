"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";

function publicImageUrl(file: {
  ufsUrl?: string;
  url?: string;
  appUrl?: string;
}) {
  return file.ufsUrl || file.url || file.appUrl || "";
}

export function WearerPhotoCard({
  initialImageUrl,
}: {
  initialImageUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const { startUpload } = useUploadThing("wearerPhoto");

  async function persist(url: string, key?: string) {
    const res = await fetch("/api/wearer/photo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ url, key: key ?? null }),
    });
    let payload: { ok: boolean; message?: string };
    try {
      payload = (await res.json()) as { ok: boolean; message?: string };
    } catch {
      throw new Error("Save returned an invalid response.");
    }
    if (!payload.ok) {
      throw new Error(payload.message || "Could not save photo.");
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await startUpload([file]);
      const first = uploaded?.[0];
      const url = first ? publicImageUrl(first) : "";
      if (!url) {
        setError(
          "Upload did not finish. Set UPLOADTHING_TOKEN, restart the dev server, and try again.",
        );
        return;
      }
      await persist(url, first?.key);
      setImageUrl(url);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error && e.message.trim()
          ? e.message
          : "Could not upload photo. Try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/wearer/photo", {
          method: "DELETE",
          credentials: "same-origin",
        });
        const payload = (await res.json()) as {
          ok: boolean;
          message?: string;
        };
        if (!payload.ok) {
          setError(payload.message || "Could not remove photo.");
          return;
        }
        setImageUrl(null);
        router.refresh();
      } catch {
        setError("Could not remove photo. Try again.");
      }
    });
  }

  const busy = uploading || pending;

  return (
    <section className="flex flex-col gap-5">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt="Your wearer photo"
            fill
            className="object-cover"
            sizes="320px"
            unoptimized={imageUrl.startsWith("data:")}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No photo yet — add a full-length reference for try-on looks.
          </div>
        )}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void handleFile(file);
        }}
      />

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Working…" : imageUrl ? "Replace photo" : "Add wearer photo"}
        </Button>
        {imageUrl ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={handleRemove}
          >
            Remove
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        One full-length photo works best. New Fits and Change look heroes will
        try you on in these clothes when a photo is saved.
      </p>
    </section>
  );
}
