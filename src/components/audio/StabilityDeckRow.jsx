import React from 'react';
import { Pause, Play } from 'lucide-react';
import { useDj } from '@/lib/djContext';
import { Button } from '@/components/ui/button';

export default function StabilityDeckRow({ index }) {
  const dj = useDj(), deck = dj.decks[index], label = ['A', 'B', 'C', 'D'][index];
  return <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
    <legend className="px-2 font-heading text-sm font-semibold">Deck {label}</legend>
    <label className="block space-y-1 text-xs text-muted-foreground">
      <span>Piesă</span>
      <select value={deck.track?.id || ''} disabled={dj.autoDj.on || !dj.tracks.length}
        className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
        onChange={(event) => {
          const track = dj.tracks.find((item) => item.id === event.target.value);
          if (track) dj.loadToDeck(index, track);
        }}>
        <option value="">Alege o piesă</option>
        {deck.track && !dj.tracks.some((track) => track.id === deck.track.id) && <option value={deck.track.id}>{deck.track.name}</option>}
        {dj.tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
      </select>
    </label>
    <div className="flex items-center gap-4">
      <Button variant="outline" disabled={!deck.track || deck.starting || dj.autoDj.on} onClick={() => dj.togglePlay(index)}>
        {deck.isPlaying ? <Pause /> : <Play />}{deck.starting ? 'Pornire…' : deck.isPlaying ? 'Pauză' : 'Redă'}
      </Button>
      <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
        <span>Volum</span><input type="range" aria-label={`Volum deck ${label}`} min="0" max="1" step="0.01"
          value={deck.volume} onChange={(event) => dj.setDeckVolume(index, Number(event.target.value))} className="min-w-0 flex-1 accent-primary" />
      </label>
    </div>
    {deck.playbackError && <p role="alert" className="text-xs text-destructive">{deck.playbackError}</p>}
  </fieldset>;
}