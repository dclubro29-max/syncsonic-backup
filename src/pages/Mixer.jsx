import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import { DECK_LABELS } from "@/hooks/useDjEngine";
import Deck from "@/components/Deck";
import Crossfader from "@/components/Crossfader";
import Spectrum from "@/components/Spectrum";
import MixerSidebar from "@/components/MixerSidebar";
import ShowReady from "@/components/show/ShowReady";
import QuickPartyButton from "@/components/QuickPartyButton";
import EmergencyPlaybackButton from '@/components/audio/EmergencyPlaybackButton';
import StabilityModeButton from '@/components/audio/StabilityModeButton';
import RecorderBar from "@/components/RecorderBar";
import TrackPicker from "@/components/TrackPicker";
import MixerOptionsMenu from "@/components/mixer/MixerOptionsMenu";
import RepeatOneDialog from "@/components/mixer/RepeatOneDialog";
import AudioSelfCheckDialog from "@/components/audio/AudioSelfCheckDialog";
import PageHeader from "@/components/ui-kit/PageHeader";
import StatusPill from "@/components/ui-kit/StatusPill";
import { Button } from "@/components/ui/button";
import { useSkipTrack } from "@/hooks/useSkipTrack";
import { SYSTEM_DEFAULT_ID } from "@/lib/outputs";
import { makeDemoTrack, DEMO_TRACKS } from "@/lib/demoTracks";
import { Sparkles, PartyPopper, SkipForward, Activity, AudioLines, Repeat, ArrowLeftRight, Loader2, Play } from "lucide-react";

const TAB_ACTIVE = [
  "border-deck-a/40 bg-deck-a/15 text-deck-a",
  "border-deck-b/40 bg-deck-b/15 text-deck-b",
  "border-deck-c/40 bg-deck-c/15 text-deck-c",
  "border-deck-d/40 bg-deck-d/15 text-deck-d",
];

export default function Mixer() {
  const dj = useDj();
  const { skip, canSkip } = useSkipTrack();
  const [activeDeck, setActiveDeck] = useState(0);
  const [checkOpen, setCheckOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const count = dj.deckCount;
  const repeatIndex = dj.decks.slice(0, count).findIndex((d) => d.repeat);
  const labels = DECK_LABELS.slice(0, count);
  const auto = dj.autoDj;
  const autoRunning = auto?.on && auto.status?.phase !== "error";
  const playingIndexes = dj.decks
    .map((deck, deckIndex) => (deck.isPlaying && deck.track ? deckIndex : -1))
    .filter((deckIndex) => deckIndex >= 0);
  // Crossfaderul decide ce deck este „Cântă acum” când ambele sunt pornite.
  const nowIndex = playingIndexes.includes(0) && playingIndexes.includes(1)
    ? (dj.crossfade >= 0.5 ? 1 : 0)
    : playingIndexes.length
      ? playingIndexes[0]
      : dj.decks.findIndex((deck) => deck.track);
  const transitionTo = nowIndex === 0 ? 1 : 0;
  const nextName = (auto?.on && auto.upcoming?.[0]?.name) ||
    dj.decks.find((deck, index) => index !== nowIndex && deck.track)?.track?.name || null;
  const transitionIn = auto?.on && nowIndex >= 0
    ? Math.max(0, (auto.getExitPosition?.() ?? 0) - (dj.decks[nowIndex]?.progress || 0))
    : 0;

  const transition = async () => {
    const target = dj.decks[transitionTo];
    if (!target?.track || dj.autoDj.on) return;
    if (!target.isPlaying) await dj.togglePlay(transitionTo);
    dj.crossfadeOver(transitionTo === 0 ? 0 : 1, 4);
  };

  const bothEmpty = !dj.decks[0]?.track && !dj.decks[1]?.track;

  const startDemoMix = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      const fileFor = (demo) => {
        const { blob } = makeDemoTrack({ bpm: demo.bpm, bars: 8, style: demo.style });
        return new File([blob], `${demo.name}.wav`, { type: "audio/wav" });
      };
      const [addedA] = await dj.addFiles([fileFor(DEMO_TRACKS[0])], { bpmHint: DEMO_TRACKS[0].bpm });
      const [addedB] = await dj.addFiles([fileFor(DEMO_TRACKS[1])], { bpmHint: DEMO_TRACKS[1].bpm });
      if (addedA) await dj.loadToDeck(0, addedA);
      if (addedB) await dj.loadToDeck(1, addedB);
      dj.setCrossfade(0);
      if (addedA) await dj.togglePlay(0);
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader
        eyebrow="Consola"
        title="Mixer"
        icon={AudioLines}
        description={
          dj.advanced
            ? "Mod avansat: patru deckuri, efecte, loop-uri și sampler."
            : "Mod simplu: două deckuri, crossfader și hot cues."
        }
        actions={
          <>
            <StabilityModeButton />
            <EmergencyPlaybackButton />
            <QuickPartyButton />
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/start">
                <PartyPopper className="h-3.5 w-3.5" />
                Pregătește petrecerea
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-border/80"
              onClick={skip}
              disabled={!canSkip}
              title="Trece la piesa următoare"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Următoarea
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-border/80"
              onClick={transition}
              disabled={!dj.decks[transitionTo]?.track || dj.autoDj.on}
              title="Tranziție de 4 secunde către piesa încărcată pe celălalt deck"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Pornește tranziția
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-border/80"
              onClick={() => setRepeatOpen(true)}
              title="Alege o piesă și rulează în buclă, fără oprire"
            >
              <Repeat className="h-3.5 w-3.5" />
              Repetă
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-border/80"
              onClick={() => setCheckOpen(true)}
              title="Verificare audio de 2 minute"
            >
              <Activity className="h-3.5 w-3.5" />
              Verifică sunetul
            </Button>
            <MixerOptionsMenu />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={dj.outputCount > 0 ? "live" : "warn"} dot>
          {dj.outputCount > 0
            ? `${dj.outputCount} ${dj.outputCount === 1 ? "ieșire activă" : "ieșiri active"}`
            : dj.selectedSpeakers.includes(SYSTEM_DEFAULT_ID) ? "Ieșirea sistemului" : "fără boxă selectată"}
        </StatusPill>
        <StatusPill tone={autoRunning ? "ready" : "neutral"} icon={Sparkles}>
          {autoRunning ? "Auto DJ activ" : "Auto DJ oprit"}
        </StatusPill>
        <StatusPill tone="neutral">{dj.advanced ? "4 deckuri" : "2 deckuri"}</StatusPill>
        {repeatIndex >= 0 && (
          <StatusPill tone="live" dot pulse icon={Repeat}>
            Repetă · {dj.decks[repeatIndex]?.track?.name || "piesă"}
          </StatusPill>
        )}
        {dj.emergency.on && <StatusPill tone="warn">Urgență · o singură boxă · {dj.emergency.speaker}</StatusPill>}
        {dj.isRecording ? (
          <StatusPill tone="danger" dot pulse>
            REC {Math.floor(dj.elapsed)}s
          </StatusPill>
        ) : null}
      </div>

      {bothEmpty ? (
        <Button className="h-12 w-full gap-2" onClick={startDemoMix} disabled={demoBusy}>
          {demoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {demoBusy ? "Pregătesc cele două demo-uri…" : "Încearcă demo cu două piese"}
        </Button>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="panel-quiet px-4 py-3">
          <p className="caps">Cântă acum</p>
          <p className="mt-1 truncate text-sm font-medium">
            {nowIndex >= 0 ? dj.decks[nowIndex]?.track?.name : "Nicio piesă încărcată"}
          </p>
        </div>
        <div className="panel-quiet px-4 py-3">
          <p className="caps">Urmează</p>
          <p className="mt-1 truncate text-sm font-medium">{nextName || "Alege următoarea piesă"}</p>
          {autoRunning && transitionIn > 0 && (
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              tranziție în ~{Math.round(transitionIn)}s
            </p>
          )}
        </div>
      </div>

      <ShowReady />

      <section className="panel-quiet overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
          <span className="caps flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-primary" aria-hidden="true" />
            Spectru master
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            live
          </span>
        </div>
        <div className="h-14 px-2 py-1">
          <Spectrum getSpectrum={dj.getSpectrum} className="h-12 w-full opacity-90" />
        </div>
      </section>

      <RecorderBar />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="space-y-5">
          <div className="lg:hidden">
            <div
              className="mb-3 grid gap-1.5 rounded-xl border border-border/60 bg-card/60 p-1"
              style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
            >
              {labels.map((l, i) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setActiveDeck(i)}
                  aria-pressed={activeDeck === i}
                  className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition-colors ${
                    activeDeck === i
                      ? TAB_ACTIVE[i] || TAB_ACTIVE[0]
                      : "border-transparent text-muted-foreground hover:bg-accent/60"
                  }`}
                >
                  {l}
                  {dj.decks[i].isPlaying ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
                </button>
              ))}
            </div>
            <Deck index={Math.min(activeDeck, count - 1)} />
          </div>

          <div className="hidden gap-5 lg:grid lg:grid-cols-2">
            {labels.map((_, i) => (
              <Deck key={i} index={i} />
            ))}
          </div>

          <div className="hidden md:block">
            <Crossfader
              value={dj.crossfade}
              onChange={dj.setCrossfade}
              masterVolume={dj.masterVolume}
              onMasterVolume={dj.setMasterVolume}
              locked={dj.volumeLock !== null}
            />
          </div>
        </div>

        <aside className="xl:sticky xl:top-20">
          <MixerSidebar />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] z-20 px-3 pb-2 md:hidden">
        <Crossfader
          compact
          value={dj.crossfade}
          onChange={dj.setCrossfade}
          masterVolume={dj.masterVolume}
          onMasterVolume={dj.setMasterVolume}
          locked={dj.volumeLock !== null}
        />
      </div>

      <AudioSelfCheckDialog open={checkOpen} onOpenChange={setCheckOpen} />

      <RepeatOneDialog open={repeatOpen} onOpenChange={setRepeatOpen} />

      <TrackPicker
        open={dj.pickerDeck !== null}
        onOpenChange={(v) => !v && dj.setPickerDeck(null)}
        tracks={dj.tracks}
        deckLabel={dj.pickerDeck !== null ? DECK_LABELS[dj.pickerDeck] : "A"}
        onPick={(t) => {
          dj.loadToDeck(dj.pickerDeck, t);
          dj.setPickerDeck(null);
        }}
      />
    </div>
  );
}