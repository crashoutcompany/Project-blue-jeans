import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { ClosetView } from "@/components/outfit/closet-view";
import { getWearerUserId } from "@/lib/auth/wearer";
import { getClosetGarmentsCached } from "@/lib/garments/get-closet-garments-cached";
import { loadSavedOutfitsForCloset } from "@/lib/outfits/closet-saved-outfits";

async function ClosetContent() {
  await connection();
  const userId = await getWearerUserId();
  if (!userId) {
    redirect("/auth/sign-in");
  }

  const [garments, savedOutfits] = await Promise.all([
    getClosetGarmentsCached(userId),
    loadSavedOutfitsForCloset(userId),
  ]);

  return (
    <div data-testid="closet-content">
      <ClosetView initialGarments={garments} savedOutfits={savedOutfits} />
    </div>
  );
}

export default function ClosetPage() {
  return (
    <Suspense fallback={<ClosetView initialGarments={[]} savedOutfits={[]} />}>
      <ClosetContent />
    </Suspense>
  );
}
