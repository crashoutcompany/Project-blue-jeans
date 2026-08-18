import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { AuthenticatedShellSuspense } from "@/components/shell/authenticated-shell";
import { DayLookView } from "@/components/outfit/day-look-view";
import { LandingPage } from "@/components/landing/landing-page";
import { auth } from "@/lib/auth/server";
import { getMembershipPolicyForUser } from "@/lib/auth/admitted";
import { getClosetGarmentsCached } from "@/lib/garments/get-closet-garments-cached";
import { loadTodayPageData } from "@/lib/outfits/today-data";

export const metadata: Metadata = {
  title: "Project Blue Jeans",
  description: "Decide what to wear today — from clothes you already own.",
};

function LandingShell() {
  return (
    <div data-testid="landing-shell-marker">
      <LandingPage />
    </div>
  );
}

async function HomeContent() {
  await connection();
  noStore();
  const { data } = await auth.getSession();

  if (data?.user) {
    const membership = await getMembershipPolicyForUser(data.user);
    if (!membership || membership.status !== "active") {
      redirect("/auth/accept-invite");
    }
    const userId = membership.userId;
    const [todayData, closetGarments] = await Promise.all([
      loadTodayPageData(userId),
      getClosetGarmentsCached(userId),
    ]);
    return (
      <AuthenticatedShellSuspense>
        <div data-testid="today-shell-marker">
          <Suspense fallback={<div className="min-h-[70svh] bg-background" />}>
            <DayLookView data={todayData} closetGarments={closetGarments} />
          </Suspense>
        </div>
      </AuthenticatedShellSuspense>
    );
  }

  return <LandingShell />;
}

/**
 * No `searchParams` on this page — that would dynamize the whole segment and
 * drop the landing shell from the initial-load instant() guard. `change-look`
 * is read in DayLookView via useSearchParams.
 */
export default function HomePage() {
  return (
    <Suspense fallback={<LandingShell />}>
      <HomeContent />
    </Suspense>
  );
}
