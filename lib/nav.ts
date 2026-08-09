export const MAIN_NAV = [
  { href: "/", label: "Today" },
  { href: "/closet", label: "Closet" },
  { href: "/calendar", label: "Calendar" },
] as const;

export type MainNavHref = (typeof MAIN_NAV)[number]["href"];
