"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { TopHeader } from "@/components/shell/top-header";

export function MainChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const header = useMemo(() => {
    if (pathname.startsWith("/closet")) {
      return {
        title: "Your closet",
        titleItalic: true,
      };
    }
    if (pathname.startsWith("/generator")) {
      return {
        title: "Curate your aesthetic",
        titleItalic: true,
      };
    }
    if (pathname.startsWith("/style-profile")) {
      return {
        title: "Style identity",
        titleItalic: false,
      };
    }
    return {
      title: "Curated",
      titleItalic: true,
    };
  }, [pathname]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TopHeader title={header.title} titleItalic={header.titleItalic} />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-10">
          {children}
        </div>
        <footer className="border-t border-border/50 px-4 py-8 text-center sm:px-6 lg:px-10">
          <p className="font-serif text-sm text-foreground">Curated</p>
          <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Crafting digital elegance since 2024
          </p>
        </footer>
      </div>
    </div>
  );
}
