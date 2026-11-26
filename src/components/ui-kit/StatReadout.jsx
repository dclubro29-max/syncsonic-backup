import React from "react";
import { cn } from "@/lib/utils";

/** Valoare numerică de studio: etichetă mică sus, cifre tabulare mari jos. */
export default function StatReadout({ label, value, unit, hint, tone = "default", className }) {
  const tones = {
    default: "text-foreground",
    primary: "text-primary",
    muted: "text-muted-foreground",
  };
  return (
    <div className={cn("min-w-0", className)}>
      <p className="font-heading text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("num mt-0.5 text-sm font-medium leading-none", tones[tone])}>
        {value}
        {unit ? <span className="ml-1 text-[10px] font-normal text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 truncate text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}