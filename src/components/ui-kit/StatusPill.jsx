import React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "border-border/70 bg-surface-raised text-muted-foreground",
  live: "border-success/35 bg-success/10 text-success",
  ready: "border-primary/35 bg-primary/10 text-primary",
  warn: "border-warning/35 bg-warning/10 text-warning",
  danger: "border-destructive/35 bg-destructive/10 text-destructive",
  deckA: "border-deck-a/35 bg-deck-a/10 text-deck-a",
  deckB: "border-deck-b/35 bg-deck-b/10 text-deck-b",
  deckC: "border-deck-c/35 bg-deck-c/10 text-deck-c",
  deckD: "border-deck-d/35 bg-deck-d/10 text-deck-d",
};

/** Pastilă de stare, folosită identic în tot studio-ul. */
export default function StatusPill({ tone = "neutral", dot = false, pulse = false, icon: Icon, className, children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      {dot ? (
        <span
          className={cn("h-1.5 w-1.5 rounded-full bg-current", pulse && "live-dot")}
          aria-hidden="true"
        />
      ) : null}
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}