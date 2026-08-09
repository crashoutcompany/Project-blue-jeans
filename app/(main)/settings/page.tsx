import { redirect } from "next/navigation";

import { WearerPhotoCard } from "@/components/settings/wearer-photo-card";
import { getWearerUserId } from "@/lib/auth/wearer";
import { getWearerPhoto } from "@/lib/wearer/profile";

export default async function SettingsPage() {
  const userId = await getWearerUserId();
  if (!userId) {
    redirect("/auth/sign-in");
  }

  const photo = await getWearerPhoto(userId);

  return (
    <div className="page-canvas mx-auto flex max-w-lg flex-col gap-8 px-4 pb-16 pt-4 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl tracking-tight text-foreground sm:text-3xl">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Account preferences for how looks are shown on Today.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Wearer photo
        </h2>
        <WearerPhotoCard initialImageUrl={photo?.imageUrl ?? null} />
      </div>
    </div>
  );
}
