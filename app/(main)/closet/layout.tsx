/**
 * Static shell for Closet — page data stays behind Suspense in page.tsx.
 */
export default function ClosetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="-mx-4 -my-8 min-h-[calc(100svh-5rem)] bg-background px-3 pb-28 pt-2 sm:-mx-6 sm:px-5 sm:pt-4 lg:-mx-10 lg:px-8 lg:pt-6"
      data-testid="closet-shell-marker"
    >
      {children}
    </div>
  );
}
