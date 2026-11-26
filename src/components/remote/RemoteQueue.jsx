import React from "react";
import { Button } from "@/components/ui/button";
import { parseTrackName } from "@/lib/trackName";
import { ListMusic, Zap } from "lucide-react";

/** Coada manuală a gazdei, în ordinea în care va fi redată. */
export default function RemoteQueue({ device, large, onMixNow }) {
  const queue = device?.queue || [];

  return (
    <section className={`panel ${large ? "p-5" : "p-4 sm:p-5"}`}>
      <p className="caps">Coadă</p>
      <p className={`mt-1 text-muted-foreground ${large ? "text-sm" : "text-[12px]"}`}>
        Piesele adăugate pe laptop, în ordinea aleasă.
      </p>
      {queue.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground">
          Coada este goală. Adaugă o piesă din bibliotecă.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {queue.map((track, index) => {
            const { artist, title } = parseTrackName(track.name || "");
            return (
              <li key={track.id} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-medium ${large ? "text-base" : "text-sm"}`}>{title}</span>
                  {artist ? <span className="block truncate text-[11px] text-muted-foreground">{artist}</span> : null}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className={`shrink-0 gap-1.5 border-border/80 ${large ? "h-12 text-base" : "h-9"}`}
                  onClick={() => onMixNow(track)}
                >
                  <Zap className="h-4 w-4" />
                  Mixează
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {queue.length > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ListMusic className="h-3.5 w-3.5" />
          Gazda păstrează coada dacă închizi telefonul.
        </p>
      ) : null}
    </section>
  );
}