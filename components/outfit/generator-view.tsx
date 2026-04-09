"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { generateLookbook } from "@/app/actions/generate-lookbook";
import { MOCK_CURATOR_NOTE, MOCK_GENERATOR_LOOKS } from "@/lib/mock/outfits";
import type { OutfitLook } from "@/lib/mock/types";
import { ChipGroup } from "@/components/outfit/chip-group";
import { OutfitCard } from "@/components/outfit/outfit-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const CLIMATE = [
  { id: "temperate", label: "Temperate" },
  { id: "crisp", label: "Crisp" },
  { id: "sultry", label: "Sultry" },
] as const;

const CONTEXT = [
  { id: "studio", label: "Studio" },
  { id: "gala", label: "Gala" },
  { id: "soiree", label: "Soirée" },
] as const;

type ClimateId = (typeof CLIMATE)[number]["id"];
type ContextId = (typeof CONTEXT)[number]["id"];

function climateLabel(id: ClimateId) {
  return CLIMATE.find((c) => c.id === id)?.label ?? id;
}

function contextLabel(id: ContextId) {
  return CONTEXT.find((c) => c.id === id)?.label ?? id;
}

export function GeneratorView() {
  const [climate, setClimate] = useState<ClimateId>("temperate");
  const [context, setContext] = useState<ContextId>("gala");
  const [narrative, setNarrative] = useState("");
  const [looks, setLooks] = useState<OutfitLook[]>(MOCK_GENERATOR_LOOKS);
  const [curatorNote, setCuratorNote] = useState(MOCK_CURATOR_NOTE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const featured = looks.find((l) => l.featured);
  const secondary = looks.filter((l) => !l.featured);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateLookbook({
        climate: climateLabel(climate),
        context: contextLabel(context),
        narrative,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setLooks(result.looks);
      setCuratorNote(result.curatorNote);
    });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:max-w-none">
      <div className="space-y-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Outfit generator
        </p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Set the climate and context, add a short style narrative, and generate
          a three-look concept deck. The hero look uses{" "}
          <span className="font-medium text-foreground">Gemini 2.5 Flash Image</span>{" "}
          (Nano Banana) when your API key is configured.
        </p>
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.75fr)] lg:items-start">
        <div className="space-y-8">
          <ChipGroup
            label="Current climate"
            options={CLIMATE}
            value={climate}
            onChange={setClimate}
          />
          <ChipGroup
            label="The context"
            options={CONTEXT}
            value={context}
            onChange={setContext}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Style narrative
              </p>
              <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                <Sparkles className="size-3.5" />
                Gemini
              </span>
            </div>
            <Textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="E.g. Minimalist with a touch of Bohemian texture…"
              className="min-h-[120px] rounded-2xl border-border bg-card text-base"
              disabled={pending}
            />
          </div>
        </div>

        <Card className="border-0 bg-primary text-primary-foreground shadow-[0_12px_40px_rgba(26,28,27,0.08)]">
          <CardContent className="flex flex-col gap-4 p-6 sm:p-8">
            <h2 className="font-serif text-2xl text-primary-foreground">
              Fabricate ensembles
            </h2>
            <p className="text-sm leading-relaxed text-primary-foreground/85">
              We&apos;ll blend your narrative with the climate and context you
              choose—structured copy from Gemini Flash, optional hero render from
              Flash Image.
            </p>
            {error ? (
              <p className="text-sm text-primary-foreground/90" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={pending}
              className="mt-2 h-11 rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 disabled:opacity-60"
            >
              <Sparkles className="size-4" />
              {pending ? "Generating…" : "Generate lookbook"}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <h2 className="font-serif text-2xl text-foreground">
          Generated narratives
        </h2>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          {featured && (
            <OutfitCard look={featured} variant="featured" className="h-full" />
          )}
          <div className="flex flex-col gap-4">
            {secondary.map((look) => (
              <OutfitCard key={look.id} look={look} variant="compact" />
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#fde7dc] via-[#fceee8] to-[#f8ddd4] px-6 py-8 sm:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#501e12]/80">
              Curator&apos;s note
            </p>
            <h3 className="font-serif text-2xl text-[#1a1c1b]">
              Texture intelligence
            </h3>
            <p className="text-sm leading-relaxed text-[#3a3a38]">
              {curatorNote}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex size-28 flex-col items-center justify-center rounded-full bg-white text-center shadow-sm">
              <span className="font-serif text-xl text-[#003527]">85%</span>
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Cotton
              </span>
            </div>
            <div className="flex size-28 flex-col items-center justify-center rounded-full bg-[#003527] text-center text-primary-foreground shadow-sm">
              <span className="font-serif text-xl">12</span>
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-white/80">
                New looks
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
