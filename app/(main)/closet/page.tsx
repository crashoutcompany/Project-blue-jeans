import { redirect } from "next/navigation";

import { ClosetView } from "@/components/outfit/closet-view";
import { getWearerUserId } from "@/lib/auth/wearer";
import { getClosetGarmentsCached } from "@/lib/garments/get-closet-garments-cached";
import { loadSavedOutfitsForCloset } from "@/lib/outfits/closet-saved-outfits";

export default async function ClosetPage() {
  const userId = await getWearerUserId();
  if (!userId) {
    redirect("/auth/sign-in");
  }

  const [garments, savedOutfits] = await Promise.all([
    getClosetGarmentsCached(userId),
    loadSavedOutfitsForCloset(userId),
  ]);

  return (
    <div className="-mx-4 -my-8 min-h-[calc(100svh-5rem)] bg-background px-3 pb-28 pt-2 sm:-mx-6 sm:px-5 sm:pt-4 lg:-mx-10 lg:px-8 lg:pt-6">
      <ClosetView initialGarments={garments} savedOutfits={savedOutfits} />
    </div>
  );
}
