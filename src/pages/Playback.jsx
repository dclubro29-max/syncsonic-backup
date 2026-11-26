import React, { useState } from "react";
import { useDj } from "@/lib/djContext";
import { makeDemoTrack, DEMO_TRACKS } from "@/lib/demoTracks";
import { useToast } from "@/components/ui/use-toast";
import NowPlaying from "@/components/playback/NowPlaying";
import PlaybackEmpty from "@/components/playback/PlaybackEmpty";

export default function Playback() {
  const dj = useDj();
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);

  const playingIndexes = dj.decks
    .map((deck, deckIndex) => (deck.isPlaying && deck.track ? deckIndex : -1))
    .filter((deckIndex) => deckIndex >= 0);
  // După tranziție ambele deckuri pot reda; comanda urmează deckul auzit,
  // adică partea spre care stă crossfaderul.
  const audibleIndex = playingIndexes.includes(0) && playingIndexes.includes(1)
    ? (dj.crossfade >= 0.5 ? 1 : 0)
    : playingIndexes[0];
  const loadedIndex = dj.decks.findIndex((deck) => deck.track);
  const index = audibleIndex >= 0 ? audibleIndex : loadedIndex;
  const deck = index >= 0 ? dj.decks[index] : null;
  const track = deck?.track || null;

  const currentLibraryIndex = track ? dj.tracks.findIndex((item) => item.id === track.id) : -1;
  const libraryNext = dj.tracks.length
    ? currentLibraryIndex >= 0
      ? dj.tracks[(currentLibraryIndex + 1) % dj.tracks.length]
      : dj.tracks[0]
    : null;
  const libraryPrevious = dj.tracks.length
    ? currentLibraryIndex >= 0
      ? dj.tracks[(currentLibraryIndex - 1 + dj.tracks.length) % dj.tracks.length]
      : dj.tracks[dj.tracks.length - 1]
    : null;
  const otherDeck = dj.decks.find((item, itemIndex) => itemIndex !== index && item.track);
  const autoNext = dj.autoDj?.on ? dj.autoDj.upcoming?.[0] : null;
  const queuedNext = dj.playQueue?.[0] || null;
  const nextTrack = autoNext || otherDeck?.track || queuedNext || libraryNext;
  const hasNext = !!nextTrack && nextTrack.id !== track?.id;
  const nextName = hasNext ? nextTrack.name : null;

  const addFiles = async (files) => {
    if (!files?.length) return;
    setBusy("files");
    try {
      const added = await dj.addFiles(files);
      if (added[0] && !track) {
        await dj.loadToDeck(0, added[0]);
        await dj.togglePlay(0);
      }
    } catch (error) {
      toast({ title: "Fișierele nu au putut fi adăugate", description: error.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const tryDemo = async () => {
    setBusy("demo");
    try {
      const demo = DEMO_TRACKS[0];
      const { blob, bpm } = makeDemoTrack({ bpm: demo.bpm, bars: 8, style: demo.style });
      const file = new File([blob], `${demo.name}.wav`, { type: "audio/wav" });
      // Tempo-ul sursei însoțește demo-ul: analizorul nu mai poate raporta 82,6 BPM
      // pentru un ritm construit la 124 BPM.
      const [added] = await dj.addFiles([file], { bpmHint: bpm || demo.bpm });
      if (!added) return;
      await dj.loadToDeck(0, added);
      await dj.togglePlay(0);
    } catch (error) {
      toast({ title: "Demo-ul nu a pornit", description: error.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const playTrack = async (item) => {
    try {
      await dj.loadToDeck(0, item);
      await dj.togglePlay(0);
    } catch (error) {
      toast({ title: "Piesa nu a pornit", description: error.message, variant: "destructive" });
    }
  };

  const next = async () => {
    if (!hasNext) return;
    if (dj.autoDj?.on) {
      dj.autoDj.skip();
      return;
    }
    const target = index >= 0 ? (index + 1) % dj.deckCount : 0;
    const fromQueue = queuedNext?.id === nextTrack?.id;
    try {
      await dj.loadToDeck(target, nextTrack);
      await dj.togglePlay(target);
      dj.crossfadeOver(target === 0 ? 0 : 1, 4);
      if (fromQueue) dj.removeQueuedTrack(nextTrack.id);
    } catch (error) {
      toast({ title: "Următoarea nu a pornit", description: error.message, variant: "destructive" });
    }
  };

  const previous = async () => {
    if (!deck) return;
    if ((deck.progress || 0) > 3) {
      dj.seek(index, 0);
      return;
    }
    if (!libraryPrevious || libraryPrevious.id === track?.id) {
      dj.seek(index, 0);
      return;
    }
    try {
      await dj.loadToDeck(index, libraryPrevious);
      await dj.togglePlay(index);
    } catch (error) {
      toast({ title: "Anterioara nu a pornit", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[680px] pb-20 pt-4 md:pb-4 md:pt-16">
      {track && deck ? (
        <NowPlaying
          dj={dj}
          index={index}
          deck={deck}
          nextName={nextName}
          hasNext={hasNext}
          onNext={next}
          onPrevious={previous}
        />
      ) : (
        <PlaybackEmpty
          tracks={dj.tracks}
          busy={busy}
          onDemo={tryDemo}
          onFiles={addFiles}
          onPlay={playTrack}
        />
      )}
    </div>
  );
}