"use client";

import Image from "next/image";
import Link from "next/link";
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
import { MAX_NARRATIVE_LEN } from "@/lib/garments/field-limits";
import { shouldBypassImageOptimizer } from "@/lib/media/display";
import type { GenerateLookbookResult } from "@/lib/lookbook/generate-lookbook";
import { APPROVE_OUTFIT_MAX_IMAGE_URL_LEN } from "@/lib/outfits/approve-outfit-limits";
import type { ApproveOutfitResult } from "@/lib/outfits/persist-generator-outfit";
import {
  generateLookbookResultSchema,
  type OutfitLook,
} from "@/lib/outfits/types";
import { productTodayIso } from "@/lib/time/product-timezone";
import { GeneratorChatStack } from "@/components/outfit/generator-chat-stack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { z } from "zod";

const approveOutfitResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), outfitId: z.string() }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);

const STARTERS = [
  {
    label: "Gallery opening",
    hint: "Polished, a little unexpected",
    prompt: "A gallery opening tonight — polished, a little unexpected.",
  },
  {
    label: "Travel day",
    hint: "Comfortable, still put together",
    prompt: "A long travel day — comfortable, still put together.",
  },
  {
    label: "Ruby and charcoal",
    hint: "Build the look around this palette",
    prompt: "Build around ruby and charcoal.",
  },
] as const;

const REMIX_SUGGESTIONS = [
  "Make it more formal",
  "Change the palette toward ruby and charcoal",
  "Add a statement accessory",
  "Show me more texture and layering",
] as const;

function idsSignature(garments: ClothingCardData[]) {
  return garments.map((g) => g.id).join("\0");
}

function garmentThumb(g: ClothingCardData, sizes: string) {
  const hasImage = Boolean(g.imageUrl);
  if (hasImage) {
    return (
      <Image
        src={g.imageUrl!}
        alt=""
        fill
        className="object-cover"
        sizes={sizes}
        unoptimized={shouldBypassImageOptimizer(g.imageUrl!)}
      />
    );
  }
  return (
    <div
      className="size-full"
      style={{ backgroundColor: `${g.colorHex ?? "#e8e8e6"}40` }}
    />
  );
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
  const [open, setOpen] = useState(false);
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

  const previewGarments: ClothingCardData[] = [];
  for (const g of closetGarments) {
    if (!selectedIds.has(g.id)) continue;
    previewGarments.push(g);
    if (previewGarments.length === 3) break;
  }

  const count = closetGarments.length;
  const summary =
    count === 0
      ? "No pieces yet"
      : allSelected
        ? count === 1
          ? "Using 1 piece"
          : `Using all ${count} pieces`
        : selectedIds.size === 0
          ? "No pieces selected"
          : `${selectedIds.size} of ${count} pieces`;

  function patchSelection(updater: (prev: Set<string>) => Set<string>) {
    const next = updater(selectedIds);
    setSelectedIds(next);
    onSelectionChange(next);
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

  if (closetGarments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="closet-scope-panel"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2.5 text-left",
          "transition-[transform,background-color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]",
          "active:scale-[0.985]",
          "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          pending && "opacity-60",
        )}
      >
        <div className="flex shrink-0" aria-hidden>
          {previewGarments.map((g, i) => (
            <div
              key={g.id}
              className="relative size-8 overflow-hidden rounded-md bg-muted ring-2 ring-popover"
              style={{ marginLeft: i === 0 ? 0 : -8 }}
            >
              {garmentThumb(g, "32px")}
            </div>
          ))}
        </div>
        <span className="sr-only">Closet scope, </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {summary}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          id="closet-scope-panel"
          role="region"
          aria-label="Pieces to include"
          className="flex flex-col gap-2 animate-in fade-in duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none"
        >
          <div className="flex items-center justify-end gap-1 px-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={pending || allSelected}
              onClick={selectAllGarments}
            >
              All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={pending || selectedIds.size === 0}
              onClick={clearGarmentSelection}
            >
              None
            </Button>
          </div>
          <ul className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {closetGarments.map((g) => {
              const checked = selectedIds.has(g.id);
              return (
                <li key={g.id} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={checked}
                    disabled={pending}
                    onClick={() =>
                      patchSelection((prev) => {
                        const next = new Set(prev);
                        if (next.has(g.id)) next.delete(g.id);
                        else next.add(g.id);
                        return next;
                      })
                    }
                    className={cn(
                      "flex w-[4.5rem] flex-col gap-1.5 text-left",
                      "transition-[transform,opacity] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]",
                      "active:scale-[0.97]",
                      "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      checked ? "opacity-100" : "opacity-40",
                      pending && "pointer-events-none",
                    )}
                  >
                    <div className="relative aspect-[0.78] w-[4.5rem] overflow-hidden rounded-xl bg-muted">
                      {garmentThumb(g, "72px")}
                    </div>
                    <span className="truncate text-[0.65rem] leading-tight text-foreground">
                      {g.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
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
  wornOn,
  onApproved,
  onHasGeneratedOptionsChange,
}: {
  closetGarments: ClothingCardData[];
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
  useEffect(() => {
    onHasGeneratedOptionsChangeRef.current = onHasGeneratedOptionsChange;
  });

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
          const parsed = approveOutfitResultSchema.safeParse(await res.json());
          if (!parsed.success) {
            setError("Unexpected response from the server.");
            return;
          }
          result = parsed.data;
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
    if (thread.length <= MAX_NARRATIVE_LEN) return thread;
    return thread.slice(thread.length - MAX_NARRATIVE_LEN);
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
        } else {
          const parsed = generateLookbookResultSchema.safeParse(payload);
          result = parsed.success
            ? parsed.data
            : {
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

  const showStarters = messages.length === 0 && !pending;
  const showRemix = messagesHaveGeneratedOptions(messages);
  const sendDisabled =
    pending || (closetGarments.length > 0 && selectedIds.size === 0);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-3 sm:px-6">
        <GeneratorClosetScope
          key={closetSig}
          closetGarments={closetGarments}
          pending={pending}
          onSelectionChange={onClosetSelectionChange}
        />
      </div>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 sm:px-6"
      >
        {showStarters ? (
          <div className="flex flex-col gap-6 pt-2">
            <div className="flex max-w-md flex-col gap-2">
              <h2 className="font-serif text-2xl tracking-tight text-foreground sm:text-[1.75rem]">
                What are you dressing for?
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Three looks from your closet. Pick a starting point, or type
                your own.
              </p>
              {closetGarments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add pieces in{" "}
                  <Link
                    href="/closet"
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    Closet
                  </Link>{" "}
                  to dress from what you own.
                </p>
              ) : null}
            </div>

            <ul className="flex max-w-lg flex-col gap-2">
              {STARTERS.map((starter, index) => (
                <li
                  key={starter.label}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none motion-reduce:opacity-100"
                  style={{
                    animationDelay: `${index * 40}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <button
                    type="button"
                    disabled={sendDisabled}
                    onClick={() => runGeneration(starter.prompt)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-2xl bg-muted/50 px-4 py-3.5 text-left",
                      "transition-[transform,background-color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]",
                      "active:scale-[0.97]",
                      "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      "disabled:pointer-events-none disabled:opacity-50",
                      "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted",
                    )}
                  >
                    <span className="font-serif text-base tracking-tight text-foreground">
                      {starter.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {starter.hint}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((msg) => {
          if (msg.role === "user") {
            return (
              <div
                key={msg.id}
                className="flex justify-end animate-in fade-in duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none"
              >
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
                  className="max-w-[min(100%,32rem)] rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
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
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <GeneratorChatStack
                  key={msg.id}
                  messageId={msg.id}
                  looks={msg.looks}
                  approvedLookId={approvedByMessage[msg.id] ?? null}
                  onApprove={handleApprove}
                  onRemix={handleRemix}
                  disabled={pending}
                  busyLookId={approveSavingLookId}
                  closetGarments={closetGarments}
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
          <p className="text-sm text-muted-foreground animate-pulse">
            Pulling three looks…
          </p>
        ) : null}
      </div>

      <div className="shrink-0 bg-popover/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex flex-col gap-3">
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {showRemix ? (
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {REMIX_SUGGESTIONS.map((label) => (
                <Button
                  key={label}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  className="shrink-0 rounded-full text-xs font-normal active:scale-[0.97] transition-transform duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]"
                  onClick={() => runGeneration(label)}
                >
                  {label}
                </Button>
              ))}
            </div>
          ) : null}
          <form
            onSubmit={handleSubmit}
            className={cn(
              "flex items-center gap-1 rounded-2xl bg-muted/60 p-1.5",
              "transition-[box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
              "focus-within:ring-3 focus-within:ring-ring/50",
            )}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="A dinner, a color, a mood…"
              disabled={pending}
              className="h-10 flex-1 border-0 bg-transparent px-3 text-base shadow-none focus-visible:ring-0 md:text-sm dark:bg-transparent"
              aria-label="Outfit request"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sendDisabled}
              className="size-10 shrink-0 rounded-xl active:scale-[0.97] transition-transform duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]"
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
