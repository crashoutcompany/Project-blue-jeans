import { revalidatePath, revalidateTag } from "next/cache";

import { closetGarmentsTag } from "@/lib/garments/closet-garments-cache-tag";
import { calendarMonthTag } from "@/lib/outfits/calendar-month-cache-tag";
import { closetSavedOutfitsTag } from "@/lib/outfits/closet-saved-outfits-cache-tag";

/** After Outfit commit / Unwear / Fit promote — Today, Closet Outfits, Calendar. */
export function revalidateOutfitSurfaces(userId: string): void {
  revalidateTag(closetSavedOutfitsTag(userId), "max");
  revalidateTag(calendarMonthTag(userId), "max");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/closet");
}

/** After Garment create/update — Closet pieces + Today empty-state count. */
export function revalidateClosetGarmentSurfaces(userId: string): void {
  revalidateTag(closetGarmentsTag(userId), "max");
  revalidatePath("/closet", "page");
  revalidatePath("/", "page");
}

/** After Garment delete — also refresh Outfits/Calendar (sets may change). */
export function revalidateAfterGarmentDelete(userId: string): void {
  revalidateTag(closetSavedOutfitsTag(userId), "max");
  revalidateTag(calendarMonthTag(userId), "max");
  revalidatePath("/calendar", "page");
  revalidateClosetGarmentSurfaces(userId);
}
