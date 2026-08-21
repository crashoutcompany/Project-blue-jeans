const STACK_PEEK_PX = 12;
const STACK_LIFT_PX = 2;
const STACK_SCALE_STEP = 0.03;
const STACK_MAX_DEPTH = 4;

export const LOOK_STACK_MS = 280;
export const LOOK_STACK_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
export const LOOK_STACK_SWIPE_PX = 56;
export const LOOK_STACK_SWIPE_VX = 0.45;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function wrapLookIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function lookStackOrder(
  itemIndex: number,
  activeIndex: number,
  length: number,
): number {
  return wrapLookIndex(itemIndex - activeIndex, length);
}

export function lookStackDirection(
  from: number,
  to: number,
  length: number,
): "next" | "prev" {
  const forward = wrapLookIndex(to - from, length);
  const backward = wrapLookIndex(from - to, length);
  return forward <= backward ? "next" : "prev";
}

/** Resting transform for a card `order` steps behind the front of the deck. */
export function lookStackRestTransform(order: number): string {
  const depth = clamp(order, 0, STACK_MAX_DEPTH);
  const x = depth * STACK_PEEK_PX;
  const y = depth * STACK_LIFT_PX;
  const scale = 1 - depth * STACK_SCALE_STEP;
  return `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
}

export function lookStackDepartTransform(direction: "next" | "prev"): string {
  const sign = direction === "next" ? -1 : 1;
  return `translate3d(${sign * 112}%, ${sign * 8}%, 0) rotate(${sign * -9}deg) scale(0.96)`;
}

/**
 * Live transform while the front card is dragged.
 * `dx` is pointer delta in px (negative = swipe toward next).
 */
export function lookStackDragTransform(
  order: number,
  dx: number,
  width: number,
  count: number,
): string {
  const progress = width > 0 ? dx / width : 0;
  if (order === 0) {
    const rot = clamp(progress * 12, -12, 12);
    return `translate3d(${dx}px, 0, 0) rotate(${rot}deg) scale(1.02)`;
  }

  const nextT = clamp(-progress / 0.5, 0, 1);
  const prevT = clamp(progress / 0.5, 0, 1);

  if (count > 1 && order === count - 1 && prevT > 0) {
    const x = -width * (1 - prevT);
    const rot = (1 - prevT) * 10;
    return `translate3d(${x}px, 0, 0) rotate(${rot}deg)`;
  }

  return lookStackRestTransform(order - nextT + prevT * 0.2);
}

export function shouldAdvanceLook(dx: number, vx: number): "next" | "prev" | null {
  if (dx <= -LOOK_STACK_SWIPE_PX || vx <= -LOOK_STACK_SWIPE_VX) return "next";
  if (dx >= LOOK_STACK_SWIPE_PX || vx >= LOOK_STACK_SWIPE_VX) return "prev";
  return null;
}

export function lookStackPeekReservePx(count: number): number {
  if (count <= 1) return 0;
  return Math.min(count - 1, STACK_MAX_DEPTH) * STACK_PEEK_PX;
}
