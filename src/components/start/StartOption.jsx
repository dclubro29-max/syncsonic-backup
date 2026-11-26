import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * O opțiune aleasă dintr-un grup: pictogramă, titlu scurt și o singură linie
 * de explicație. Textul se rupe normal pe rânduri, ca să nu se suprapună.
 */
export default function StartOption({ selected, icon: Icon, title, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        selected
          ? "border-primary/60 bg-primary/10"
          : "border-border bg-background/40 hover:bg-accent/40"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium leading-snug">
          {title}
          {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}