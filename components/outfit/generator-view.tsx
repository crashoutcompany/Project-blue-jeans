"use client";

import Image from "next/image";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { ChevronDown, SendHorizontal, Sparkles } from "lucide-react";

import type { ClothingCardData } from "@/lib/garments/types";
import type { GenerateLookbookResult } from "@/lib/lookbook/generate-lookbook";
import type { OutfitLook } from "@/lib/outfits/types";
import { APPROVE_OUTFIT_MAX_IMAGE_URL_LEN } from "@/lib/outfits/approve-outfit-limits";
import type { ApproveOutfitResult } from "@/lib/outfits/persist-generator-outfit";
import { productTodayIso } from "@/lib/time/product-timezone";
import { GeneratorChatStack } from "@/components/outfit/generator-chat-stack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const MAX_NARRATIVE = 2000;

const SUGGESTIONS = [
  "Make it more formal",
  "Change the palette toward ruby and charcoal",
  "Add a statement accessory",
  "Show me more texture and layering",
] as const;

function idsSignature(garments: ClothingCardData[]) {
  return garments.map((g) => g.id).join("\0");
}

function GeneratorClosetScope({
  closetGarments,
  pending,
  onSelectionChange,
}: {
  closetGarments: ClothingCardData[];
  pending: boolean;
  onSelectionChange: (ids: Set<string>) => void;
}) {
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(closetGarments.map((g) => g.id)),
  );

  useLayoutEffect(() => {
    onSelectionChange(new Set(closetGarments.map((g) => g.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync parent once per instance
  }, []);

  const allClosetIds = useMemo(
    () => new Set(closetGarments.map((g) => g.id)),
    [closetGarments],
  );

  const allSelected =
    closetGarments.length > 0 &&
    selectedIds.size === allClosetIds.size &&
    [...selectedIds].every((id) => allClosetIds.has(id));

  function patchSelection(updater: (prev: Set<string>) => Set<string>) {
    setSelectedIds((prev) => {
      const next = updater(prev);
      onSelectionChange(next);
      return next;
    });
  }

  function selectAllGarments() {
    const next = new Set(closetGarments.map((g) => g.id));
    setSelectedIds(next);
    onSelectionChange(next);
  }

  function clearGarmentSelection() {
    const next = new Set<string>();
    setSelectedIds(next);
    onSelectionChange(next);
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Closet scope
        </p>
        {closetGarments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              disabled={pending || allSelected}
              onClick={selectAllGarments}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              disabled={pending || selectedIds.size === 0}
              onClick={clearGarmentSelection}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </div>
      {closetGarments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          Add pieces in{" "}
          <span className="font-medium text-foreground">Closet</span> first.
        </p>
      ) : (
        <ScrollArea className="h-[min(200px,28vh)] rounded-xl border border-border/60 bg-background/40">
          <ul className="divide-y divide-border/60 p-1.5">
            {closetGarments.map((g) => {
              const checked = selectedIds.has(g.id);
              const hasImage = Boolean(g.imageUrl);
              return (
                <li key={g.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors",
                      "hover:bg-muted/50",
                      pending && "pointer-events-none opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        patchSelection((prev) => {
                          const next = new Set(prev);
                          if (next.has(g.id)) next.delete(g.id);
                          else next.add(g.id);
                          return next;
                        })
                      }
                      className="size-3.5 shrink-0 rounded border-input accent-primary"
                      disabled={pending}
                    />
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {hasImage ? (
                        <Image
                          src={g.imageUrl!}
                          alt={g.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div
                          className="flex size-full items-center justify-center text-[0.6rem] text-muted-foreground"
                          style={{
                            backgroundColor: `${g.colorHex ?? "#e8e8e6"}40`,
                          }}
                        >
                          Piece
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {g.name}
                      </p>
                      <p className="truncate text-[0.65rem] capitalize text-muted-foreground">
                        {g.category}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
      {closetGarments.length > 0 ? (
        <p className="text-[0.65rem] text-muted-foreground">
          {selectedIds.size} of {closetGarments.length} included
        </p>
      ) : null}
    </>
  );
}

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      looks: OutfitLook[];
      note: string;
    }
  | { id: string; role: "assistant"; error: string };

function messagesHaveGeneratedOptions(messages: ChatMessage[]) {
  return messages.some(
    (m) => m.role === "assistant" && "looks" in m && m.looks.length > 0,
  );
}

export function GeneratorView({
  closetGarments,
  variant = "page",
  wornOn,
  onApproved,
  onHasGeneratedOptionsChange,
}: {
  closetGarments: ClothingCardData[];
  variant?: "page" | "embedded";
  wornOn?: string;
  onApproved?: () => void;
  onHasGeneratedOptionsChange?: (hasOptions: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pastUserPrompts, setPastUserPrompts] = useState<string[]>([]);
  const [approvedByMessage, setApprovedByMessage] = useState<
    Record<string, string>
  >({});
  const [approveSavingLookId, setApproveSavingLookId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const onHasGeneratedOptionsChangeRef = useRef(onHasGeneratedOptionsChange);
  onHasGeneratedOptionsChangeRef.current = onHasGeneratedOptionsChange;

  const closetSig = useMemo(
    () => idsSignature(closetGarments),
    [closetGarments],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(closetGarments.map((g) => g.id)),
  );
  const onClosetSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids);
  }, []);

  useEffect(() => {
    onHasGeneratedOptionsChangeRef.current?.(
      messagesHaveGeneratedOptions(messages),
    );
  }, [messages]);

  const handleApprove = useCallback(
    async (messageId: string, look: OutfitLook) => {
      const garmentIds = look.garmentIds?.filter(Boolean) ?? [];
      if (garmentIds.length === 0) {
        setError("This look has no linked closet pieces to save.");
        return;
      }
      setError(null);
      setApproveSavingLookId(look.id);
      const imageUrl =
        look.imageDataUrl &&
        look.imageDataUrl.length <= APPROVE_OUTFIT_MAX_IMAGE_URL_LEN
          ? look.imageDataUrl
          : null;
      try {
        const res = await fetch("/api/outfits/approve-generator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            wornOn: wornOn ?? productTodayIso(),
            occasion: "casual",
            garmentIds,
            imageUrl,
          }),
        });
        let result: ApproveOutfitResult;
        try {
          result = (await res.json()) as ApproveOutfitResult;
        } catch {
          setError("Unexpected response from the server.");
          return;
        }
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setApprovedByMessage((prev) => ({ ...prev, [messageId]: look.id }));
        onApproved?.();
      } catch {
        setError(
          "Could not reach the server. Check your connection and try again.",
        );
      } finally {
        setApproveSavingLookId(null);
      }
    },
    [onApproved, wornOn],
  );

  const allClosetIds = useMemo(
    () => new Set(closetGarments.map((g) => g.id)),
    [closetGarments],
  );

  const allSelected =
    closetGarments.length > 0 &&
    selectedIds.size === allClosetIds.size &&
    [...selectedIds].every((id) => allClosetIds.has(id));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  function buildNarrative(latest: string) {
    const thread = [...pastUserPrompts, latest].join("\n\n");
    if (thread.length <= MAX_NARRATIVE) return thread;
    return thread.slice(thread.length - MAX_NARRATIVE);
  }

  function runGeneration(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed) {
      setError("Type a request to generate looks.");
      return;
    }
    setError(null);
    if (closetGarments.length > 0 && selectedIds.size === 0) {
      setError("Include at least one closet piece.");
      return;
    }

    const userId = crypto.randomUUID();
    setMessages((m) => [...m, { id: userId, role: "user", text: trimmed }]);

    startTransition(async () => {
      let result: GenerateLookbookResult;
      try {
        const res = await fetch("/api/generate-lookbook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            narrative: buildNarrative(trimmed),
            ...(!allSelected && selectedIds.size > 0
              ? { includedGarmentIds: [...selectedIds] }
              : {}),
          }),
        });

        const raw = await res.text();
        let payload: unknown;
        try {
          payload = raw.length > 0 ? JSON.parse(raw) : null;
        } catch (error) {
          console.log(error);
          const parseErr = `The server returned a non-JSON response (${res.status}). Try refreshing the page.`;
          result = { ok: false, message: parseErr };
          setMessages((m) => [
            ...m,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              error: parseErr,
            },
          ]);
          return;
        }

        if (!res.ok) {
          const msg =
            typeof payload === "object" &&
            payload !== null &&
            "message" in payload &&
            typeof (payload as { message: unknown }).message === "string"
              ? (payload as { message: string }).message
              : `Request failed (${res.status}).`;
          result = { ok: false, message: msg };
        } else if (
          typeof payload === "object" &&
          payload !== null &&
          "ok" in payload
        ) {
          result = payload as GenerateLookbookResult;
        } else {
          result = {
            ok: false,
            message: "Unexpected response from the lookbook API.",
          };
        }
      } catch {
        result = {
          ok: false,
          message:
            "Could not reach the server. Check your connection and try again.",
        };
      }

      if (!result.ok) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            error: result.message,
          },
        ]);
        return;
      }

      setPastUserPrompts((p) => [...p, trimmed]);
      const assistantId = crypto.randomUUID();
      setMessages((m) => [
        ...m,
        {
          id: assistantId,
          role: "assistant",
          looks: result.looks,
          note: result.curatorNote,
        },
      ]);
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const t = input;
    setInput("");
    runGeneration(t);
  }

  function handleRemix(look: OutfitLook) {
    if (pending) return;
    runGeneration(
      `Remix "${look.title}" with a noticeably different silhouette, palette, or layering while keeping the same overall occasion.`,
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col gap-5",
        variant === "embedded" && "max-w-none",
      )}
    >
      {variant === "page" ? (
        <div className="space-y-1">
          <h1 className="font-serif text-2xl tracking-tight text-foreground md:text-3xl">
            Outfit dialogue
          </h1>
          <p className="text-sm text-muted-foreground">
            Immersive feed—describe the moment, get a stacked lookbook from your
            closet.
          </p>
        </div>
      ) : null}

      <details className="group rounded-2xl border border-border/70 bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <span>Closet scope</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-border/60 px-4 py-4">
          <GeneratorClosetScope
            key={closetSig}
            closetGarments={closetGarments}
            pending={pending}
            onSelectionChange={onClosetSelectionChange}
          />
        </div>
      </details>

      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-3xl border border-border/80 bg-zinc-950/[0.03] shadow-inner dark:bg-zinc-950/40",
          variant === "embedded"
            ? "min-h-[min(420px,58svh)]"
            : "min-h-[min(520px,72vh)]",
        )}
      >
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-6"
        >
          {messages.length === 0 && !pending ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/80">
                <Sparkles className="size-6 text-muted-foreground" />
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">
                Ask for a gallery opening, a travel day, or a color direction.
                Your stylist returns three concepts you can flip through, each
                with an editorial hero when image generation is available.
              </p>
            </div>
          ) : null}

          {messages.map((msg) => {
            if (msg.role === "user") {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[min(100%,28rem)] rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground">
                    {msg.text}
                  </div>
                </div>
              );
            }

            if ("error" in msg) {
              return (
                <div key={msg.id} className="flex justify-start gap-3">
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"
                    aria-hidden
                  >
                    <Sparkles className="size-4 text-foreground" />
                  </div>
                  <p
                    className="max-w-[min(100%,32rem)] rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
                    role="alert"
                  >
                    {msg.error}
                  </p>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex justify-start gap-3">
                <div
                  className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"
                  aria-hidden
                >
                  <Sparkles className="size-4 text-foreground" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <GeneratorChatStack
                    messageId={msg.id}
                    looks={msg.looks}
                    approvedLookId={approvedByMessage[msg.id] ?? null}
                    onApprove={handleApprove}
                    onRemix={handleRemix}
                    disabled={pending}
                    busyLookId={approveSavingLookId}
                  />
                  {msg.note.trim().length > 0 ? (
                    <p className="max-w-prose pl-1 text-xs leading-relaxed text-muted-foreground">
                      {msg.note}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}

          {pending ? (
            <div className="flex justify-start gap-3">
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"
                aria-hidden
              >
                <Sparkles className="size-4 animate-pulse text-foreground" />
              </div>
              <div className="flex items-center gap-1.5 pt-2">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 space-y-3 border-t border-border/60 bg-background/80 px-4 py-4 backdrop-blur-md md:px-5">
          {error ? (
            <p className="text-center text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SUGGESTIONS.map((label) => (
              <Button
                key={label}
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                className="shrink-0 rounded-full text-xs font-normal"
                onClick={() => runGeneration(label)}
              >
                {label}
              </Button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your request…"
              disabled={pending}
              className="h-11 flex-1 rounded-2xl border-border/80 bg-muted/40 px-4 text-base md:text-sm"
              aria-label="Outfit request"
            />
            <Button
              type="submit"
              size="icon"
              disabled={
                pending || (closetGarments.length > 0 && selectedIds.size === 0)
              }
              className="size-11 shrink-0 rounded-2xl"
              aria-label="Send"
            >
              <SendHorizontal className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
