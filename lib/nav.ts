export const MAIN_NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/closet", label: "Digital Closet" },
  { href: "/generator", label: "Outfit Generator" },
  { href: "/style-profile", label: "Style Profile" },
] as const;

export type MainNavHref = (typeof MAIN_NAV)[number]["href"];
