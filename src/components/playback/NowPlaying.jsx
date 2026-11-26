import React from "react";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/audioAnalysis";
import { parseTrackName } from "@/lib/trackName";
import { useSkin } from "@/lib/SkinContext";
import PlaybackQueue from "@/components/playback/PlaybackQueue";
import PlayerOptionsMenu from "@/components/playback/PlayerOptionsMenu";
import OutputPanel from "@/components/playback/OutputPanel";
import PartyMaxUltraButton from "@/components/playback/PartyMaxUltraButton";
import {
  ChevronDown,
  Disc3,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

export default function NowPlaying({ dj, index, deck, nextName, onNext, onPrevious, hasNext }) {
  const { skin } = useSkin();
  const track = deck.track;
  const { artist, title } = parseTrackName(track.name || "");
  const cover = track.cover || track.art || null;
  const duration = Number.isFinite(deck.duration) && deck.duration > 0 ? deck.duration : 0;
  const progress = duration ? Math.min(deck.progress || 0, duration) : 0;
  const volume = Math.round(dj.masterVolume * 100);

  return (
    <section className="mx-auto w-full max-w-[520px] space-y-4 md:max-w-[640px] md:space-y-5">
      <div
        className={`relative mx-auto aspect-square w-[min(60vw,330px)] overflow-hidden rounded-[2rem] border border-border/60 bg-card/70 shadow-float ${
          skin === "pulse" ? "pulse-cover" : ""
        }`}
      >
        {cover ? (
          <Image src={cover} alt={`Coperta piesei ${title}`} fittingType="fill" className="h-full w-full object-cover" />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_35%_28%,hsl(var(--primary)/0.34),transparent_58%),radial-gradient(circle_at_75%_80%,hsl(var(--deck-b)/0.24),transparent_60%)]">
            <div className="absolute inset-6 rounded-full border border-foreground/10" aria-hidden="true" />
            <div className="absolute inset-12 rounded-full border border-foreground/[0.07]" aria-hidden="true" />
            <Disc3 className="h-20 w-20 text-foreground/45" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="px-1 text-center">
        <h1 className="font-heading text-[clamp(1.35rem,5.5vw,2.2rem)] font-semibold leading-[1.08] tracking-[-0.04em]">
          {title}
        </h1>
        {artist ? <p className="mt-1.5 text-sm text-muted-foreground">{artist}</p> : null}
        {deck.playbackError ? (
          <p role="alert" className="mt-2 rounded-lg border border-destructive/30 bg-destructive/[0.07] px-3 py-2 text-xs leading-relaxed text-destructive">
            {deck.playbackError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5 px-1">
        <Slider
          value={[progress]}
          max={duration || 1}
          step={1}
          disabled={!duration}
          onValueChange={([value]) => dj.seek(index, value)}
          aria-label="Poziția piesei"
        />
        <div className="flex items-center justify-between font-mono text-[11px] tabular-nums text-muted-foreground">
          <span>{formatTime(progress)}</span>
          <span>{duration ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-5 sm:gap-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full text-muted-foreground hover:text-foreground md:h-12 md:w-12"
          onClick={onPrevious}
          aria-label="Anterioară"
          title="Anterioară"
        >
          <SkipBack className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          className="h-16 w-16 rounded-full shadow-glow md:h-[76px] md:w-[76px]"
          onClick={() => dj.togglePlay(index)}
          disabled={deck.starting}
          aria-label={deck.isPlaying ? "Pauză" : "Redă"}
        >
          {deck.starting ? (
            <Loader2 className="h-5 w-5 animate-spin md:h-6 md:w-6" />
          ) : deck.isPlaying ? (
            <Pause className="h-7 w-7 md:h-8 md:w-8" />
          ) : (
            <Play className="ml-0.5 h-7 w-7 md:h-8 md:w-8" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full text-muted-foreground hover:text-foreground md:h-12 md:w-12"
          onClick={onNext}
          disabled={!hasNext}
          aria-label={hasNext ? "Următoarea" : "Nu există o piesă următoare"}
          title={hasNext ? "Următoarea" : "Nu există o piesă următoare"}
        >
          <SkipForward className="h-5 w-5" />
        </Button>
      </div>

      <PartyMaxUltraButton dj={dj} nextName={nextName} />

      <OutputPanel />

      <div className="grid grid-cols-2 gap-2">
        <PlaybackQueue index={index} track={track} nextName={nextName} />
        <PlayerOptionsMenu />
      </div>

      <details className="group rounded-xl border border-border/60 bg-card/40 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-2">
            {volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            Volum
          </span>
          <span className="flex items-center gap-2">
            <span className="num text-[11px]">{volume}%</span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="pt-4">
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={([value]) => dj.setMasterVolume(value / 100)}
            aria-label="Volum"
          />
        </div>
      </details>
    </section>
  );
}