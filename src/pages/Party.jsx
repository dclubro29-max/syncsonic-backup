import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import PartyVisuals from "@/components/party/PartyVisuals";
import EmergencyPlaybackButton from '@/components/audio/EmergencyPlaybackButton';
import StabilityModeButton from '@/components/audio/StabilityModeButton';
import { parseTrackName } from "@/lib/trackName";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { formatTime } from "@/lib/audioAnalysis";
import { PARTY_MAX_CONFIG } from '@/lib/djMaxConfig';
import { Button } from "@/components/ui/button";
import {
  Activity,
  Waves,
  Sparkles,
  Eye,
  EyeOff,
  ArrowLeft,
  Pause,
  Play,
  SkipForward,
  Gauge,
} from "lucide-react";

const MODES = [
  { id: "spectrum", label: "Spectru", icon: Activity },
  { id: "wave", label: "Undă", icon: Waves },
  { id: "ambient", label: "Fundal", icon: Sparkles },
];

const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

/**
 * Mod Party / TV: ecran întreg, doar piesa curentă și vizualizările.
 * Pagina trăiește sub același motor audio persistent, deci intrarea și
 * ieșirea din modul Party nu întrerup muzica.
 */
export default function Party() {
  const dj = useDj();
  const [reduced, setReduced] = useReduceMotion();
  const [mode, setMode] = useState(() => read("musicsync.party.mode", "spectrum"));
  const [showNext, setShowNext] = useState(() => read("musicsync.party.next", "1") === "1");

  useEffect(() => write("musicsync.party.mode", mode), [mode]);
  useEffect(() => write("musicsync.party.next", showNext ? "1" : "0"), [showNext]);

  // Deckul auzit acum: cel care cântă; la tranziție, cel cu ponderea mai mare în crossfader.
  const current = useMemo(() => {
    const playing = dj.decks
      .map((deck, index) => ({ deck, index }))
      .filter(({ deck }) => deck.isPlaying && deck.track);
    if (playing.length > 1) {
      const weight = (index) => (index === 0 ? 1 - dj.crossfade : dj.crossfade);
      playing.sort((a, b) => weight(b.index) - weight(a.index));
    }
    if (playing.length) return playing[0];
    const loaded = dj.decks.map((deck, index) => ({ deck, index })).filter(({ deck }) => deck.track);
    return loaded[0] || null;
  }, [dj.decks, dj.crossfade]);

  const nextUp = useMemo(() => {
    if (dj.autoDj?.on && dj.autoDj.upcoming?.length) return dj.autoDj.upcoming[0].name;
    const other = dj.decks.find((deck, index) => index !== current?.index && deck.track);
    return other?.track?.name || null;
  }, [dj.autoDj?.on, dj.autoDj?.upcoming, dj.decks, current?.index]);

  const deck = current?.deck;
  const { artist, title } = parseTrackName(deck?.track?.name || "");
  const accent = `hsl(var(--deck-${["a", "b", "c", "d"][current?.index ?? 0]}))`;
  const cover = deck?.track?.cover || deck?.track?.art || null;
  const progress = deck?.duration ? Math.min(1, deck.progress / deck.duration) : 0;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-background text-foreground">
      <PartyVisuals
        getSpectrum={dj.getSpectrum}
        mode={mode}
        reduced={reduced}
        className="absolute inset-0 h-full w-full"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/80" />

      <div className="relative flex h-full flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <span className="flex items-center gap-2 font-heading text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            SyncSonic
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            <StabilityModeButton />
            <EmergencyPlaybackButton />
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card/60 p-0.5 backdrop-blur">
              {MODES.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  size="sm"
                  variant={mode === id ? "default" : "ghost"}
                  className="h-8 gap-1.5 rounded-full px-3 text-[11px]"
                  onClick={() => setMode(id)}
                  aria-pressed={mode === id}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant={showNext ? "secondary" : "ghost"}
              className="h-9 gap-1.5 rounded-full text-[11px]"
              onClick={() => setShowNext((v) => !v)}
              title="Arată sau ascunde piesa următoare"
              aria-pressed={showNext}
            >
              {showNext ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Următoarea</span>
            </Button>
            <Button
              size="sm"
              variant={reduced ? "secondary" : "ghost"}
              className="h-9 gap-1.5 rounded-full text-[11px]"
              onClick={() => setReduced(!reduced)}
              title="Animații reduse — fără mișcări rapide"
              aria-pressed={reduced}
            >
              <Gauge className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Animații reduse</span>
            </Button>
            <Button size="sm" variant={dj.autoDj.on && dj.autoDj.config.partyMax && dj.autoDj.config.performance ? 'default' : 'outline'}
              className="h-9 gap-1.5 rounded-full text-[11px]"
              disabled={dj.emergencyPlayback}
              onClick={() => dj.autoDj.on && dj.autoDj.config.partyMax && dj.autoDj.config.performance
                ? dj.autoDj.setOn(false) : dj.autoDj.startMax(PARTY_MAX_CONFIG)}>
              <Sparkles className="h-3.5 w-3.5" />
              {dj.autoDj.on && dj.autoDj.config.partyMax && dj.autoDj.config.performance ? 'Oprește Party MAX' : 'Pornește Party MAX'}
            </Button>
            <Button asChild size="sm" variant="outline" className="h-9 gap-1.5 rounded-full border-border/80 text-[11px]">
              <Link to="/mixer">
                <ArrowLeft className="h-3.5 w-3.5" />
                Înapoi la mixer
              </Link>
            </Button>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-5 pb-10 text-center sm:px-10">
          {!deck?.track ? (
            <div className="max-w-md space-y-4">
              <p className="font-heading text-2xl font-semibold sm:text-3xl">
                Nicio piesă încărcată
              </p>
              <p className="text-sm text-muted-foreground">
                Încarcă o piesă în mixer sau pornește Auto DJ, apoi revino aici.
              </p>
              <Button asChild className="gap-2">
                <Link to="/mixer">
                  <ArrowLeft className="h-4 w-4" />
                  Deschide mixerul
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div
                className="relative mb-8 flex h-36 w-36 items-center justify-center overflow-hidden rounded-full sm:h-48 sm:w-48 lg:h-56 lg:w-56"
                style={{ boxShadow: `0 0 100px -12px ${accent}` }}
              >
                {cover ? (
                  <img src={cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="vinyl-spin flex h-full w-full items-center justify-center rounded-full border border-border/60 bg-card/70"
                    style={{ animationPlayState: deck.isPlaying ? "running" : "paused" }}
                  >
                    <div
                      className="h-20 w-20 rounded-full sm:h-24 sm:w-24"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${accent} 0%, transparent 70%)`,
                      }}
                    />
                    <div
                      className="absolute h-6 w-6 rounded-full border-2 border-background"
                      style={{ background: accent }}
                    />
                  </div>
                )}
              </div>

              <p className="max-w-[18ch] font-heading text-[clamp(2rem,7vw,4.5rem)] font-semibold leading-[1.05] tracking-[-0.04em] sm:max-w-[24ch]">
                {title}
              </p>
              {artist ? (
                <p className="mt-3 text-base text-muted-foreground sm:text-2xl">{artist}</p>
              ) : null}

              <div className="mt-8 w-full max-w-xl">
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${progress * 100}%`, background: accent }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span>{formatTime(deck.progress)}</span>
                  <span>{formatTime(deck.duration)}</span>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-12 w-12 rounded-full border-border/80"
                  onClick={() => dj.togglePlay(current.index)}
                  title={deck.isPlaying ? "Pauză" : "Redă"}
                  aria-label={deck.isPlaying ? "Pauză" : "Redă"}
                >
                  {deck.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                {dj.autoDj?.on ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-12 gap-2 rounded-full border-border/80 px-5"
                    onClick={() => dj.autoDj.skip()}
                    title="Trece imediat la piesa următoare"
                  >
                    <SkipForward className="h-4 w-4" />
                    Următoarea
                  </Button>
                ) : null}
              </div>

              {showNext && nextUp ? (
                <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:text-xs">
                  Urmează · <span className="text-foreground">{parseTrackName(nextUp).title}</span>
                </p>
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}