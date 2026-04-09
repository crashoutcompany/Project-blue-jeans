"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <Button
              key={opt.id}
              type="button"
              size="sm"
              variant={active ? "default" : "secondary"}
              onClick={() => onChange(opt.id)}
              className={cn(
                "rounded-full px-4 text-[0.65rem] font-semibold uppercase tracking-[0.12em]",
                active &&
                  "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {opt.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
