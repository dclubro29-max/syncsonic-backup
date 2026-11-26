import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import { DECK_LABELS } from "@/hooks/useDjEngine";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Repeat, Search, Music, Square } from "lucide-react";
import { formatSize } from "@/lib/trackStore";

/** O piesă aleasă rulează în buclă pe un deck, până o oprești. */
export default function RepeatOneDialog({ open, onOpenChange }) {
  const dj = useDj();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const repeatIndex = dj.decks.slice(0, dj.deckCount).findIndex((d) => d.repeat);
  const activeDeck = repeatIndex >= 0 ? dj.decks[repeatIndex] : null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? dj.tracks.filter((t) => t.name.toLowerCase().includes(q)) : dj.tracks;
  }, [dj.tracks, query]);

  const start = async (track) => {
    if (busy) return;
    setBusy(true);
    try {
      const decks = dj.decks.slice(0, dj.deckCount);
      let index = decks.findIndex((d, i) => i !== repeatIndex && !d.isPlaying);
      if (index < 0) index = repeatIndex >= 0 ? repeatIndex : 0;
      if (repeatIndex >= 0 && repeatIndex !== index) dj.setRepeat(repeatIndex, false);
      await dj.loadToDeck(index, track);
      dj.setRepeat(index, true);
      await dj.togglePlay(index);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const stop = () => {
    if (repeatIndex < 0) return;
    dj.setRepeat(repeatIndex, false);
    if (dj.decks[repeatIndex]?.isPlaying) dj.togglePlay(repeatIndex);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Repetare continuă</DialogTitle>
          <DialogDescription>
            Alege o piesă și rulează în buclă pe deckul liber. O poți opri oricând.
          </DialogDescription>
        </DialogHeader>

        {activeDeck && (
          <div className="flex items-center gap-3 rounded-xl border border-success/35 bg-success/10 px-4 py-3">
            <Repeat className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{activeDeck.track?.name || "Piesă"}</p>
              <p className="text-[11px] text-muted-foreground">
                Deck {DECK_LABELS[repeatIndex]} · în buclă
              </p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 border-border/80" onClick={stop}>
              <Square className="h-3.5 w-3.5" />
              Oprește
            </Button>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută în bibliotecă…"
            className="pl-9"
          />
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {results.length === 0 && (
            <div className="space-y-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <p>
                {dj.tracks.length === 0
                  ? "Biblioteca este goală. Adaugă piese ca să le poți repeta."
                  : "Nicio piesă găsită."}
              </p>
              {dj.tracks.length === 0 && (
                <Button asChild size="sm" onClick={() => onOpenChange(false)}>
                  <Link to="/library">Deschide biblioteca</Link>
                </Button>
              )}
            </div>
          )}
          {results.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
              <Music className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatSize(t.size)}</p>
              </div>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => start(t)}>
                <Repeat className="h-3.5 w-3.5" />
                Repetă
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}