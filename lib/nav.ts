export const MAIN_NAV = [
  { href: "/dashboard", label: "Digital Closet" },
  { href: "/calendar", label: "Calendar" },
  { href: "/generator", label: "Outfit Generator" },
] as const;

export type MainNavHref = (typeof MAIN_NAV)[number]["href"];
