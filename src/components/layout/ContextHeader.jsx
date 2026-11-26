import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import { NAV_ITEMS } from "@/lib/nav";
import { Waves } from "lucide-react";

/**
 * Header-ul persistent: ce cântă acum, starea Auto DJ și numărul de ieșiri.
 * Nu conține controale audio — doar context, ca să nu concureze cu mixerul.
 */
export default function ContextHeader() {
  const dj = useDj();
  const location = useLocation();
  const playingIndexes = dj.decks
    .map((deck, deckIndex) => (deck.isPlaying && deck.track ? deckIndex : -1))
    .filter((deckIndex) => deckIndex >= 0);
  const audible = playingIndexes.includes(0) && playingIndexes.includes(1)
    ? (dj.crossfade >= 0.5 ? 1 : 0)
    : playingIndexes[0];
  const loaded = dj.decks.findIndex((d) => d.track);
  const index = audible >= 0 ? audible : loaded;
  const track = index >= 0 ? dj.decks[index]?.track : null;
  const section = NAV_ITEMS.find((item) => item.to === location.pathname)?.short || "Redare";

  // Redare are propriul titlu, o singură dată, și propriile comenzi.
  if (location.pathname === "/" || location.pathname === "/party") return null;

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 pl-4 pr-16 sm:pl-6 lg:pl-8">
        <Link to="/" className="flex items-center gap-2 md:hidden" aria-label="SyncSonic — redare">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-deck-b text-primary-foreground">
            <Waves className="h-4 w-4" />
          </span>
          <span className="font-heading text-sm font-semibold tracking-tight">SyncSonic</span>
        </Link>

        <div className="mx-1 hidden h-5 w-px bg-border/70 md:block" />
        <p className="hidden font-heading text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground md:block">
          {section}
        </p>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${track ? "bg-success live-dot" : "bg-muted-foreground/40"}`}
            aria-hidden="true"
          />
          <p className="truncate text-xs font-medium">
            {track ? track.name : "Nicio piesă încărcată"}
          </p>
          {track && index >= 0 ? (
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
              deck {["A", "B", "C", "D"][index]}
            </span>
          ) : null}
        </div>

      </div>
    </header>
  );
}