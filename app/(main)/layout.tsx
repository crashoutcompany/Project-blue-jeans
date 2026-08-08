import { Suspense } from "react";

import { AppSidebar } from "@/components/shell/sidebar";
import { MainChrome } from "@/components/shell/main-chrome";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireAdminAccess } from "@/lib/auth/admin";

async function MainShell({ children }: { children: React.ReactNode }) {
  await requireAdminAccess();

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="min-h-svh overflow-x-hidden">
        <MainChrome>{children}</MainChrome>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <MainShell>{children}</MainShell>
    </Suspense>
  );
}
