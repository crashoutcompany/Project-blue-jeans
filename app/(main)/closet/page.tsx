import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { ClosetView } from "@/components/outfit/closet-view";
import { auth } from "@/lib/auth/server";
import {
  getMembershipPolicyForUser,
  requireAdmittedAccess,
} from "@/lib/auth/admitted";
import { AUTH_SIGN_IN_PATH } from "@/lib/auth/config";
import { getWearerUserId } from "@/lib/auth/wearer";
import { getGoogleAiStudioSettings } from "@/lib/credentials/google-ai-studio";
import { getUploadThingSettings } from "@/lib/credentials/uploadthing";
import { getClosetGarmentsCached } from "@/lib/garments/get-closet-garments-cached";
import { loadSavedOutfitsForCloset } from "@/lib/outfits/closet-saved-outfits";

async function ClosetContent() {
  await connection();
  await requireAdmittedAccess();
  const userId = await getWearerUserId();
  if (!userId) {
    redirect(AUTH_SIGN_IN_PATH);
  }

  const { data } = await auth.getSession();
  const membership = data?.user
    ? await getMembershipPolicyForUser(data.user)
    : null;

  const [garments, savedOutfits, googleAiStudio, uploadthing] = await Promise.all(
    [
      getClosetGarmentsCached(userId),
      loadSavedOutfitsForCloset(userId),
      membership
        ? getGoogleAiStudioSettings(userId, membership)
        : Promise.resolve(null),
      membership
        ? getUploadThingSettings(userId, membership)
        : Promise.resolve(null),
    ],
  );

  return (
    <div data-testid="closet-content">
      <ClosetView
        initialGarments={garments}
        savedOutfits={savedOutfits}
        missingGemini={googleAiStudio ? !googleAiStudio.connected : false}
        missingUploadThing={uploadthing ? !uploadthing.connected : false}
      />
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
