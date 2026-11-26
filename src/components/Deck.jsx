import React, { useState } from "react";
import { useDj } from "@/lib/djContext";
import { useRepeatGuard } from "@/components/mixer/RepeatLockProvider";
import { DECK_LABELS } from "@/hooks/useDjEngine";
import { Button } from "@/components/ui/button";
import LevelMeter from "@/components/LevelMeter";
import Waveform, { STRUCTURE_COLORS } from "@/components/deck/Waveform";
import HotCues from "@/components/deck/HotCues";
import DeckAdvanced from "@/components/deck/DeckAdvanced";
import ControlSlider from "@/components/ui-kit/ControlSlider";
import StatReadout from "@/components/ui-kit/StatReadout";
import StatusPill from "@/components/ui-kit/StatusPill";
import TransportButton from "@/components/ui-kit/TransportButton";
import { formatTime } from "@/lib/audioAnalysis";
import { Play, Pause, Music2, Disc3, ChevronDown, Crosshair, Link2, Headphones, KeyRound } from "lucide-react";

// Accentul fiecărui deck, din tokenii temei: A = cyan, B = magenta, C = verde, D = ambră.
const ACCENTS = [
  {
    line: "bg-gradient-to-r from-deck-a via-deck-a/50 to-transparent",
    badge: "bg-deck-a text-background",
    spin: "text-deck-a animate-spin",
    wave: "hsl(var(--deck-a))",
    pill: "deckA",
  },
  {
    line: "bg-gradient-to-r from-deck-b via-deck-b/50 to-transparent",
    badge: "bg-deck-b text-background",
    spin: "text-deck-b animate-spin",
    wave: "hsl(var(--deck-b))",
    pill: "deckB",
  },
  {
    line: "bg-gradient-to-r from-deck-c via-deck-c/50 to-transparent",
    badge: "bg-deck-c text-background",
    spin: "text-deck-c animate-spin",
    wave: "hsl(var(--deck-c))",
    pill: "deckC",
  },
  {
    line: "bg-gradient-to-r from-deck-d via-deck-d/50 to-transparent",
    badge: "bg-deck-d text-background",
    spin: "text-deck-d animate-spin",
    wave: "hsl(var(--deck-d))",
    pill: "deckD",
  },
];

export default function Deck({ index }) {
  const dj = useDj();
  const lock = useRepeatGuard();
  const deck = dj.decks[index];
  const accent = ACCENTS[index] || ACCENTS[0];
  const label = DECK_LABELS[index];
  const hasTrack = !!deck.track;
  const [open, setOpen] = useState(false);

  const pair = index % 2 === 0 ? index + 1 : index - 1;

  const actions = {
    onEq: (band, db) => dj.setEq(index, band, db),
    onTempo: (v) => dj.setTempo(index, v),
    onTrim: (v) => dj.setDeckTrim(index, v),
    onVolume: (v) => dj.setDeckVolume(index, v),
    onSetBpm: (v) => dj.setDeckBpm(index, v, true),
    onResetBpm: () => dj.setDeckBpm(index, deck.bpmDetected, false),
    onBeatOffset: (v) => dj.setDeckBeatOffset(index, v),
    onResetBeatOffset: () => dj.resetBeatOffset(index),
    onLoopBoundary: (which) => dj.setLoopBoundary(index, which),
    onBeatLoop: (beats) => dj.beatLoop(index, beats),
    onClearLoop: () => dj.clearLoop(index),
    onRepeat: () =>
      deck.repeat ? lock.guardDeck(index, () => dj.setRepeat(index, false)) : dj.setRepeat(index, true),
    onFx: (kind, v) => dj.setFx(index, kind, v),
    onResetFx: () => dj.resetFx(index),
  };

  return (
    <section className="panel overflow-hidden">
      <div className={`h-px w-full ${accent.line}`} aria-hidden="true" />
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-heading text-sm font-bold ${accent.badge}`}
          >
            {label}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-medium ${hasTrack ? "" : "text-muted-foreground"}`}>
              {hasTrack ? deck.track.name : "Nicio piesă încărcată"}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Deck {label} · {deck.isPlaying ? "live" : "în pauză"}
            </p>
          </div>
          <StatusPill tone={deck.isPlaying ? accent.pill : "neutral"} dot pulse={deck.isPlaying}>
            {!hasTrack ? "GOL" : deck.isPlaying ? "LIVE" : "PAUZĂ"}
          </StatusPill>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg border-border/70"
            title={hasTrack ? "Schimbă piesa" : "Alege piesa"}
            aria-label={hasTrack ? "Schimbă piesa" : "Alege piesa"}
            onClick={() => lock.guardDeck(index, () => dj.setPickerDeck(index))}
          >
            <Music2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <StatReadout
              label="Timp"
              value={hasTrack ? formatTime(deck.progress) : "0:00"}
              hint={`din ${formatTime(deck.duration)}`}
              className="min-w-[68px]"
            />
            <StatReadout
              label="BPM"
              value={deck.bpm ? deck.bpm.toFixed(1) : "—"}
              tone={deck.bpm ? "primary" : "muted"}
              hint={
                !deck.tempo || Math.abs(deck.tempo - 1) < 0.0005
                  ? "tempo original"
                  : `${(deck.tempo - 1) * 100 >= 0 ? "+" : ""}${((deck.tempo - 1) * 100).toFixed(1)}% tempo`
              }
              className="min-w-[56px]"
            />
          </div>
          <Disc3 className={`h-6 w-6 shrink-0 ${deck.isPlaying ? accent.spin : "text-muted-foreground/30"}`} />
        </div>

        <div className="inset mb-3 p-1.5">
          <Waveform
            peaks={deck.peaks}
            progress={deck.progress}
            duration={deck.duration}
            cue={deck.cue}
            hotCues={deck.hotCues}
            loop={deck.loop}
            color={accent.wave}
            analyzing={deck.analyzing}
            error={deck.analysisError}
            bpm={deck.bpm}
            tempo={deck.tempo}
            beatOffset={deck.beatOffset}
            structure={deck.structure?.events || []}
            onSeek={(t) => dj.seek(index, t)}
          />
        </div>

        {deck.structure?.events?.length ? (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-sm" style={{ background: STRUCTURE_COLORS.drop }} />
              drop
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-sm" style={{ background: STRUCTURE_COLORS.chorus }} />
              refren
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-sm" style={{ background: STRUCTURE_COLORS.peak }} />
              vârf
            </span>
          </div>
        ) : (
          <div className="mb-4" />
        )}

        {deck.playbackError && <p role="alert" className="mb-3 text-sm text-destructive">{deck.playbackError}</p>}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <TransportButton
            round
            solid
            label={deck.starting ? "Pornesc…" : deck.isPlaying ? "Pauză" : "Redă"}
            hint={deck.isPlaying ? "Pauză" : "Redă"}
            icon={deck.isPlaying ? Pause : Play}
            onClick={() => (deck.isPlaying ? lock.guardDeck(index, () => dj.togglePlay(index)) : dj.togglePlay(index))}
            disabled={!hasTrack || deck.starting}
          />
          <TransportButton
            active={deck.cue != null}
            icon={Crosshair}
            label="CUE"
            hint="Oprit: memorează poziția. În redare: sari la CUE."
            onClick={() => dj.cueAction(index)}
            disabled={!hasTrack}
          />
          <TransportButton
            icon={Link2}
            label="SYNC"
            hint={`Potrivește tempo-ul și faza cu deckul ${DECK_LABELS[pair]}`}
            onClick={() => dj.syncDeck(index, pair)}
            disabled={!hasTrack || !deck.bpm || !dj.decks[pair]?.bpm}
          />
          <TransportButton
            active={deck.monitor}
            icon={Headphones}
            label="CĂȘTI"
            hint={
              dj.cueDevice
                ? "Preascultare în căști: auzi acest deck doar în ieșirea de căști, indiferent de fader."
                : "Alege mai întâi ieșirea de căști în pagina Boxe și sunet."
            }
            onClick={() => dj.toggleMonitor(index)}
            disabled={!hasTrack}
          />
          <TransportButton
            active={deck.keyLock}
            icon={KeyRound}
            label="KEY"
            hint="Key lock: schimbi tempo-ul fără să se schimbe tonalitatea piesei."
            onClick={() => dj.setKeyLock(index, !deck.keyLock)}
            disabled={!hasTrack}
          />
        </div>

        <HotCues
          cues={deck.hotCues}
          disabled={!hasTrack}
          onJump={(s) => dj.jumpHotCue(index, s)}
          onSet={(s) => dj.setHotCue(index, s)}
          onClear={(s) => dj.clearHotCue(index, s)}
        />

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="caps">Nivel</span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">RMS</span>
          </div>
          <LevelMeter getMeter={() => dj.getDeckMeter(index)} />
        </div>

        <ControlSlider
          className="mt-4"
          label="Volum deck"
          value={Math.round(deck.volume * 100)}
          display={`${Math.round(deck.volume * 100)}%`}
          onChange={(v) => actions.onVolume(v[0] / 100)}
          disabled={!hasTrack}
        />

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-h-10 w-full items-center justify-between rounded-xl border border-border/70 bg-surface-raised/40 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            EQ, tempo, trim, BPM, loop, efecte
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
          {open && <DeckAdvanced deck={deck} disabled={!hasTrack} hasTrack={hasTrack} actions={actions} />}
        </div>
      </div>
    </section>
  );
}