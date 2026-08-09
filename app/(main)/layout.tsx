import { AuthenticatedShellSuspense } from "@/components/shell/authenticated-shell";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedShellSuspense>{children}</AuthenticatedShellSuspense>
  );
}
