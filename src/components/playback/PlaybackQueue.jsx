import React from "react";
import { Link } from "react-router-dom";
import { ListMusic, Music2, Play, X } from "lucide-react";
import { useDj } from "@/lib/djContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { parseTrackName } from "@/lib/trackName";

export default function PlaybackQueue({ index, track, nextName }) {
  const dj = useDj();
  const upcoming = dj.autoDj?.on ? dj.autoDj.upcoming || [] : [];
  const manualQueue = dj.playQueue || [];
  const loaded = dj.decks
    .map((deck, deckIndex) => ({ deck, deckIndex }))
    .filter(({ deck }) => deck.track);

  const play = async (deckIndex) => {
    if (!dj.decks[deckIndex]?.track) return;
    if (!dj.decks[deckIndex].isPlaying) await dj.togglePlay(deckIndex);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-12 w-full gap-2 border-border/80">
          <ListMusic className="h-4 w-4" />
          Coadă
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[78vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-heading">Coada de redare</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-5 pb-6">
          {track ? (
            <div className="rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-3">
              <p className="caps text-primary">Acum</p>
              <p className="mt-1 truncate text-sm font-medium">{parseTrackName(track.name).title}</p>
            </div>
          ) : null}

          {nextName && manualQueue.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
              <p className="caps">Urmează</p>
              <p className="mt-1 truncate text-sm font-medium">{parseTrackName(nextName).title}</p>
            </div>
          ) : null}

          {manualQueue.length > 0 && (
            <div className="space-y-2">
              <p className="caps">În coadă</p>
              {manualQueue.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border/50 px-3.5 py-2.5">
                  <Music2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{parseTrackName(item.name).title}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => dj.removeQueuedTrack(item.id)}
                    aria-label={`Scoate ${parseTrackName(item.name).title} din coadă`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="caps">În set</p>
              {upcoming.slice(0, 12).map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border/50 px-3.5 py-2.5">
                  <Music2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{parseTrackName(item.name).title}</span>
                </div>
              ))}
            </div>
          )}

          {loaded.length > 0 && (
            <div className="space-y-2">
              <p className="caps">Încărcate pe deckuri</p>
              {loaded.map(({ deck, deckIndex }) => (
                <div key={deckIndex} className="flex items-center gap-3 rounded-xl border border-border/50 px-3.5 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-raised font-mono text-[10px] font-semibold">
                    {["A", "B", "C", "D"][deckIndex]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{parseTrackName(deck.track.name).title}</span>
                  {deckIndex === index ? (
                    <span className="chip border-primary/40 text-primary">acum</span>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => play(deckIndex)}>
                      <Play className="h-3.5 w-3.5" />
                      Redă
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!nextName && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
              <p className="text-sm text-muted-foreground">Nu există o piesă următoare în coadă.</p>
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link to="/library"><Music2 className="h-3.5 w-3.5" /> Adaugă muzică</Link>
              </Button>
            </div>
          )}

          {!track && loaded.length === 0 && (
            <p className="text-sm text-muted-foreground">Coada este goală. Alege o piesă din Bibliotecă sau încearcă un demo.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}