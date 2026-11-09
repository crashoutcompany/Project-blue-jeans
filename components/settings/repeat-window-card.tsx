"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_REPEAT_WINDOW_DAYS } from "@/lib/outfits/repeat-guard";

export function RepeatWindowCard({ initialDays }: { initialDays: number }) {
  const [value, setValue] = useState(String(initialDays));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const days = Number(value);
    if (
      !Number.isInteger(days) ||
      days < 0 ||
      days > MAX_REPEAT_WINDOW_DAYS
    ) {
      setError(
        `Enter a whole number of days from 0 to ${MAX_REPEAT_WINDOW_DAYS}.`,
      );
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings/repeat-window", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days }),
        });
        const json = (await res.json()) as { ok?: boolean; message?: string };
        if (!res.ok || !json.ok) {
          setError(json.message || "Could not save.");
          return;
        }
        setSaved(true);
      } catch {
        setError("Could not save. Try again.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="repeat-window-days">Days before an outfit repeats</Label>
        <Input
          id="repeat-window-days"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_REPEAT_WINDOW_DAYS}
          step={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          disabled={pending}
          className="w-28"
        />
        <p className="text-xs text-muted-foreground">
          Plan my week won&apos;t suggest an outfit you marked &ldquo;Wore
          this&rdquo; for this many days. Reusing a single piece is fine. 0
          turns it off.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-muted-foreground">Saved.</p> : null}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
