"use client";

import { usePathname } from "next/navigation";

import { TopHeader } from "@/components/shell/top-header";

export function MainChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideFooter =
    pathname === "/" ||
    pathname === "/closet" ||
    pathname.startsWith("/closet/");

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TopHeader />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-10">
          {children}
        </div>
        {hideFooter ? null : (
          <footer className="border-t border-border/50 px-4 py-8 text-center sm:px-6 lg:px-10">
            <p className="font-serif text-sm text-foreground">Blue Jeans</p>
            <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              What to wear today
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}
