import React from "react";
import { useDj } from "@/lib/djContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sparkles, Power } from "lucide-react";
import { usePerformanceReadout } from '@/hooks/usePerformanceReadout';

/**
 * Modul Petrecere: aplică singur efecte pe piesele care cântă, pe beat —
 * build cu bass-ul scos treptat și ecou, apoi drop care lovește.
 */
export default function PartyPanel() {
  const dj = useDj();
  const party = dj.partyMode;
  const activeDeck = dj.autoDj.on ? dj.autoDj.status.activeDeck ?? 0
    : dj.decks[1]?.isPlaying && (!dj.decks[0]?.isPlaying || dj.crossfade > 0.5) ? 1
      : Math.max(0, dj.decks.findIndex((deck) => deck.track && deck.isPlaying));
  const readout = usePerformanceReadout({ on: party.on, activeDeck,
    mixing: dj.autoDj.on && dj.autoDj.status.phase === 'mixing',
    getDeckPerformance: dj.getDeckPerformance, getDeckAudio: dj.getDeckAudio });
  const playing = readout.filter((row) => row.playing);

  return (
    <Card
      className={`border-border/60 backdrop-blur-xl transition-colors ${
        party.on ? "bg-primary/10 ring-1 ring-primary/40" : "bg-card/60"
      }`}
    >
      <CardHeader className="p-5 pb-4">
        <CardTitle className="flex items-center gap-2 font-heading text-sm">
          <Sparkles className={`h-4 w-4 ${party.on ? "text-primary" : "text-muted-foreground"}`} />
          Party MAX
        </CardTitle>
        <CardDescription className="mt-1 text-[11px] leading-relaxed">
          Filtru pronunțat, ecou, reverb și build → drop de la pornire.
          Funcționează și cu Auto DJ, fără două automatizări suprapuse.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        <Button
          variant={party.on ? "default" : "outline"}
          className="w-full gap-2"
          onClick={() => party.setOn(!party.on)}
          disabled={party.suspended}
        >
          <Power className="h-4 w-4" />
          {party.on ? "Oprește efectele Party MAX" : "Activează Party MAX"}
        </Button>

        <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
          <Button
            size="sm"
            variant={party.style === "build" ? "default" : "ghost"}
            className="h-7 flex-1 rounded-full px-3 text-[11px]"
            onClick={() => party.setStyle("build")}
          >
            Build & Drop
          </Button>
          <Button
            size="sm"
            variant={party.style === "stab" ? "default" : "ghost"}
            className="h-7 flex-1 rounded-full px-3 text-[11px]"
            onClick={() => party.setStyle("stab")}
          >
            Bass Stabs
          </Button>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-medium">Intensitate</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Math.round(party.intensity * 100)}%
            </span>
          </div>
          <Slider
            value={[Math.round(party.intensity * 100)]}
            min={20}
            max={100}
            step={5}
            onValueChange={([v]) => party.setIntensity(v / 100)}
          />
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {dj.autoDj.on ? 'Auto DJ aplică aceleași efecte Party MAX pe piesă și la tranziții.' : 'Pornește redarea pe un deck pentru efecte; butonul Party MAX din antet pornește și mixarea automată.'}
          {' '}Fără BPM detectat, efectele folosesc 120 BPM. Totul rulează local; volumul master nu se schimbă.
          {party.on && <span className="mt-2 block font-mono text-primary" aria-live="off">
            {playing.length ? playing.map((row) => `Deck ${['A', 'B', 'C', 'D'][row.index]} · bass ${((row.bass || 0) + (row.eqLow || 0)).toFixed(1)} dB · filtru ${Math.round(row.filterHz || 20000)} Hz · ecou ${Math.round((row.echo || 0) * 100)}% · reverb ${Math.round((row.reverb || 0) * 100)}%`).join(' | ')
              : 'Party MAX pregătit · pornește redarea ca să se aplice efectele.'}
          </span>}
        </p>
      </CardContent>
    </Card>
  );
}