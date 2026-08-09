"use client";

import Link from "next/link";

import { NavUserMenu } from "@/components/shell/nav-user-menu";

export function LandingNavBar() {
  return (
    <nav className="fixed top-0 z-50 w-full bg-[#1a1814]/50 backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-6 py-5 sm:px-8">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-[#f4f0e8] sm:text-2xl"
        >
          Project Blue Jeans
        </Link>
        <NavUserMenu variant="landing" />
      </div>
    </nav>
  );
}
