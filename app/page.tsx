import type { Metadata } from "next";
import { connection } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { AuthenticatedShellSuspense } from "@/components/shell/authenticated-shell";
import { TodayView } from "@/components/outfit/today-view";
import { LandingPage } from "@/components/landing/landing-page";
import { auth } from "@/lib/auth/server";
import { isAdminUser } from "@/lib/auth/admin";
import { loadTodayPageData } from "@/lib/outfits/today-data";

export const metadata: Metadata = {
  title: "Project Blue Jeans",
  description:
    "Decide what to wear today — from clothes you already own.",
};

export default async function HomePage() {
  await connection();
  noStore();
  const { data } = await auth.getSession();

  if (data?.user && !isAdminUser(data.user)) {
    redirect("/auth/not-admin");
  }

  if (data?.user && isAdminUser(data.user)) {
    const todayData = await loadTodayPageData();
    return (
      <AuthenticatedShellSuspense>
        <TodayView data={todayData} />
      </AuthenticatedShellSuspense>
    );
  }

  return <LandingPage />;
}
