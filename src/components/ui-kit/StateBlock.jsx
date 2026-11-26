import React from "react";
import { Loader2, Inbox, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Stările goale, de încărcare și de eroare, în același limbaj vizual. */
export default function StateBlock({ variant = "empty", title, description, icon, action, className }) {
  const Icon = icon || (variant === "loading" ? Loader2 : variant === "error" ? AlertTriangle : Inbox);
  const tone =
    variant === "error"
      ? "border-destructive/30 bg-destructive/[0.06] text-destructive"
      : "border-border/60 bg-card/40 text-muted-foreground";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center",
        tone,
        className
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-current/20 bg-background/40">
        <Icon className={cn("h-5 w-5", variant === "loading" && "animate-spin")} aria-hidden="true" />
      </span>
      {title ? <p className="font-heading text-sm font-semibold text-foreground">{title}</p> : null}
      {description ? (
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}