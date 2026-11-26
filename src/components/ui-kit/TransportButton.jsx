import React from "react";
import { cn } from "@/lib/utils";

/**
 * Buton de transport: aceeași formă pentru play, CUE, SYNC, căști, key lock.
 * `solid` = acțiunea principală; `active` = funcția e pornită.
 */
export default function TransportButton({
  icon: Icon,
  label,
  hint,
  active = false,
  solid = false,
  round = false,
  className,
  children,
  ...props
}) {
  return (
    <button
      type="button"
      title={hint || label}
      aria-label={hint || label}
      aria-pressed={props["aria-pressed"] ?? (label ? active : undefined)}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 border text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-40",
        round ? "h-11 w-11 rounded-full" : "h-11 rounded-xl px-3",
        solid
          ? "border-primary/50 bg-primary text-primary-foreground shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.9)] hover:bg-primary/90"
          : active
            ? "border-primary/45 bg-primary/15 text-primary hover:bg-primary/20"
            : "border-border/80 bg-surface-raised/60 text-muted-foreground hover:border-foreground/25 hover:text-foreground",
        className
      )}
      {...props}
    >
      {Icon ? <Icon className={cn(round ? "h-4 w-4" : "h-3.5 w-3.5")} aria-hidden="true" /> : null}
      {children || (!round && label ? <span>{label}</span> : null)}
    </button>
  );
}