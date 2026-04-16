"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { NavUserMenu } from "@/components/shell/nav-user-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function TopHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <SidebarTrigger className="shrink-0" />
        <Link
          href="/dashboard"
          className={cn(
            "font-serif text-xl tracking-tight text-foreground sm:text-2xl",
            "italic",
          )}
        >
          Curated
        </Link>
        <div className="min-w-0 flex-1" />
        <NavUserMenu />
      </div>
    </header>
  );
}
