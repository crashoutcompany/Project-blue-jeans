"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Shirt, Sun } from "lucide-react";

import { MAIN_NAV } from "@/lib/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

function navIcon(label: string) {
  switch (label) {
    case "Today":
      return <Sun className="size-4 shrink-0 opacity-80" />;
    case "Closet":
      return <Shirt className="size-4 shrink-0 opacity-80" />;
    case "Calendar":
      return <CalendarDays className="size-4 shrink-0 opacity-80" />;
    default:
      return null;
  }
}

function isNavActive(href: string, pathname: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      className="border-0 bg-transparent"
    >
      <SidebarRail />
      <SidebarHeader className="gap-3 px-3 pt-4 pb-2 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:pb-2 group-data-[collapsible=icon]:pt-3">
        <div className="flex flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
          <p className="font-serif text-lg text-sidebar-foreground">Blue Jeans</p>
        </div>
        <div className="hidden justify-center group-data-[collapsible=icon]:flex">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent font-serif text-sm font-semibold leading-none text-sidebar-accent-foreground"
            aria-hidden
          >
            BJ
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator className="bg-sidebar-border/60" />
      <SidebarContent className="gap-2 px-2 group-data-[collapsible=icon]:px-0">
        <SidebarGroup className="group-data-[collapsible=icon]:p-1">
          <SidebarGroupLabel className="text-[0.65rem] uppercase tracking-[0.18em]">
            Navigate
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {MAIN_NAV.map((item) => {
                const active = isNavActive(item.href, pathname);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                    >
                      {navIcon(item.label)}
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
