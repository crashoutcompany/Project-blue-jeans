/** Stable prerender/hydration year; updates only across deploys / year boundary rebuilds. */
const FOOTER_YEAR = 2026;

export function LandingFooterYear() {
  return <span suppressHydrationWarning>{FOOTER_YEAR}</span>;
}
