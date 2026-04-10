"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Sparkles } from "lucide-react";

import { MAIN_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

type TopHeaderProps = {
  title?: string;
  titleItalic?: boolean;
};

export function TopHeader({
  title = "Curated",
  titleItalic = true,
}: TopHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-xl">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate font-serif text-xl text-foreground sm:text-2xl",
                titleItalic && "italic"
              )}
            >
              {title}
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ModeToggle />
            <Button variant="ghost" size="icon-sm" aria-label="AI assistant">
              <Sparkles className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>
            <Avatar className="size-9 border border-border">
              <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                JD
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>

      <nav className="hidden border-t border-border/60 px-4 py-2 sm:px-6 lg:flex lg:px-8">
        <div className="flex gap-6 text-sm text-muted-foreground">
          {MAIN_NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground",
                  active && "font-medium text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
