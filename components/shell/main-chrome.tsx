"use client";

import { TopHeader } from "@/components/shell/top-header";

export function MainChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TopHeader />
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
