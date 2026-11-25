import React from "react";

/** Fallback scurt cât se descarcă o pagină sau unelte grele. */
export default function PageLoader() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center" role="status" aria-live="polite">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
      <span className="sr-only">Se încarcă…</span>
    </div>
  );
}