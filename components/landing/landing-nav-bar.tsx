"use client";

import Link from "next/link";

import { NavUserMenu } from "@/components/shell/nav-user-menu";

export function LandingNavBar() {
  return (
    <nav className="fixed top-0 z-50 w-full bg-[#f9f9f6]/70 backdrop-blur-xl dark:bg-[#1a1c1b]/70">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-6 py-6 sm:px-8">
        <Link
          href="/"
          className="font-serif text-xl italic tracking-tight text-[#003527] sm:text-2xl dark:text-[#f9f9f6]"
        >
          The Digital Atelier
        </Link>
        <NavUserMenu variant="landing" />
      </div>
    </nav>
  );
}
