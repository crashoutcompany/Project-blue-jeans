"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LifeBuoy,
  Palette,
  Settings,
  Shirt,
  Sparkles,
} from "lucide-react";

import { MAIN_NAV } from "@/lib/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
    case "Dashboard":
      return <LayoutDashboard className="size-4 shrink-0 opacity-80" />;
    case "Digital Closet":
      return <Shirt className="size-4 shrink-0 opacity-80" />;
    case "Outfit Generator":
      return <Sparkles className="size-4 shrink-0 opacity-80" />;
    case "Style Profile":
      return <Palette className="size-4 shrink-0 opacity-80" />;
    default:
      return null;
  }
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
          <p className="font-serif text-lg text-sidebar-foreground">Curated</p>
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/60">
            Canvas
          </p>
        </div>
        <div className="hidden justify-center group-data-[collapsible=icon]:flex">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent font-serif text-sm font-semibold leading-none text-sidebar-accent-foreground"
            aria-hidden
          >
            C
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
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
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
      <SidebarFooter className="gap-3 p-2 group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:p-1">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New collection"
              className="bg-gradient-to-br from-primary to-[#064e3b] text-primary-foreground shadow-sm hover:from-[#064e3b] hover:to-primary hover:text-primary-foreground data-active:from-primary data-active:to-[#064e3b] data-active:text-primary-foreground group-data-[collapsible=icon]:shadow-md"
            >
              <Sparkles className="size-4 shrink-0 text-primary-foreground" />
              <span>New collection</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator className="bg-sidebar-border/60" />
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              render={<Link href="#" />}
            >
              <Settings className="size-4 shrink-0" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Support"
              render={<Link href="#" />}
            >
              <LifeBuoy className="size-4 shrink-0" />
              <span>Support</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

