"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LocationCard({ initialLocation }: { initialLocation: string }) {
  const [value, setValue] = useState(initialLocation);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings/location", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: value }),
        });
        const json = (await res.json()) as { ok?: boolean; message?: string };
        if (!res.ok || !json.ok) {
          setError(json.message || "Could not save location.");
          return;
        }
        setSaved(true);
      } catch {
        setError("Could not save location. Try again.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="wearer-location">Home city</Label>
        <Input
          id="wearer-location"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="New York, NY"
          maxLength={120}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          Used for weather-aware Fits. Empty falls back to New York, NY.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-muted-foreground">Location saved.</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save location"}
      </Button>
    </form>
  );
}
