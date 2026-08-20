/**
 * Static shell for Settings — page data stays behind Suspense in page.tsx.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="page-canvas mx-auto flex max-w-lg flex-col gap-8 px-4 pb-16 pt-4 sm:px-6"
      data-testid="settings-shell-marker"
    >
      {children}
    </div>
  );
}
