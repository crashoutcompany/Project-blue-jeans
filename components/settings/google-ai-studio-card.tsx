"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GoogleAiStudioSettingsView } from "@/lib/credentials/types";

const mutationSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
});

export function GoogleAiStudioCard({
  initial,
}: {
  initial: GoogleAiStudioSettingsView;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [apiKey, setApiKey] = useState("");
  const [replacing, setReplacing] = useState(false);
  const connected = initial.connected;
  // Write-only: the stored key is never sent back, so the form only ever
  // holds what the Wearer is typing right now.
  const showForm = !connected || replacing;

  if (!initial.canEdit) {
    return (
      <section className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {initial.connected
            ? "Blue Jeans funds Google AI Studio for your owner account. Other Wearers connect their own key here."
            : "Blue Jeans funds Google AI Studio for your owner account, but GOOGLE_GENERATIVE_AI_API_KEY is not set on the server."}
        </p>
      </section>
    );
  }

  async function persist(method: "PUT" | "DELETE") {
    const res = await fetch("/api/settings/providers/google-ai-studio", {
      method,
      credentials: "same-origin",
      headers:
        method === "PUT"
          ? { "Content-Type": "application/json" }
          : undefined,
      body: method === "PUT" ? JSON.stringify({ apiKey }) : undefined,
    });
    const parsed = mutationSchema.safeParse(await res.json());
    if (!parsed.success || !parsed.data.ok) {
      throw new Error(
        parsed.success
          ? parsed.data.message || "Could not update Google AI Studio."
          : "Could not update Google AI Studio.",
      );
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {connected ? (
        <p className="text-sm text-muted-foreground">
          Connected. New Fits and closet descriptions use this key.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Blue Jeans stores this key encrypted and uses it only for your closet.
          Create one in{" "}
          <a
            href="https://aistudio.google.com/apikey"
            className="underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Google AI Studio
          </a>
          .
        </p>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!showForm ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setError(null);
              setReplacing(true);
            }}
          >
            Replace key
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await persist("DELETE");
                  router.refresh();
                } catch (e) {
                  setError(
                    e instanceof Error && e.message.trim()
                      ? e.message
                      : "Could not disconnect Google AI Studio.",
                  );
                }
              });
            }}
          >
            {pending ? "Working…" : "Disconnect"}
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await persist("PUT");
                setApiKey("");
                setReplacing(false);
                router.refresh();
              } catch (e) {
                setError(
                  e instanceof Error && e.message.trim()
                    ? e.message
                    : "Could not save that key.",
                );
              }
            });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="google-ai-studio-key">
              {replacing ? "New API key" : "API key"}
            </Label>
            <Input
              id="google-ai-studio-key"
              type="password"
              name="google-ai-studio-key"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              disabled={pending}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="AIza…"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || apiKey.trim().length < 8}>
              {pending ? "Checking…" : "Save key"}
            </Button>
            {replacing ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setApiKey("");
                  setError(null);
                  setReplacing(false);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}
