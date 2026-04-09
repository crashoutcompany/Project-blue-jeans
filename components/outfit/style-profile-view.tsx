"use client";

import { useState } from "react";
import { Flower2, Pencil, Plus, Sparkles, Upload } from "lucide-react";

import {
  MOCK_AESTHETICS,
  MOCK_CURATED_TONES,
  MOCK_MOOD_ITEMS,
  MOCK_SILHOUETTE,
  MOCK_STYLE_INSIGHTS,
  MOCK_STYLE_TAGS,
} from "@/lib/mock/style-profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const FIT_OPTIONS = ["slim", "relaxed", "boxy"] as const;

export function StyleProfileView() {
  const [aesthetic, setAesthetic] = useState<string>(
    MOCK_AESTHETICS.find((a) => a.selected)?.id ?? "minimalist"
  );
  const [fit, setFit] = useState<(typeof FIT_OPTIONS)[number]>(
    MOCK_SILHOUETTE.fit
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:max-w-none">
      <header className="max-w-2xl space-y-3">
        <h1 className="font-serif text-4xl text-[#003527] sm:text-5xl">
          Style identity
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Refine the digital DNA that steers recommendations—visual aesthetic,
          palette, silhouette, and inspiration boards (all mock data for now).
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 bg-card shadow-[0_12px_40px_rgba(26,28,27,0.04)]">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <h2 className="font-serif text-xl text-foreground">
              Visual aesthetic
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {MOCK_AESTHETICS.map((a) => {
                const active = aesthetic === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAesthetic(a.id)}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center rounded-2xl text-center text-[0.65rem] font-semibold uppercase tracking-wide transition",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <Sparkles className="mb-2 size-5 opacity-80" />
                    {a.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {MOCK_STYLE_TAGS.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                >
                  {t}
                </span>
              ))}
              <Button variant="outline" size="sm" className="rounded-full">
                <Plus className="size-3.5" />
                Add tag
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-card shadow-[0_12px_40px_rgba(26,28,27,0.04)]">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl text-foreground">
                Curated tones
              </h2>
              <span className="text-muted-foreground" aria-hidden>
                ◎
              </span>
            </div>
            <ul className="space-y-4">
              {MOCK_CURATED_TONES.map((tone) => (
                <li key={tone.name} className="flex gap-4">
                  <span
                    className="mt-0.5 size-10 shrink-0 rounded-lg border border-border/40"
                    style={{ backgroundColor: tone.hex }}
                  />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-foreground">
                      {tone.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{tone.role}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="ghost" className="gap-2 px-0 text-primary">
              <Pencil className="size-4" />
              Generate new palette
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 bg-card shadow-[0_12px_40px_rgba(26,28,27,0.04)]">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <h2 className="font-serif text-xl">Silhouette profile</h2>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-48 flex-1 items-end justify-center rounded-2xl bg-muted">
                <div className="mb-2 h-36 w-20 rounded-full bg-foreground/10" />
              </div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Height
                  </dt>
                  <dd className="font-medium">{MOCK_SILHOUETTE.heightCm} cm</dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Build
                  </dt>
                  <dd className="font-medium">{MOCK_SILHOUETTE.build}</dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Shoulders
                  </dt>
                  <dd className="font-medium">{MOCK_SILHOUETTE.shoulders}</dd>
                </div>
              </dl>
            </div>
            <div className="space-y-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Fit preferences
              </p>
              <div className="flex flex-wrap gap-2">
                {FIT_OPTIONS.map((f) => (
                  <Button
                    key={f}
                    type="button"
                    size="sm"
                    variant={fit === f ? "default" : "secondary"}
                    className={cn(
                      "rounded-full px-5 capitalize",
                      fit === f &&
                        "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                    onClick={() => setFit(f)}
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-[#501e12] text-white shadow-[0_12px_40px_rgba(26,28,27,0.08)]">
          <CardContent className="flex h-full flex-col gap-4 p-6 sm:p-8">
            <div className="flex items-center gap-2 text-white/90">
              <Flower2 className="size-5" />
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em]">
                Style insights
              </p>
            </div>
            <p className="flex-1 text-sm leading-relaxed text-white/90">
              {MOCK_STYLE_INSIGHTS}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-full bg-black/20 text-white hover:bg-black/30"
              >
                Refine AI logic
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full bg-[#c4a995] text-[#1a1c1b] hover:bg-[#b8967f]"
              >
                View matches
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Mood &amp; inspiration</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {MOCK_MOOD_ITEMS.map((item) =>
            item.tone === "upload" ? (
              <button
                key={item.id}
                type="button"
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/40 text-center text-xs font-medium text-muted-foreground transition hover:bg-muted"
              >
                <Upload className="size-6" />
                Upload moodboard
              </button>
            ) : (
              <div
                key={item.id}
                className="aspect-square overflow-hidden rounded-2xl"
                style={{ backgroundColor: item.tone }}
              >
                <div className="flex h-full items-center justify-center text-[0.65rem] font-medium text-white/80">
                  {item.label}
                </div>
              </div>
            )
          )}
        </div>
      </section>

      <footer className="flex flex-col gap-6 border-t border-border/60 pt-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-sm space-y-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Profile status
          </p>
          <Progress value={85} className="h-1.5" />
          <p className="text-xs text-muted-foreground">85% complete</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="rounded-full"
            type="button"
            onClick={() => console.info("Reset preferences (mock)")}
          >
            Reset preferences
          </Button>
          <Button
            type="button"
            className="rounded-full bg-gradient-to-br from-primary to-[#064e3b] text-primary-foreground"
            onClick={() => console.info("Save profile (mock)")}
          >
            Save profile
          </Button>
        </div>
      </footer>
    </div>
  );
}
