import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import AutoDjTransition from '@/components/AutoDjTransition';
import AutoDjQueue from '@/components/AutoDjQueue';
import AutoDjPresets from '@/components/AutoDjPresets';
import AutoDjEffects from '@/components/AutoDjEffects';
import { previewMixDuration } from '@/lib/autoDjMixPlan';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Disc3, Play, Square, Shuffle, Timer, Waves, AlertTriangle, AudioLines, SkipForward } from "lucide-react";

// Ce face Auto DJ acum, pe scurt: redau / pregătesc următoarea / tranziție.
const PHASE_LABEL = {
  off: "Oprit",
  empty: "Bibliotecă goală",
  starting: "Pornesc",
  playing: "Redau",
  preparing: "Pregătesc următoarea",
  mixing: "Tranziție",
  error: "Problemă",
};

export default function AutoDjPanel() {
  const dj = useDj();
  const auto = dj.autoDj;
  const { on, config, status, setOn, setConfig } = auto;

  const activeDeck = status.activeDeck ?? 0;
  const getDeckAudio = dj.getDeckAudio;
  const getExitPosition = auto.getExitPosition;
  const latest = useRef({ decks: dj.decks, config });
  latest.current = { decks: dj.decks, config };
  const [left, setLeft] = useState(null);

  // Cronometrul se calculează aici, din timpul real al piesei, ca să nu
  // redeseneze toată aplicația la fiecare secundă.
  useEffect(() => {
    if (!on || !getDeckAudio) {
      setLeft(null);
      return;
    }
    const read = () => {
      const a = getDeckAudio(activeDeck);
      if (!a || !isFinite(a.duration) || !a.duration) {
        setLeft(null);
        return;
      }
      const { decks, config: settings } = latest.current;
      const deck = decks[activeDeck], other = decks[1 - activeDeck];
      const b = getDeckAudio(1 - activeDeck);
      const mix = other?.track && Number.isFinite(b?.duration) ? previewMixDuration(settings, deck, other, a, b) : settings.crossfade;
      setLeft(Math.max(0, Math.round((getExitPosition() - a.currentTime) / a.playbackRate - mix)));
    };
    read();
    const id = setInterval(read, 1000);
    return () => clearInterval(id);
  }, [on, activeDeck, getDeckAudio, getExitPosition]);

  const untilTransition = left == null ? null : Math.max(0, left);

  const statusText = (() => {
    if (status.message) return status.message;
    switch (status.phase) {
      case "empty":
        return "Adaugă piese în bibliotecă și pornește din nou.";
      case "starting":
        return status.nextName ? `Pornesc „${status.nextName}”…` : "Pornesc…";
      case "preparing":
        return untilTransition != null
          ? `Urmează „${status.nextName}” · tranziție în ${untilTransition}s`
          : `Urmează „${status.nextName}”`;
      case "mixing":
        return status.nextName
          ? `${status.mixStyle || 'Tranziție'}${status.aligned ? ' · beatmatch' : ''} către „${status.nextName}”… · crossfader ${Math.round(dj.crossfade * 100)}%`
          : "Tranziție în curs…";
      case "playing":
        return untilTransition != null
          ? `Rulează · tranziția următoare în ${untilTransition}s`
          : "Rulează";
      default:
        return "Oprit. Pornește și lasă-l să mixeze singur.";
    }
  })();

  const active = on && status.phase !== "empty" && status.phase !== "error";
  const isProblem = status.phase === "empty" || status.phase === "error";

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 font-heading text-sm">
              <Disc3 className={`h-4 w-4 text-primary ${active ? "animate-spin" : ""}`} />
              Auto DJ
            </CardTitle>
            <CardDescription className="mt-1 text-[11px] leading-relaxed">
              Preia mixarea pe deckurile A/B: {dj.tracks.length} piese din biblioteca locală,
              fază ținută pe tot blendul, EQ de crossover și selecție după tempo, nivel și energie.
              ULTRA adaugă coregrafia build → drop pe structura piesei; analiza rămâne locală.
            </CardDescription>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {PHASE_LABEL[status.phase] || "Oprit"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5 pt-0">
        <div className="flex gap-2">
          <Button
            variant={on ? "destructive" : "default"}
            className="flex-1 gap-2"
            onClick={() => on ? setOn(false) : config.performanceMode === 'max' ? auto.startMax(config) : setOn(true)}
          >
            {on ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {on
              ? "Oprește automatizarea"
              : config.performanceMode === 'max'
                ? (config.intensity || 0) >= 0.8 ? 'Pornește DJ MAX ULTRA' : 'Pornește DJ MAX'
                : 'Pornește Auto DJ'}
          </Button>
          {on && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={auto.skip}
              disabled={status.phase === 'mixing' || status.phase === 'error'}
              title="Pornește tranziția acum, chiar din mijlocul piesei"
            >
              <SkipForward className="h-4 w-4" />
              Tranziție acum
            </Button>
          )}
        </div>
        {on && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Oprirea readuce deck-urile sub control manual imediat; piesa care cântă nu se întrerupe.
          </p>
        )}

        <div
          className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${
            isProblem
              ? "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300"
              : "border-border text-muted-foreground"
          }`}
        >
          <div className="flex items-start gap-2">
            {isProblem ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : status.aligned && status.phase === "mixing" ? (
              <AudioLines className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            ) : (
              <Waves className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            )}
            <span>{statusText}</span>
          </div>
          {status.phase === "empty" && (
            <Link
              to="/library"
              className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
            >
              Deschide biblioteca
            </Link>
          )}
        </div>

        <AutoDjPresets />

        <AutoDjEffects />

        <AutoDjTransition
          value={config.transition || "smooth"}
          onChange={(value) => setConfig({ transition: value })}
        />

        <AutoDjQueue
          upcoming={auto.upcoming}
          onRemove={auto.removeQueued}
          currentName={dj.decks[activeDeck]?.track?.name}
          lockedTrackId={status.phase === 'mixing' ? auto.upcoming[0]?.id : null}
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Timer className="h-3.5 w-3.5" />
              Durata tranziției
            </Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Math.round(config.crossfade)}s
            </span>
          </div>
          <Slider
            value={[config.crossfade]}
            min={4}
            max={24}
            step={1}
            onValueChange={([v]) => setConfig({ crossfade: v })}
          />
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Cât durează trecerea dintre piese. 8–12s sună natural într-un set.
          </p>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
          <div className="min-w-0">
            <Label className="flex items-center gap-2 text-xs font-medium">
              <Disc3 className="h-3.5 w-3.5 text-primary" />
              Potrivește tempo-ul
            </Label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Tempo-ul se pregătește pe deckul mut și rămâne fix în timpul și după mix. Fără salt la viteza naturală pe piesa auzită; BPM-ul incert nu este forțat.
            </p>
          </div>
          <Switch
            checked={config.beatmatch}
            onCheckedChange={(v) => setConfig({ beatmatch: v })}
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
          <div className="min-w-0">
            <Label className="flex items-center gap-2 text-xs font-medium">
              <Waves className="h-3.5 w-3.5 text-primary" />
              Schimbă bass-ul
            </Label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Bass-ul piesei noi revine înainte ca cel vechi să coboare: transfer lin, fără tăiere simultană sau gol de nivel.
            </p>
          </div>
          <Switch
            checked={config.bassSwap}
            onCheckedChange={(v) => setConfig({ bassSwap: v })}
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
          <div className="min-w-0">
            <Label className="flex items-center gap-2 text-xs font-medium">
              <AudioLines className="h-3.5 w-3.5 text-primary" />
              Mix din mijlocul piesei
            </Label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Tranziția pornește la cea mai bună margine de frază din piesă, nu doar la final —
              alege zonele liniștite, fără refren și fără vârf tăiat. Oprit, fiecare piesă rulează
              până la capăt.
            </p>
          </div>
          <Switch
            checked={config.mixPoints !== 'end'}
            onCheckedChange={(v) => setConfig({ mixPoints: v ? 'smart' : 'end' })}
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
          <div className="min-w-0">
            <Label className="flex items-center gap-2 text-xs font-medium">
              <Shuffle className="h-3.5 w-3.5 text-primary" />
              Alege piesa următoare
            </Label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Activat, Auto DJ alege piesa care se leagă cel mai bine ca tempo și nivel sonor. Oprit, merge în
              ordinea bibliotecii și sare doar peste ce nu se poate mixa.
            </p>
          </div>
          <Switch
            checked={config.shuffle}
            onCheckedChange={(v) => setConfig({ shuffle: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}