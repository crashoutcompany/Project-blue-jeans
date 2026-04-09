"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search, Sparkles } from "lucide-react";

import { MAIN_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

type TopHeaderProps = {
  title?: string;
  titleItalic?: boolean;
  searchPlaceholder?: string;
  showSearch?: boolean;
  secondaryNav?: "closet-generator-lookbook" | "overview-profile-insights" | null;
};

const SECONDARY_CLOSET = [
  { href: "/closet", label: "Closet" },
  { href: "/generator", label: "Generator" },
  { href: "/generator", label: "Lookbook" },
] as const;

const SECONDARY_STYLE = [
  { href: "/", label: "Overview" },
  { href: "/style-profile", label: "Profile" },
  { href: "/style-profile", label: "Insights" },
] as const;

export function TopHeader({
  title = "Curated",
  titleItalic = true,
  searchPlaceholder = "Search your archive…",
  showSearch = true,
  secondaryNav = null,
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
          {showSearch && (
            <div className="hidden max-w-md flex-1 md:block">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 rounded-full border border-border bg-card pl-9 shadow-none"
                  placeholder={searchPlaceholder}
                  aria-label="Search"
                />
              </div>
            </div>
          )}
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

        {secondaryNav === "closet-generator-lookbook" && (
          <nav className="hidden gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:flex">
            {SECONDARY_CLOSET.map((item) => {
              const active =
                item.label === "Generator"
                  ? pathname.startsWith("/generator")
                  : item.label === "Closet"
                    ? pathname.startsWith("/closet")
                    : pathname.startsWith("/generator");
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "pb-1 transition-colors",
                    active
                      ? "border-b-2 border-primary text-foreground"
                      : "hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {secondaryNav === "overview-profile-insights" && (
          <nav className="hidden gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:flex">
            {SECONDARY_STYLE.map((item) => {
              const active =
                item.label === "Profile"
                  ? pathname.startsWith("/style-profile")
                  : item.label === "Overview"
                    ? pathname === "/"
                    : pathname.startsWith("/style-profile");
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "pb-1 transition-colors",
                    active
                      ? "border-b-2 border-primary text-foreground"
                      : "hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {showSearch && (
          <div className="md:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 rounded-full border border-border bg-card pl-9 shadow-none"
                placeholder={searchPlaceholder}
                aria-label="Search"
              />
            </div>
          </div>
        )}
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
