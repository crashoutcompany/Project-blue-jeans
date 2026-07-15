"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus } from "lucide-react";

import { MAIN_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/mode-toggle";

export function TopHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-foreground/8 bg-background/92 backdrop-blur-xl">
      <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 sm:px-5 lg:h-16 lg:px-8">
        <Link
          href="/"
          className="w-fit font-serif text-lg font-medium tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:text-xl"
        >
          Curated
        </Link>

        <nav
          className="hidden items-center rounded-full bg-foreground/[0.045] p-1 md:flex"
          aria-label="Primary navigation"
        >
          {MAIN_NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/50",
                  active
                    ? "bg-background text-foreground shadow-[0_1px_4px_rgba(26,28,27,0.08)]"
                    : "hover:text-foreground",
                )}
              >
                {item.label.replace("Digital ", "").replace("Outfit ", "")}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-0.5">
          <ModeToggle />
          <Button
            nativeButton={false}
            render={<Link href="/closet" />}
            variant="ghost"
            size="icon-sm"
            aria-label="Add a garment"
            className="hidden sm:inline-flex"
          >
            <Plus className="size-4" />
          </Button>
          <Avatar className="ml-1 size-7 bg-foreground text-background lg:size-8">
            <AvatarFallback className="bg-foreground text-[0.6rem] font-semibold text-background">
              JD
            </AvatarFallback>
          </Avatar>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-0.5 md:hidden"
                  aria-label="Open navigation"
                />
              }
            >
              <Menu className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="min-w-48 rounded-xl"
            >
              <DropdownMenuLabel>Navigate</DropdownMenuLabel>
              {MAIN_NAV.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <DropdownMenuItem
                    key={item.href}
                    render={<Link href={item.href} />}
                    className={cn(
                      "px-2.5 py-2",
                      active && "bg-accent font-medium",
                    )}
                  >
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
