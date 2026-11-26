import React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  default: "panel",
  quiet: "panel-quiet",
  inset: "inset",
  flush: "rounded-2xl border border-border/60 bg-card/50",
};

/** Suprafața standard a aplicației: un singur limbaj pentru toate panourile. */
export function Surface({ tone = "default", className, as: Tag = "section", ...props }) {
  return <Tag className={cn(TONES[tone] || TONES.default, className)} {...props} />;
}

/** Antetul unui panou: iconiță, titlu, explicație scurtă și o acțiune opțională. */
export function SurfaceHead({ icon: Icon, title, hint, action, className }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-raised text-primary">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold tracking-tight">{title}</h2>
          {hint ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}