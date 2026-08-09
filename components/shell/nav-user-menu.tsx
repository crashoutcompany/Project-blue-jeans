"use client";

import Link from "next/link";

import { LogOut } from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavUserMenuProps = {
  signInClassName?: string;
  variant?: "app" | "landing";
};

export function NavUserMenu({
  signInClassName,
  variant = "app",
}: NavUserMenuProps) {
  const { data, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div
        className="h-9 w-24 animate-pulse rounded-full bg-muted"
        aria-hidden
      />
    );
  }

  if (!data?.user) {
    return (
      <Link
        href="/auth/sign-in"
        className={cn(
          buttonVariants({ size: "sm" }),
          variant === "landing" &&
            "rounded-none border border-[#f4f0e8]/30 bg-transparent px-5 text-[#f4f0e8] hover:bg-[#f4f0e8]/10",
          signInClassName,
        )}
      >
        Sign in
      </Link>
    );
  }

  const user = data.user;
  const initial =
    user.name?.trim()?.charAt(0)?.toUpperCase() ??
    user.email?.charAt(0)?.toUpperCase() ??
    "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex max-w-[min(100%,280px)] items-center gap-2 rounded-full border border-transparent py-1 pr-2 pl-1 outline-none transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring",
          variant === "landing" && "hover:bg-black/5 dark:hover:bg-white/10",
        )}
      >
        <Avatar className="size-8" size="sm">
          {user.image ? (
            <AvatarImage src={user.image} alt="" />
          ) : (
            <AvatarFallback className="text-xs font-medium">
              {initial}
            </AvatarFallback>
          )}
        </Avatar>
        <span
          className={cn(
            "hidden min-w-0 truncate text-sm font-medium sm:inline",
            variant === "landing" && "text-[#f4f0e8]",
          )}
        >
          {user.name || user.email}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem render={<Link href="/closet" />}>
          Closet
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" />}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/auth/sign-out" />}>
          <LogOut className="mr-2 size-4 opacity-70" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
