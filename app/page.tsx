import type { Metadata } from "next";

import { redirectSignedInNonAdminFromPublicPage } from "@/lib/auth/admin";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "The Digital Atelier | Your Wardrobe Reimagined",
  description:
    "A personal fashion curator: digital closet, intelligent styling, and a living style profile powered by AI.",
};

export default async function HomePage() {
  await redirectSignedInNonAdminFromPublicPage();
  return <LandingPage />;
}
