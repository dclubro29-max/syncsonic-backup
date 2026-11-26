import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 studio-ambient" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 studio-grid" aria-hidden="true" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-deck-b text-primary-foreground shadow-[0_16px_40px_-18px_hsl(var(--primary)/0.9)]">
            <Icon className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="caps mb-2">SyncSonic</p>
          <h1 className="screen-title text-foreground">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="panel p-6 shadow-float sm:p-8">{children}</div>
        {footer ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        ) : null}
      </div>
    </div>
  );
}