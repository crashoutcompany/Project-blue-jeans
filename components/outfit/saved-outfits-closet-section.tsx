import Link from "next/link";
import { CalendarDays } from "lucide-react";

import type { ClosetSavedOutfit } from "@/lib/outfits/closet-saved-outfits";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatWornOn(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SavedOutfitsClosetSection({
  outfits,
}: {
  outfits: ClosetSavedOutfit[];
}) {
  if (outfits.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
        <p className="font-serif text-lg text-foreground">Saved outfits</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Looks you approve from the generator or calendar appear here. Nothing
          saved yet.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/generator"
            className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
          >
            Open generator
          </Link>
          <Link
            href="/calendar"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "rounded-full gap-1.5",
            )}
          >
            <CalendarDays className="size-3.5" />
            Calendar
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">
            Saved outfits
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            From your archive — newest worn date first.
          </p>
        </div>
        <Link
          href="/calendar"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "gap-1.5 text-muted-foreground",
          )}
        >
          <CalendarDays className="size-3.5" />
          View on calendar
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {outfits.map((o) => {
          const src = o.imageUrl ?? o.fallbackGarmentImageUrl;
          const title = o.name?.trim() || "Outfit";
          return (
            <li
              key={o.id}
              className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
            >
              <div className="relative aspect-[4/5] bg-muted">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URLs + arbitrary CDN hosts
                  <img
                    src={src}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                    No preview
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent pt-12 pb-3 px-3">
                  <p className="font-serif text-base leading-snug text-foreground line-clamp-2">
                    {title}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    {formatWornOn(o.wornOn)} · {o.occasion}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
