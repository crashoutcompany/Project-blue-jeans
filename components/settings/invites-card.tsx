"use client";

import { useState, useTransition } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const createSchema = z.object({
  ok: z.boolean(),
  token: z.string().optional(),
  email: z.string().optional(),
  expiresAt: z.string().optional(),
  message: z.string().optional(),
});

export function InvitesCard() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function createInvite() {
    const res = await fetch("/api/settings/invites", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const parsed = createSchema.safeParse(await res.json());
    if (!parsed.success || !parsed.data.ok || !parsed.data.token) {
      throw new Error(
        parsed.success
          ? parsed.data.message || "Could not create that invite."
          : "Could not create that invite.",
      );
    }
    const url = `${window.location.origin}/invite/${parsed.data.token}`;
    setInviteUrl(url);
    setEmail("");
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Send a one-time link that expires in 7 days. The Wearer must sign in
        with this email, then open the link.
      </p>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {inviteUrl ? (
        <div className="flex flex-col gap-2">
          <p className="break-all text-sm text-foreground">{inviteUrl}</p>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(inviteUrl).then(() => {
                  setCopied(true);
                });
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      ) : null}

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setCopied(false);
          startTransition(async () => {
            try {
              await createInvite();
            } catch (e) {
              setError(
                e instanceof Error && e.message.trim()
                  ? e.message
                  : "Could not create that invite.",
              );
            }
          });
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            value={email}
            disabled={pending}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="wearer@example.com"
          />
        </div>
        <div>
          <Button type="submit" disabled={pending || !email.includes("@")}>
            {pending ? "Creating…" : "Create invite"}
          </Button>
        </div>
      </form>
    </section>
  );
}
