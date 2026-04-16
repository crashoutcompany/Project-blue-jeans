export const MAIN_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/closet", label: "Digital Closet" },
  { href: "/generator", label: "Outfit Generator" },
  { href: "/style-profile", label: "Style Profile" },
] as const;

export type MainNavHref = (typeof MAIN_NAV)[number]["href"];
