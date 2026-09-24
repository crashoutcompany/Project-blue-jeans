"use client";

import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { SendHorizontal, Sparkles } from "lucide-react";

import type { ClothingCardData } from "@/lib/garments/types";
import { MAX_NARRATIVE_LEN } from "@/lib/garments/field-limits";
import type { GenerateLookbookResult } from "@/lib/lookbook/generate-lookbook";
import { APPROVE_OUTFIT_MAX_IMAGE_URL_LEN } from "@/lib/outfits/approve-outfit-limits";
import type { ApproveOutfitResult } from "@/lib/outfits/persist-generator-outfit";
import {
  generateLookbookResultSchema,
  type OutfitLook,
} from "@/lib/outfits/types";
import {
  categoryByIdFromCatalog,
  validateIncludeAvoidPair,
  validateMustWearIncludes,
} from "@/lib/outfits/look-composition";
import { productTodayIso } from "@/lib/time/product-timezone";
import { GeneratorChatStack } from "@/components/outfit/generator-chat-stack";
import {
  GeneratorIncludeAvoidPicker,
  marksToIds,
  type ConstraintMap,
} from "@/components/outfit/generator-include-avoid";
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
  committedOutfitTopIds = [],
  onApproved,
  onHasGeneratedOptionsChange,
}: {
  closetGarments: ClothingCardData[];
  wornOn?: string;
  committedOutfitTopIds?: readonly string[];
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
  // Refs, not state: `disabled` and `pending` only update on the next render,
  // so two clicks in one frame would both get through.
  const approveInFlightRef = useRef(false);
  const generateInFlightRef = useRef(false);
  useEffect(() => {
    onHasGeneratedOptionsChangeRef.current = onHasGeneratedOptionsChange;
  });

  const closetSig = useMemo(
    () => idsSignature(closetGarments),
    [closetGarments],
  );
  const omittedIds = useMemo(
    () => new Set(committedOutfitTopIds),
    [committedOutfitTopIds],
  );
  const [marks, setMarks] = useState<ConstraintMap>({});
  const visibleMarks = useMemo(() => {
    const closetIds = new Set(closetGarments.map((garment) => garment.id));
    return Object.fromEntries(
      Object.entries(marks).filter(
        ([id]) => closetIds.has(id) && !omittedIds.has(id),
      ),
    );
  }, [closetGarments, marks, omittedIds]);

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
      // A disabled button is not enough: two clicks in the same frame both
      // enter here before React re-renders, saving the outfit twice.
      if (approveInFlightRef.current) return;
      approveInFlightRef.current = true;
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
        approveInFlightRef.current = false;
        setApproveSavingLookId(null);
      }
    },
    [onApproved, wornOn],
  );

  const visibleGarments = useMemo(
    () => closetGarments.filter((g) => !omittedIds.has(g.id)),
    [closetGarments, omittedIds],
  );
  const categoryById = useMemo(
    () => categoryByIdFromCatalog(visibleGarments),
    [visibleGarments],
  );

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
    // Starter buttons call this directly and rely on `disabled`, which lags a
    // frame behind. Generation spends the account's Gemini quota, so guard it
    // with a ref rather than the pending transition state.
    if (generateInFlightRef.current) return;
    generateInFlightRef.current = true;
    setError(null);

    const { includedGarmentIds, avoidedGarmentIds } = marksToIds(visibleMarks);
    const visibleIds = new Set(visibleGarments.map((g) => g.id));
    const included = includedGarmentIds.filter((id) => visibleIds.has(id));
    const avoided = avoidedGarmentIds.filter((id) => visibleIds.has(id));
    const pairError = validateIncludeAvoidPair(included, avoided);
    if (pairError) {
      setError(pairError);
      generateInFlightRef.current = false;
      return;
    }
    if (included.length > 0) {
      const includeError = validateMustWearIncludes(included, categoryById);
      if (includeError) {
        setError(includeError);
        generateInFlightRef.current = false;
        return;
      }
    }

    const userId = crypto.randomUUID();
    setMessages((m) => [...m, { id: userId, role: "user", text: trimmed }]);

    startTransition(async () => {
      try {
        let result: GenerateLookbookResult;
        try {
          const res = await fetch("/api/generate-lookbook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              narrative: buildNarrative(trimmed),
              ...(included.length > 0 ? { includedGarmentIds: included } : {}),
              ...(avoided.length > 0 ? { avoidedGarmentIds: avoided } : {}),
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
      } finally {
        generateInFlightRef.current = false;
      }
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
  const sendDisabled = pending;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-2 sm:px-6">
        <GeneratorIncludeAvoidPicker
          key={closetSig}
          closetGarments={closetGarments}
          omittedIds={omittedIds}
          marks={visibleMarks}
          onChange={setMarks}
          pending={pending}
          chatActive={messages.length > 0}
        />
      </div>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-6"
      >
        {showStarters ? (
          <div className="flex flex-col gap-6 pt-2">
            <div className="flex max-w-md flex-col gap-2">
              <h2 className="text-pretty font-serif text-2xl tracking-tight text-foreground sm:text-[1.75rem]">
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
