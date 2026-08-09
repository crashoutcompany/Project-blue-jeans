/**
 * Static shell for Calendar — kept outside the page's searchParams boundary so
 * initial-load + soft-nav instant() guards can see the marker.
 */
export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="mx-auto w-full max-w-[min(100%,88rem)] px-1 pb-10 sm:px-2"
      data-testid="calendar-shell-marker"
    >
      {children}
    </div>
  );
}
