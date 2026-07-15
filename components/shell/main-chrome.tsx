import { TopHeader } from "@/components/shell/top-header";

export function MainChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh min-w-0 flex-1 flex-col bg-background">
      <TopHeader />
      <main className="min-w-0 flex-1 px-3 pb-5 pt-4 sm:px-5 sm:pb-8 lg:px-8 lg:pt-6">
        {children}
      </main>
    </div>
  );
}
