import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import { Button } from "@/components/ui/button";
import { Pause, Play, Disc3 } from "lucide-react";
import { useRepeatGuard } from "@/components/mixer/RepeatLockProvider";
import { parseTrackName } from "@/lib/trackName";

const ACCENT = ["bg-deck-a", "bg-deck-b", "bg-deck-c", "bg-deck-d"];

export default function MiniPlayer() {
  const dj = useDj();
  const guard = useRepeatGuard();
  const location = useLocation();

  if (["/", "/mixer", "/party"].includes(location.pathname)) return null;

  const loaded = dj.decks.filter((deck) => deck.track);
  if (loaded.length === 0 && !dj.isRecording) return null;

  const playingIndexes = dj.decks
    .map((deck, deckIndex) => (deck.isPlaying && deck.track ? deckIndex : -1))
    .filter((deckIndex) => deckIndex >= 0);
  const audible = playingIndexes.includes(0) && playingIndexes.includes(1)
    ? (dj.crossfade >= 0.5 ? 1 : 0)
    : playingIndexes[0];
  const index = audible >= 0 ? audible : dj.decks.findIndex((deck) => deck.track);
  const now = index >= 0 ? dj.decks[index] : null;
  const progress = now?.duration ? Math.min(100, (now.progress / now.duration) * 100) : 0;
  const title = now?.track?.name ? parseTrackName(now.track.name).title : null;

  const toggle = () => {
    if (!now) return;
    if (now.isPlaying) guard.guardDeck(index, () => dj.togglePlay(index));
    else dj.togglePlay(index);
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] z-30 border-t border-border/70 bg-card/95 backdrop-blur-xl md:bottom-0 md:left-64">
      <div
        className="h-0.5 w-full bg-border/50"
        role="progressbar"
        aria-label="Progresul piesei curente"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full ${ACCENT[index] || ACCENT[0]} transition-[width] duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Disc3 className={`h-5 w-5 shrink-0 ${now?.isPlaying ? "animate-spin text-primary" : "text-muted-foreground/50"}`} />
        <Link to="/" className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">
            {title || (dj.isRecording ? "Înregistrare în curs" : "Nicio piesă încărcată")}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {dj.isRecording ? `REC ${Math.floor(dj.elapsed)}s` : "Redare"}
          </p>
        </Link>
        {now ? (
          <Button
            size="icon"
            variant={now.isPlaying ? "default" : "outline"}
            className="h-10 w-10 shrink-0 rounded-full"
            onClick={toggle}
            aria-label={now.isPlaying ? "Pauză" : "Redă"}
            title={now.isPlaying ? "Pauză" : "Redă"}
          >
            {now.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>
    </div>
  );
}