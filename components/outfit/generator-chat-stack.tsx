"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { ArrowLeftRight, Check, LayoutGrid } from "lucide-react";

import type { ClothingCardData } from "@/lib/garments/types";
import { shouldBypassImageOptimizer } from "@/lib/media/display";
import {
  LOOK_STACK_MS,
  lookStackDepartTransform,
  lookStackDirection,
  lookStackDragTransform,
  lookStackOrder,
  lookStackPeekReservePx,
  lookStackRestTransform,
  shouldAdvanceLook,
  wrapLookIndex,
} from "@/lib/outfits/look-stack";
import type { OutfitLook } from "@/lib/outfits/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EMPTY_CLOSET: ClothingCardData[] = [];
const INTERACTIVE_SELECTOR = "button, a, input, textarea, select, [role='button']";

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastT: number;
  vx: number;
  armed: boolean;
};

export function GeneratorChatStack({
  messageId,
  looks,
  approvedLookId,
  onApprove,
  onRemix,
  disabled,
  busyLookId,
  closetGarments = EMPTY_CLOSET,
}: {
  messageId: string;
  looks: OutfitLook[];
  approvedLookId: string | null;
  onApprove: (messageId: string, look: OutfitLook) => void | Promise<void>;
  onRemix: (look: OutfitLook) => void;
  disabled?: boolean;
  /** When saving this look to the archive, disable only its actions. */
  busyLookId?: string | null;
  closetGarments?: ClothingCardData[];
}) {
  const slice = looks.slice(0, 3);
  // Reset via parent `key={messageId}` remount — do not sync index in an effect.
  const [index, setIndex] = useState(0);
  const [departing, setDeparting] = useState<{
    id: string;
    direction: "next" | "prev";
  } | null>(null);
  const [skipTransitionId, setSkipTransitionId] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef(new Map<string, HTMLElement>());
  const dragRef = useRef<DragSession | null>(null);
  const indexRef = useRef(0);
  const departingRef = useRef(departing);

  const safeIndex =
    slice.length === 0 ? 0 : Math.min(index, slice.length - 1);

  const multi = slice.length > 1;
  const peekReserve = lookStackPeekReservePx(slice.length);

  const garmentById = new Map<string, ClothingCardData>();
  for (const g of closetGarments) garmentById.set(g.id, g);

  useLayoutEffect(() => {
    indexRef.current = safeIndex;
    departingRef.current = departing;
  }, [safeIndex, departing]);

  useLayoutEffect(() => {
    if (!departing) return;
    const timeout = window.setTimeout(() => {
      setSkipTransitionId(departing.id);
      setDeparting(null);
    }, LOOK_STACK_MS);
    return () => window.clearTimeout(timeout);
  }, [departing]);

  useLayoutEffect(() => {
    if (!skipTransitionId) return;
    const frame = requestAnimationFrame(() => setSkipTransitionId(null));
    return () => cancelAnimationFrame(frame);
  }, [skipTransitionId]);

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function goTo(nextIndex: number) {
    if (!multi || disabled || departingRef.current) return;
    const from = indexRef.current;
    const to = wrapLookIndex(nextIndex, slice.length);
    if (to === from) return;
    const direction = lookStackDirection(from, to, slice.length);
    if (prefersReducedMotion()) {
      setIndex(to);
      return;
    }
    setDeparting({ id: slice[from]!.id, direction });
    setIndex(to);
  }

  function go(delta: number) {
    goTo(indexRef.current + (delta > 0 ? 1 : -1));
  }

  function restTransformFor(lookId: string, itemIndex: number) {
    if (departing && lookId === departing.id) {
      return lookStackDepartTransform(departing.direction);
    }
    const order = lookStackOrder(itemIndex, safeIndex, slice.length);
    return lookStackRestTransform(order);
  }

  function writeDragTransforms(dx: number) {
    const width = stageRef.current?.offsetWidth ?? 320;
    for (const [id, el] of cardEls.current) {
      const itemIndex = slice.findIndex((item) => item.id === id);
      if (itemIndex < 0) continue;
      const order = lookStackOrder(itemIndex, indexRef.current, slice.length);
      el.style.transform = lookStackDragTransform(
        order,
        dx,
        width,
        slice.length,
      );
    }
  }

  function writeRestTransforms() {
    for (const [id, el] of cardEls.current) {
      const itemIndex = slice.findIndex((item) => item.id === id);
      if (itemIndex < 0) continue;
      el.style.transform = restTransformFor(id, itemIndex);
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!multi || disabled || departing || e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest(INTERACTIVE_SELECTOR)) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastT: e.timeStamp,
      vx: 0,
      armed: false,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) {
      drag.vx = (e.clientX - drag.lastX) / dt;
      drag.lastX = e.clientX;
      drag.lastT = e.timeStamp;
    }
    if (!drag.armed) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null;
        return;
      }
      drag.armed = true;
      stageRef.current?.setPointerCapture?.(e.pointerId);
      stageRef.current?.setAttribute("data-dragging", "");
      stageRef.current?.classList.add("select-none");
    }
    writeDragTransforms(dx);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    const dx = e.clientX - drag.startX;
    if (drag.armed) {
      stageRef.current?.removeAttribute("data-dragging");
      stageRef.current?.classList.remove("select-none");
      const advance = shouldAdvanceLook(dx, drag.vx);
      if (advance) go(advance === "next" ? 1 : -1);
      else writeRestTransforms();
    }
    if (stageRef.current?.hasPointerCapture?.(e.pointerId)) {
      stageRef.current.releasePointerCapture(e.pointerId);
    }
  }

  function onStageKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!multi || disabled) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  }

  if (slice.length === 0) return null;

  const look = slice[safeIndex]!;
  const lookBusy = Boolean(busyLookId && busyLookId === look.id);
  const controlsDisabled = Boolean(disabled || lookBusy);

  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-[2rem]",
          "bg-[radial-gradient(120%_80%_at_10%_0%,color-mix(in_srgb,var(--tertiary)_14%,transparent),transparent_55%),radial-gradient(90%_70%_at_100%_10%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_50%)]",
        )}
        aria-hidden
      />

      {multi ? (
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <LayoutGrid className="size-3.5" aria-hidden />
          <span>
            {slice.length} {slice.length === 1 ? "Photo" : "Photos"}
          </span>
        </p>
      ) : null}

      <div
        ref={stageRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Generated outfit looks"
        tabIndex={multi ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onStageKeyDown}
        className={cn(
          "look-stack-stage relative overflow-hidden touch-pan-y outline-none",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
        style={{ paddingRight: peekReserve }}
      >
        <div className="relative grid">
          {slice.map((item, itemIndex) => {
            const order = lookStackOrder(itemIndex, safeIndex, slice.length);
            const isFront = order === 0 && departing?.id !== item.id;
            const isDeparting = departing?.id === item.id;
            return (
              <LookStackCard
                key={item.id}
                look={item}
                itemIndex={itemIndex}
                order={order}
                isFront={isFront}
                isDeparting={isDeparting}
                skipTransition={skipTransitionId === item.id}
                transform={restTransformFor(item.id, itemIndex)}
                garmentById={garmentById}
                approvedLookId={approvedLookId}
                controlsDisabled={isFront ? controlsDisabled : true}
                lookBusy={Boolean(busyLookId && busyLookId === item.id)}
                onApprove={() => void onApprove(messageId, item)}
                onRemix={() => onRemix(item)}
                onShow={() => goTo(itemIndex)}
                disabled={disabled}
                setEl={(el) => {
                  if (el) cardEls.current.set(item.id, el);
                  else cardEls.current.delete(item.id);
                }}
              />
            );
          })}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Look {safeIndex + 1} of {slice.length}: {look.title}
      </p>
    </div>
  );
}

function LookStackCard({
  look,
  itemIndex,
  order,
  isFront,
  isDeparting,
  skipTransition,
  transform,
  garmentById,
  approvedLookId,
  controlsDisabled,
  lookBusy,
  onApprove,
  onRemix,
  onShow,
  disabled,
  setEl,
}: {
  look: OutfitLook;
  itemIndex: number;
  order: number;
  isFront: boolean;
  isDeparting: boolean;
  skipTransition: boolean;
  transform: string;
  garmentById: Map<string, ClothingCardData>;
  approvedLookId: string | null;
  controlsDisabled: boolean;
  lookBusy: boolean;
  onApprove: () => void;
  onRemix: () => void;
  onShow: () => void;
  disabled?: boolean;
  setEl: (el: HTMLElement | null) => void;
}) {
  const pieces: ClothingCardData[] = [];
  for (const id of look.garmentIds ?? []) {
    const piece = garmentById.get(id);
    if (piece) pieces.push(piece);
  }

  const zIndex = isDeparting ? 40 : 20 - order;

  return (
    <article
      ref={setEl}
      data-look-card={look.id}
      data-skip-transition={skipTransition ? "" : undefined}
      className={cn(
        "look-stack-card relative col-start-1 row-start-1 flex flex-col overflow-hidden rounded-[1.75rem] bg-card text-card-foreground",
        "ring-1 ring-foreground/10",
        isFront || isDeparting
          ? "shadow-[0_16px_44px_rgba(26,28,27,0.12)]"
          : "shadow-[0_8px_24px_rgba(26,28,27,0.06)]",
      )}
      style={{
        transform,
        zIndex,
        opacity: isDeparting ? 0 : 1,
      }}
    >
      <div aria-hidden={!isFront}>
        <LookCardFace
          look={look}
          pieces={pieces}
          showActions={isFront}
          approvedLookId={approvedLookId}
          controlsDisabled={controlsDisabled}
          lookBusy={lookBusy}
          onApprove={onApprove}
          onRemix={onRemix}
        />
      </div>
      {!isFront && !isDeparting ? (
        <button
          type="button"
          className="absolute inset-y-0 right-0 w-5"
          disabled={disabled}
          aria-label={`Show look ${itemIndex + 1}: ${look.title}`}
          onClick={onShow}
        />
      ) : null}
    </article>
  );
}

function LookCardFace({
  look,
  pieces,
  showActions,
  approvedLookId,
  controlsDisabled,
  lookBusy,
  onApprove,
  onRemix,
}: {
  look: OutfitLook;
  pieces: ClothingCardData[];
  showActions: boolean;
  approvedLookId: string | null;
  controlsDisabled: boolean;
  lookBusy: boolean;
  onApprove: () => void;
  onRemix: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-3 pb-4 sm:p-4">
      <div className="relative aspect-[4/5] max-h-[min(20rem,46svh)] w-full overflow-hidden rounded-[1.35rem] bg-muted">
        {look.imageDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={look.imageDataUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 px-4 text-center">
            <p className="text-sm text-muted-foreground">Preview</p>
            <p className="text-[0.65rem] leading-snug text-muted-foreground/80">
              Image unavailable — Approve still saves the pieces
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 px-1">
        <h3 className="font-serif text-lg leading-tight text-foreground underline decoration-foreground/25 underline-offset-[5px]">
          {look.title}
        </h3>

        {pieces.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-sm font-semibold text-foreground">
              Your look includes:
            </p>
            <ul className="flex flex-col gap-2.5">
              {pieces.map((piece) => (
                <li key={piece.id} className="flex items-center gap-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {piece.imageUrl ? (
                      <Image
                        src={piece.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="56px"
                        unoptimized={shouldBypassImageOptimizer(piece.imageUrl)}
                      />
                    ) : (
                      <div
                        className="size-full"
                        style={{
                          backgroundColor: `${piece.colorHex ?? "#e8e8e6"}40`,
                        }}
                      />
                    )}
                  </div>
                  <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">
                    {piece.name}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : look.description ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {look.description}
          </p>
        ) : null}

        {showActions ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={controlsDisabled}
              onClick={onApprove}
              className={cn(
                "rounded-full bg-foreground px-5 text-background hover:bg-foreground/90",
                approvedLookId === look.id &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
            >
              <Check data-icon="inline-start" />
              {approvedLookId === look.id
                ? "Saved"
                : lookBusy
                  ? "Saving…"
                  : "Approve"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={controlsDisabled}
              className="rounded-full"
              onClick={onRemix}
            >
              <ArrowLeftRight data-icon="inline-start" />
              Remix
            </Button>
          </div>
        ) : (
          <div className="h-7" aria-hidden />
        )}
      </div>
    </div>
  );
}
