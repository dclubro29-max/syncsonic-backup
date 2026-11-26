import React from "react";
import { Button } from "@/components/ui/button";
import { Repeat, LogOut } from "lucide-react";
import { formatTime } from "@/lib/audioAnalysis";

const BEATS = [1, 2, 4, 8, 16];

/** Loop pe regiune (IN/OUT) și loop-uri pe bătăi, calculate din BPM. */
export default function LoopControls({ deck, hasBpm, disabled, onBoundary, onBeatLoop, onClear, onRepeat }) {
  const loopLen = deck.loop ? deck.loop.end - deck.loop.start : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground">LOOP</span>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] font-bold" disabled={disabled} onClick={() => onBoundary("in")}>
          IN
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] font-bold" disabled={disabled} onClick={() => onBoundary("out")}>
          OUT
        </Button>
        <Button
          size="sm"
          variant={deck.repeat ? "default" : "outline"}
          className="h-7 px-2 text-[10px] font-bold"
          disabled={disabled}
          onClick={onRepeat}
          title="Repetă toată piesa"
        >
          <Repeat className="h-3 w-3" />
        </Button>
        {deck.loop && (
          <Button size="sm" variant="secondary" className="h-7 gap-1 px-2 text-[10px] font-bold" onClick={onClear}>
            <LogOut className="h-3 w-3" />
            Ieși
          </Button>
        )}
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {deck.loop ? `${formatTime(deck.loop.start)} → ${formatTime(deck.loop.end)}` : "fără loop"}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {BEATS.map((b) => (
          <button
            key={b}
            type="button"
            disabled={disabled || !hasBpm}
            onClick={() => onBeatLoop(b)}
            title={hasBpm ? `Loop de ${b} bătăi` : "Are nevoie de BPM (setează-l manual dacă analiza nu l-a găsit)"}
            className="flex h-7 flex-1 items-center justify-center rounded-md border border-border text-[10px] font-semibold text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-40"
          >
            {b}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground">bătăi</span>
      </div>

      {loopLen > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Loop activ de {loopLen.toFixed(2)}s. Se reia automat, fără intervenția noastră.
        </p>
      )}
    </div>
  );
}