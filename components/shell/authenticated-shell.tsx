import { Suspense } from "react";

import { AppSidebar } from "@/components/shell/sidebar";
import { MainChrome } from "@/components/shell/main-chrome";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireAdmittedAccess } from "@/lib/auth/admitted";

/**
 * Request-time admission gate. Children (Closet / Calendar / Settings loaders)
 * must not start until this resolves, or unadmitted sessions would still query
 * protected data. Sidebar chrome stays outside so the static/PPR shell can
 * prerender.
 */
async function AdmittedMain({ children }: { children: React.ReactNode }) {
  await requireAdmittedAccess();
  return children;
}

/**
 * Authenticated app chrome (sidebar + header). Used by `(main)` layout and
 * signed-in `/` (Today). Sidebar open state is restored client-side from the
 * `sidebar_state` cookie inside SidebarProvider (avoid next/headers cookies()
 * here — it races with auth session cookie writes on `/`).
 */
export function AuthenticatedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset
        className="min-h-svh overflow-x-hidden"
        data-testid="main-shell-marker"
      >
        <MainChrome>
          <Suspense fallback={null}>
            <AdmittedMain>{children}</AdmittedMain>
          </Suspense>
        </MainChrome>
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
