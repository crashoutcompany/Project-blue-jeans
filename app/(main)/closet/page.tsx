import { connection } from "next/server";

import { SavedOutfitsClosetSection } from "@/components/outfit/saved-outfits-closet-section";
import { ClosetView } from "@/components/outfit/closet-view";
import { getClosetGarmentsCached } from "@/lib/garments/get-closet-garments-cached";
import { loadSavedOutfitsForCloset } from "@/lib/outfits/closet-saved-outfits";

export default async function ClosetPage() {
  await connection();
  const [garments, savedOutfits] = await Promise.all([
    getClosetGarmentsCached(),
    loadSavedOutfitsForCloset(),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:max-w-none">
      <SavedOutfitsClosetSection outfits={savedOutfits} />
      <ClosetView initialGarments={garments} />
    </div>
  );
}
