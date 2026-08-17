import { productTodayIso } from "@/lib/time/product-timezone";

/** Past calendar days are immutable for Wear / Unwear / Change look. */
export function assertMutableWornOn(
  wornOn: string,
  now = new Date(),
): { ok: true } | { ok: false; message: string } {
  if (wornOn < productTodayIso(now)) {
    return { ok: false, message: "Past looks can’t be changed." };
  }
  return { ok: true };
}
