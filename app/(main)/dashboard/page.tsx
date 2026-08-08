import { ClosetView } from "@/components/outfit/closet-view";
import { getClosetGarmentsCached } from "@/lib/garments/get-closet-garments-cached";
import { loadSavedOutfitsForCloset } from "@/lib/outfits/closet-saved-outfits";

export default async function DashboardPage() {
  const [garments, savedOutfits] = await Promise.all([
    getClosetGarmentsCached(),
    loadSavedOutfitsForCloset(),
  ]);

  return (
    <div className="-mx-4 -my-8 min-h-[calc(100svh-5rem)] bg-background px-3 pb-28 pt-2 sm:-mx-6 sm:px-5 sm:pt-4 lg:-mx-10 lg:px-8 lg:pt-6">
      <ClosetView initialGarments={garments} savedOutfits={savedOutfits} />
    </div>
  );
}
