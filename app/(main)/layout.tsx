import { MainChrome } from "@/components/shell/main-chrome";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainChrome>{children}</MainChrome>;
}
