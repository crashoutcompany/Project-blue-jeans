"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UploadThingSettingsView } from "@/lib/credentials/types";

const mutationSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
});

export function UploadThingCard({
  initial,
}: {
  initial: UploadThingSettingsView;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState("");
  const [replacing, setReplacing] = useState(false);
  const connected = initial.connected;
  // Write-only: the stored token is never sent back, so the form only ever
  // holds what the Wearer is typing right now.
  const showForm = !connected || replacing;

  if (!initial.canEdit) {
    return (
      <section className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {initial.connected
            ? "Blue Jeans funds UploadThing for your owner account. Other Wearers connect their own token here."
            : "Blue Jeans funds UploadThing for your owner account, but UPLOADTHING_TOKEN is not set on the server."}
        </p>
      </section>
    );
  }

  async function persist(method: "PUT" | "DELETE") {
    const res = await fetch("/api/settings/providers/uploadthing", {
      method,
      credentials: "same-origin",
      headers:
        method === "PUT"
          ? { "Content-Type": "application/json" }
          : undefined,
      body: method === "PUT" ? JSON.stringify({ token }) : undefined,
    });
    const parsed = mutationSchema.safeParse(await res.json());
    if (!parsed.success || !parsed.data.ok) {
      throw new Error(
        parsed.success
          ? parsed.data.message || "Could not update UploadThing."
          : "Could not update UploadThing.",
      );
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {connected ? (
        <p className="text-sm text-muted-foreground">
          Connected. Closet photos stay in your UploadThing app.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Blue Jeans stores this token encrypted and uses it only for your
          photos. Create an app in the{" "}
          <a
            href="https://uploadthing.com/dashboard"
            className="underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            UploadThing dashboard
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
            Replace token
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
                      : "Could not disconnect UploadThing.",
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
                setToken("");
                setReplacing(false);
                router.refresh();
              } catch (e) {
                setError(
                  e instanceof Error && e.message.trim()
                    ? e.message
                    : "Could not save that token.",
                );
              }
            });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="uploadthing-token">
              {replacing ? "New API token" : "API token"}
            </Label>
            <Input
              id="uploadthing-token"
              type="password"
              name="uploadthing-token"
              autoComplete="off"
              spellCheck={false}
              value={token}
              disabled={pending}
              onChange={(event) => setToken(event.target.value)}
              placeholder="UploadThing token"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || token.trim().length < 8}>
              {pending ? "Checking…" : "Save token"}
            </Button>
            {replacing ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setToken("");
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
