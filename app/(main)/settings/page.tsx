import { redirect } from "next/navigation";

import { GoogleAiStudioCard } from "@/components/settings/google-ai-studio-card";
import { WearerPhotoCard } from "@/components/settings/wearer-photo-card";
import { auth } from "@/lib/auth/server";
import { getWearerUserId } from "@/lib/auth/wearer";
import { getMembershipPolicyForUser } from "@/lib/auth/admitted";
import { getGoogleAiStudioSettings } from "@/lib/credentials/google-ai-studio";
import { getWearerPhoto } from "@/lib/wearer/profile";

export default async function SettingsPage() {
  const userId = await getWearerUserId();
  if (!userId) {
    redirect("/auth/sign-in");
  }

  const sessionPromise = auth.getSession();
  const photoPromise = getWearerPhoto(userId);
  const { data } = await sessionPromise;
  const membership = data?.user
    ? await getMembershipPolicyForUser(data.user)
    : null;
  const [photo, googleAiStudio] = await Promise.all([
    photoPromise,
    membership
      ? getGoogleAiStudioSettings(userId, membership)
      : Promise.resolve(null),
  ]);

  return (
    <div className="page-canvas mx-auto flex max-w-lg flex-col gap-8 px-4 pb-16 pt-4 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl tracking-tight text-foreground sm:text-3xl">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Account preferences for how looks are shown on Today, and the keys
          used to generate them.
        </p>
      </header>

      {googleAiStudio ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Google AI Studio
          </h2>
          <GoogleAiStudioCard initial={googleAiStudio} />
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Wearer photo
        </h2>
        <WearerPhotoCard initialImageUrl={photo?.imageUrl ?? null} />
      </div>
    </div>
  );
}
