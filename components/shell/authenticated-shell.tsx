import { Suspense } from "react";

import { AppSidebar } from "@/components/shell/sidebar";
import { MainChrome } from "@/components/shell/main-chrome";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireAdminAccess } from "@/lib/auth/admin";

/** Request-time admin gate; suspends during prerender so the shell can build. */
async function AdminAccessGate() {
  await requireAdminAccess();
  return null;
}

/**
 * Authenticated app chrome (sidebar + header). Used by `(main)` layout and
 * signed-in `/` (Today).
 */
export function AuthenticatedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset
        className="min-h-svh overflow-x-hidden"
        data-testid="main-shell-marker"
      >
        <Suspense fallback={null}>
          <AdminAccessGate />
        </Suspense>
        <MainChrome>{children}</MainChrome>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function AuthenticatedShellSuspense({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
