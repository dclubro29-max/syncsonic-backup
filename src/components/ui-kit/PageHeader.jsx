import React from "react";
import { cn } from "@/lib/utils";

/** Titlul paginii: etichetă mică, titlu, descriere și acțiuni. */
export default function PageHeader({ eyebrow, title, icon: Icon, description, actions, className }) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="caps mb-2">{eyebrow}</p> : null}
        <h1 className="screen-title flex items-center gap-2.5">
          {Icon ? <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /> : null}
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}