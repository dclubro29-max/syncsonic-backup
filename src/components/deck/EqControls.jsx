import React from "react";
import { Slider } from "@/components/ui/slider";
import { MoveHorizontal, SlidersHorizontal } from "lucide-react";

const BANDS = [
  { key: "low", label: "BASS" },
  { key: "mid", label: "MID" },
  { key: "high", label: "HIGH" },
];

/** Reglaje de mixaj: EQ pe 3 benzi, tempo, trim și volum. */
export default function EqControls({ deck, disabled, onEq, onTempo, onTrim, onVolume }) {
  return (
    <div className="space-y-2.5">
      {BANDS.map((b) => (
        <div key={b.key} className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-[10px] font-semibold tracking-wider text-muted-foreground">{b.label}</span>
          <Slider
            value={[deck.eq[b.key]]}
            min={-26}
            max={6}
            step={0.5}
            onValueChange={(v) => onEq(b.key, v[0])}
            disabled={disabled}
            className="flex-1"
          />
          <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">
            {deck.eq[b.key] > 0 ? "+" : ""}
            {deck.eq[b.key]}
          </span>
        </div>
      ))}

      <div className="flex items-center gap-3 border-t border-border/60 pt-2.5">
        <span className="flex w-14 shrink-0 items-center gap-1 text-[10px] font-semibold tracking-wider text-muted-foreground">
          <MoveHorizontal className="h-3 w-3" />
          TEMPO
        </span>
        <Slider
          value={[deck.tempo]}
          min={0.8}
          max={1.25}
          step={0.005}
          onValueChange={(v) => onTempo(v[0])}
          disabled={disabled}
          className="flex-1"
        />
        <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">
          {((deck.tempo - 1) * 100 >= 0 ? "+" : "") + ((deck.tempo - 1) * 100).toFixed(1)}%
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex w-14 shrink-0 items-center gap-1 text-[10px] font-semibold tracking-wider text-muted-foreground">
          <SlidersHorizontal className="h-3 w-3" />
          TRIM
        </span>
        <Slider
          value={[Math.round(deck.trim * 100)]}
          min={0}
          max={150}
          step={1}
          onValueChange={(v) => onTrim(v[0] / 100)}
          disabled={disabled}
          className="flex-1"
        />
        <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">
          {Math.round(deck.trim * 100)}%
        </span>
      </div>
    </div>
  );
}