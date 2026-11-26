import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Music } from "lucide-react";
import { Link } from "react-router-dom";
import { formatSize } from "@/lib/trackStore";

export default function TrackPicker({ open, onOpenChange, tracks, deckLabel, onPick }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter((t) => t.name.toLowerCase().includes(q));
  }, [tracks, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Alege piesa pentru deck {deckLabel}
          </DialogTitle>
        </DialogHeader>

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
                {tracks.length === 0
                  ? "Biblioteca este goală. Fișierele stau local, în browserul acesta — adaugă piese ca să le poți încărca."
                  : "Nicio piesă găsită."}
              </p>
              {tracks.length === 0 && (
                <Button asChild size="sm" onClick={() => onOpenChange(false)}>
                  <Link to="/library">Deschide biblioteca</Link>
                </Button>
              )}
            </div>
          )}
          {results.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-border px-4 py-3"
            >
              <Music className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatSize(t.size)}</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  onPick(t);
                  onOpenChange(false);
                }}
              >
                Încarcă
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}